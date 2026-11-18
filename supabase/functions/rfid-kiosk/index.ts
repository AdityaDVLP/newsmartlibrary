import { createClient } from "npm:@supabase/supabase-js@2";

type KioskAction = "checkin" | "register" | "verify_staff";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const secretKeysText = Deno.env.get("SUPABASE_SECRET_KEYS");
const secretKeys = secretKeysText ? JSON.parse(secretKeysText) as Record<string, string> : {};
const serviceRoleKey = secretKeys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRfid(value: string) {
  return value.trim().replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function readText(value: unknown, maximumLength: number) {
  return typeof value === "string" && value.trim().length <= maximumLength
    ? value.trim()
    : null;
}

function readAction(value: unknown): KioskAction | null {
  return value === "checkin" || value === "register" || value === "verify_staff" ? value : null;
}

function clientIp(request: Request) {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.slice(0, 128);

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",").map((part) => part.trim()).filter(Boolean).at(-1)?.slice(0, 128) ?? "unknown";
  }
  return "unknown";
}

async function consumeRateLimit(action: KioskAction, request: Request) {
  if (!supabaseAdmin || !serviceRoleKey) {
    throw new Error("Konfigurasi server RFID belum tersedia.");
  }

  const limits: Record<KioskAction, { maximum: number; seconds: number }> = {
    checkin: { maximum: 60, seconds: 60 },
    register: { maximum: 5, seconds: 3600 },
    verify_staff: { maximum: 10, seconds: 300 },
  };
  const { maximum, seconds } = limits[action];
  const rawKey = new TextEncoder().encode(`${serviceRoleKey}:${action}:${clientIp(request)}`);
  const digest = await crypto.subtle.digest("SHA-256", rawKey);
  const requestKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data, error } = await supabaseAdmin.rpc("consume_rfid_kiosk_rate_limit", {
    p_request_key: requestKey,
    p_max_attempts: maximum,
    p_window_seconds: seconds,
  });
  if (error) throw new Error("Pemeriksaan batas permintaan RFID gagal.");
  return data === true;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Metode request tidak didukung." }, 405);
  }
  if (!supabaseAdmin) {
    return jsonResponse({ error: "Konfigurasi server RFID belum tersedia." }, 500);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) {
    return jsonResponse({ error: "Ukuran request terlalu besar." }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Body JSON tidak valid." }, 400);
  }
  if (!isRecord(body)) {
    return jsonResponse({ error: "Body request tidak valid." }, 400);
  }

  const action = readAction(body.action);
  if (!action) {
    return jsonResponse({ error: "Aksi RFID tidak dikenal." }, 400);
  }
  try {
    if (!await consumeRateLimit(action, request)) {
      return jsonResponse({ error: "Terlalu banyak percobaan. Silakan coba lagi nanti." }, 429);
    }

    if (action === "verify_staff") {
      const uid = normalizeRfid(readText(body.rfidTag, 64) ?? "");
      if (!/^[A-F0-9]{4,32}$/.test(uid)) {
        return jsonResponse({ verified: false });
      }

      const { data: badge, error: badgeError } = await supabaseAdmin
        .from("staff_rfid_badges")
        .select("user_id")
        .eq("rfid_uid", uid)
        .maybeSingle();
      if (badgeError) throw badgeError;
      if (!badge) return jsonResponse({ verified: false });

      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(badge.user_id);
      if (userError) throw userError;
      const staffUser = userData.user;
      if (
        !staffUser?.email ||
        staffUser.app_metadata?.library_role !== "staff"
      ) {
        return jsonResponse({ verified: false });
      }

      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: staffUser.email,
      });
      if (linkError) throw linkError;

      const tokenHash = linkData.properties?.hashed_token;
      if (!tokenHash) throw new Error("Token login RFID tidak tersedia.");
      return jsonResponse({ verified: true, token_hash: tokenHash });
    }

    const uid = normalizeRfid(readText(body.rfidTag, 64) ?? "");
    if (!/^[A-F0-9]{4,32}$/.test(uid)) {
      return jsonResponse({ error: "UID RFID tidak valid." }, 400);
    }

    if (action === "checkin") {
      const { data, error } = await supabaseAdmin.rpc("checkin_visitor_by_rfid", {
        p_rfid_tag: uid,
      });
      if (error) throw error;
      if (!isRecord(data) || typeof data.registered !== "boolean") {
        throw new Error("Respons check-in tidak valid.");
      }
      return jsonResponse({
        registered: data.registered,
        ...(data.registered && typeof data.nama === "string" ? { nama: data.nama } : {}),
        ...(data.registered && typeof data.rfid_tag === "string" ? { rfid_tag: data.rfid_tag } : {}),
      });
    }

    const nim = readText(body.nim, 64);
    const nama = readText(body.nama, 150);
    const prodi = readText(body.prodi, 120);
    const status = readText(body.status, 20);
    if (!nim || !nama || !prodi || !status ||
        !["Mahasiswa", "Dosen", "Visitor"].includes(status)) {
      return jsonResponse({ error: "Data pendaftaran belum lengkap atau tidak valid." }, 400);
    }

    const { error } = await supabaseAdmin.rpc("register_member_from_kiosk", {
      p_nim: nim,
      p_nama: nama,
      p_prodi: prodi,
      p_status: status,
      p_rfid_tag: uid,
    });
    if (error) {
      if (error.code === "23505" || error.message.includes("sudah terdaftar")) {
        return jsonResponse({ error: "NIM atau UID RFID sudah terdaftar." }, 409);
      }
      if (error.message.includes("wajib diisi") || error.message.includes("tidak valid")) {
        return jsonResponse({ error: error.message }, 400);
      }
      throw error;
    }
    return jsonResponse({ registered: true });
  } catch (error) {
    console.error("RFID kiosk request failed:", error instanceof Error ? error.message : "unknown error");
    return jsonResponse({ error: "Permintaan RFID gagal diproses." }, 500);
  }
});

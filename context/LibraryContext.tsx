"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getRfidStatus, getRfidUid } from "../lib/rfid";
import { useUhfScanner } from "../lib/rfid/uhf";
import { supabase } from "../lib/supabase";

export type MemberCategory = "Mahasiswa" | "Dosen" | "Visitor";

export const getInitials = (name: string): string => {
  if (!name) return "??";
  const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  const words = cleanName.split(/\s+/).filter(Boolean);

  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
};

const avatarColors = [
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-teal-100 text-teal-700 border-teal-200",
  "bg-sky-100 text-sky-700 border-sky-200",
];

export const getAvatarColor = (name: string): string => {
  if (!name) return avatarColors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
};


export interface VisitorLog {
  id: string;
  waktu: string;
  nama: string;
  nim: string;
  prodi: string;
  kategori: MemberCategory;
  status: "Masuk" | "Keluar" | "Pinjam Buku";
  rfidTag: string;
  email?: string;
  noHp?: string;
}

export interface BookLog {
  id: string;
  waktu: string;
  isbn: string;
  judul: string;
  kategori: string;
  lokasiRak: string;
  rssi: number; // in dBm e.g. -48
  rfidTag: string;
}

export interface Member {
  id: string;
  nim: string;
  nama: string;
  prodi: string;
  email: string;
  noHp: string;
  rfidTag: string;
  status: MemberCategory; // "Mahasiswa" | "Dosen" | "Visitor"
  dateRegistered: string;
}

export interface Book {
  id: string;
  isbn: string;
  judul: string;
  pengarang: string;
  penerbit: string;
  kategori: string;
  lokasiRak: string;
  rfidTag: string;
  epcList?: string[];
  status: "Tersedia" | "Dipinjam" | "Dalam Perawatan";
  stok: number;
}

export interface Loan {
  id: string;
  memberId: string;
  memberName: string;
  memberNim: string;
  bookId: string;
  bookTagId?: string;
  bookTitle: string;
  bookIsbn: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  status: "Dipinjam" | "Dikembalikan";
}

export interface Activity {
  id: string;
  waktu: string;
  deskripsi: string;
  tipe: "visitor" | "book" | "system" | "member";
  iconType: string;
}

export interface RssiPoint {
  id: number;
  time: string;
  rssi: number;
  label: string;
}

export interface KioskVisitor {
  nama: string;
  rfidTag: string;
}

const normalizeRfid = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase();

const loadLocalBackup = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const saveLocalBackup = (key: string, data: unknown) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
};

const isRlsOrPermissionError = (error: unknown): boolean => {
  if (typeof error === "object" && error !== null) {
    const err = error as { code?: string; message?: string; details?: string };
    return (
      err.code === "42501" ||
      Boolean(err.message?.includes("row-level security")) ||
      Boolean(err.message?.includes("permission denied")) ||
      Boolean(err.details?.includes("row-level security"))
    );
  }
  return false;
};

const requireSupabase = () => {
  if (!supabase) {
    throw new Error("Supabase belum dikonfigurasi. Periksa URL dan publishable key di file .env.");
  }
  return supabase;
};

const mergeVisitorLogs = (...logGroups: VisitorLog[][]) => {
  const logsById = new Map<string, VisitorLog>();
  logGroups.flat().forEach((log) => {
    if (!logsById.has(log.id)) logsById.set(log.id, log);
  });
  return Array.from(logsById.values());
};

interface LibraryContextType {
  visitorLogs: VisitorLog[];
  bookLogs: BookLog[];
  members: Member[];
  membersLoaded: boolean;
  books: Book[];
  loans: Loan[];
  activities: Activity[];
  rssiHistory: RssiPoint[];
  databaseError: string | null;
  rfidActive: boolean;
  rfidUid: string | null;
  rfidScanVersion: number;
  txPower: number;
  connectionStatus: "Connected" | "Connecting..." | "Disconnected";
  toggleRfid: () => void;
  setTxPower: (power: number) => void;
  checkInVisitorByRfid: (rfidTag: string) => Promise<KioskVisitor | null>;
  registerMemberFromKiosk: (member: Omit<Member, "id" | "dateRegistered">) => Promise<void>;
  addMember: (member: Omit<Member, "id" | "dateRegistered">) => Promise<void>;
  updateMember: (id: string, updatedData: Partial<Member>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  addBook: (book: Omit<Book, "id">) => Promise<void>;
  updateBook: (id: string, updatedData: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  borrowBook: (memberId: string, bookId: string, bookTagId: string, dueAt: string) => Promise<void>;
  returnBook: (loanId: string) => Promise<void>;

  simulateVisitorScan: () => void;
  simulateBookScan: () => void;
  clearBookLogs: () => Promise<void>;
  clearVisitorLogs: () => Promise<void>;
  importMembers: (members: Omit<Member, "id" | "dateRegistered">[]) => Promise<number>;
  importBooks: (books: Omit<Book, "id">[]) => Promise<number>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{
  children: React.ReactNode;
  mode?: "staff" | "kiosk";
}> = ({ children, mode = "staff" }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(mode === "kiosk");
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [bookLogs, setBookLogs] = useState<BookLog[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [rssiHistory, setRssiHistory] = useState<RssiPoint[]>([]);

  const [rfidActive, setRfidActive] = useState<boolean>(true);
  const [rfidUid, setRfidUid] = useState<string | null>(null);
  const [rfidScanVersion, setRfidScanVersion] = useState(0);
  const [pendingVisitorScans, setPendingVisitorScans] = useState<{ id: string; uid: string; scannedAt: string }[]>([]);
  const [txPower, setTxPower] = useState<number>(20);
  const [connectionStatus, setConnectionStatus] = useState<"Connected" | "Connecting..." | "Disconnected">("Connected");

  const checkInVisitorByRfid = useCallback(async (rfidTag: string): Promise<KioskVisitor | null> => {
    try {
      const { data, error } = await requireSupabase().functions.invoke("rfid-kiosk", {
        body: { action: "checkin", rfidTag },
      });
      if (error) throw new Error(error.message);
      if (!data || typeof data !== "object") {
        throw new Error("Respons check-in RFID tidak valid.");
      }

      const result = data as Record<string, unknown>;
      if (result.registered === false) {
        setDatabaseError(null);
        return null;
      }
      if (result.registered !== true || typeof result.nama !== "string" || typeof result.rfid_tag !== "string") {
        throw new Error("Respons check-in RFID tidak lengkap.");
      }

      setDatabaseError(null);
      return { nama: result.nama, rfidTag: result.rfid_tag };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDatabaseError(`Gagal mencatat check-in RFID: ${message}`);
      throw error instanceof Error ? error : new Error(message);
    }
  }, []);

  const registerMemberFromKiosk = useCallback(async (member: Omit<Member, "id" | "dateRegistered">) => {
    try {
      const { data, error } = await requireSupabase().functions.invoke("rfid-kiosk", {
        body: {
          action: "register",
          nim: member.nim,
          nama: member.nama,
          prodi: member.prodi,
          status: member.status,
          rfidTag: member.rfidTag,
        },
      });
      if (error) throw new Error(error.message);
      if (!data || typeof data !== "object" || data.registered !== true) {
        throw new Error("Respons pendaftaran RFID tidak valid.");
      }
      setDatabaseError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDatabaseError(`Gagal mendaftarkan anggota: ${message}`);
      throw error instanceof Error ? error : new Error(message);
    }
  }, []);

  const mapMemberFromDb = (row: Record<string, unknown>): Member => {
    const rawTag = String(row.rfid_tag ?? row.rfidTag ?? "");
    const cleanTag = !rawTag || rawTag === "-" || rawTag === "null" || rawTag.startsWith("UNASSIGNED_") ? "Belum Ada" : rawTag;
    return {
      id: String(row.id ?? ""),
      nim: String(row.nim ?? ""),
      nama: String(row.nama ?? ""),
      prodi: String(row.prodi ?? ""),
      email: String(row.email ?? ""),
      noHp: String(row.no_hp ?? row.noHp ?? ""),
      rfidTag: cleanTag,
      status: (String(row.status ?? "") || "Mahasiswa") as MemberCategory,
      dateRegistered: String(row.date_registered ?? row.dateRegistered ?? ""),
    };
  };

  const mapBookFromDb = (row: Record<string, unknown>): Book => {
    const rawTag = String(row.rfid_tag ?? row.rfidTag ?? "");
    const cleanTag = !rawTag || rawTag === "-" || rawTag === "null" || rawTag.startsWith("UNASSIGNED_") ? "Belum Ada" : rawTag;
    let epcs = Array.isArray(row.epc_list)
      ? row.epc_list.map((item) => String(item))
      : Array.isArray(row.epcList)
      ? row.epcList.map((item) => String(item))
      : [];
    epcs = epcs.filter((e) => e && e !== "-" && e !== "null" && !e.startsWith("UNASSIGNED_"));
    if (epcs.length === 0 && cleanTag && cleanTag !== "Belum Ada") {
      epcs = [cleanTag];
    }
    return {
      id: String(row.id ?? ""),
      isbn: String(row.isbn ?? ""),
      judul: String(row.judul ?? ""),
      pengarang: String(row.pengarang ?? ""),
      penerbit: String(row.penerbit ?? ""),
      kategori: String(row.kategori ?? ""),
      lokasiRak: String(row.lokasi_rak ?? row.lokasiRak ?? ""),
      rfidTag: epcs[0] || cleanTag,
      epcList: epcs.length > 0 ? epcs : ["Belum Ada"],
      status: (String(row.status ?? "") || "Tersedia") as Book["status"],
      stok: Number(row.stok ?? (epcs.length || 1)),
    };
  };

  const mapVisitorLogFromDb = (row: Record<string, unknown>): VisitorLog => ({
    id: String(row.id ?? ""),
    waktu: String(row.waktu ?? ""),
    nama: String(row.nama ?? ""),
    nim: String(row.nim ?? ""),
    prodi: String(row.prodi ?? ""),
    kategori: String(row.kategori ?? "") as MemberCategory,
    status: String(row.status ?? "") as VisitorLog["status"],
    rfidTag: String(row.rfid_tag ?? row.rfidTag ?? ""),
    email: row.email ? String(row.email) : undefined,
    noHp: row.no_hp ? String(row.no_hp) : row.noHp ? String(row.noHp) : undefined,
  });

  const mapBookLogFromDb = (row: Record<string, unknown>): BookLog => ({
    id: String(row.id ?? ""),
    waktu: String(row.waktu ?? ""),
    isbn: String(row.isbn ?? ""),
    judul: String(row.judul ?? ""),
    kategori: String(row.kategori ?? ""),
    lokasiRak: String(row.lokasi_rak ?? row.lokasiRak ?? ""),
    rssi: Number(row.rssi ?? 0),
    rfidTag: String(row.rfid_tag ?? row.rfidTag ?? ""),
  });

  const mapLoanFromDb = (row: Record<string, unknown>): Loan => ({
    id: String(row.id ?? ""),
    memberId: String(row.member_id ?? ""),
    memberName: String(row.member_name ?? ""),
    memberNim: String(row.member_nim ?? ""),
    bookId: String(row.book_id ?? ""),
    bookTagId: row.book_tag_id ? String(row.book_tag_id) : undefined,
    bookTitle: String(row.book_title ?? ""),
    bookIsbn: String(row.book_isbn ?? ""),
    borrowedAt: String(row.borrowed_at ?? ""),
    dueAt: String(row.due_at ?? ""),
    returnedAt: row.returned_at ? String(row.returned_at) : null,
    status: String(row.status ?? "Dipinjam") as Loan["status"],
  });

  const mapActivityFromDb = (row: Record<string, unknown>): Activity => ({
    id: String(row.id ?? ""),
    waktu: String(row.waktu ?? ""),
    deskripsi: String(row.deskripsi ?? ""),
    tipe: String(row.tipe ?? "") as Activity["tipe"],
    iconType: String(row.icon_type ?? row.iconType ?? ""),
  });

  const mapMemberToDb = (member: Member) => {
    const rawRfid = member.rfidTag ? member.rfidTag.trim() : "";
    const hasRealRfid =
      rawRfid !== "" &&
      rawRfid !== "Belum Ada" &&
      rawRfid !== "-" &&
      !rawRfid.startsWith("UNASSIGNED");

    // Jika belum ada RFID, kirim ID unik agar aman terhadap constraint NOT NULL maupun UNIQUE
    const cleanRfid = hasRealRfid
      ? rawRfid
      : `UNASSIGNED_${member.id.replace(/[^a-zA-Z0-9]/g, "")}`;

    return {
      id: member.id,
      nim: member.nim,
      nama: member.nama,
      prodi: member.prodi,
      email: member.email,
      no_hp: member.noHp,
      rfid_tag: cleanRfid,
      status: member.status,
      date_registered: member.dateRegistered,
    };
  };

  const mapBookToDb = (book: Book) => {
    const cleanEpcs = (book.epcList || []).filter(
      (e) => e && e !== "Belum Ada" && e !== "-" && !e.startsWith("UNASSIGNED")
    );
    const hasRealTag =
      cleanEpcs.length > 0
        ? cleanEpcs[0]
        : book.rfidTag &&
          book.rfidTag !== "Belum Ada" &&
          book.rfidTag !== "-" &&
          !book.rfidTag.startsWith("UNASSIGNED")
        ? book.rfidTag
        : null;

    const finalRfid = hasRealTag || `UNASSIGNED_${book.id.replace(/[^a-zA-Z0-9]/g, "")}`;

    return {
      id: book.id,
      isbn: book.isbn,
      judul: book.judul,
      pengarang: book.pengarang,
      penerbit: book.penerbit,
      kategori: book.kategori,
      lokasi_rak: book.lokasiRak,
      rfid_tag: finalRfid,
      epc_list: cleanEpcs,
      status: book.status,
      stok: book.stok,
    };
  };

  const mapVisitorLogToDb = (log: VisitorLog) => ({
    id: log.id,
    waktu: log.waktu,
    nama: log.nama,
    nim: log.nim,
    prodi: log.prodi,
    kategori: log.kategori,
    status: log.status,
    rfid_tag: log.rfidTag,
    email: log.email ?? null,
    no_hp: log.noHp ?? null,
  });

  const mapBookLogToDb = (log: BookLog) => ({
    id: log.id,
    waktu: log.waktu,
    isbn: log.isbn,
    judul: log.judul,
    kategori: log.kategori,
    lokasi_rak: log.lokasiRak,
    rssi: log.rssi,
    rfid_tag: log.rfidTag,
  });

  const mapActivityToDb = (activity: Activity) => ({
    id: activity.id,
    waktu: activity.waktu,
    deskripsi: activity.deskripsi,
    tipe: activity.tipe,
    icon_type: activity.iconType,
  });

  const loadSupabaseData = async () => {
    if (!supabase) {
      setDatabaseError("Supabase belum dikonfigurasi. Periksa URL dan publishable key.");
      setMembersLoaded(true);
      return;
    }

    try {
      const [membersResponse, booksResponse, visitorLogsResponse, bookLogsResponse, activitiesResponse, rssiResponse, loansResponse] = await Promise.all([
        supabase.from("members").select("*").order("date_registered", { ascending: false }),
        supabase.from("books").select("*").order("judul", { ascending: true }),
        supabase.from("visitor_logs").select("*").order("waktu", { ascending: false }),
        supabase.from("book_logs").select("*").order("waktu", { ascending: false }),
        supabase.from("activities").select("*").order("waktu", { ascending: false }),
        supabase.from("rssi_history").select("*").order("id", { ascending: true }),
        supabase.from("book_loans").select("*").order("borrowed_at", { ascending: false }),
      ]);

      const responses = [
        ["anggota", membersResponse],
        ["buku", booksResponse],
        ["log pengunjung", visitorLogsResponse],
        ["log buku", bookLogsResponse],
        ["aktivitas", activitiesResponse],
        ["riwayat RSSI", rssiResponse],
        ["peminjaman", loansResponse],
      ] as const;
      const failedResponse = responses.find(([, response]) => response.error !== null);
      if (failedResponse) {
        const responseError = failedResponse[1].error;
        throw new Error(`Gagal memuat ${failedResponse[0]}: ${responseError?.message ?? "Kesalahan database."}`);
      }

      const loadedMembers = (membersResponse.data ?? []).map((row) => mapMemberFromDb(row as Record<string, unknown>));
      const loadedBooks = (booksResponse.data ?? []).map((row) => mapBookFromDb(row as Record<string, unknown>));
      const loadedVisitorLogs = (visitorLogsResponse.data ?? []).map((row) => mapVisitorLogFromDb(row as Record<string, unknown>)).slice(0, 100);
      const loadedBookLogs = (bookLogsResponse.data ?? []).map((row) => mapBookLogFromDb(row as Record<string, unknown>));
      const loadedActivities = (activitiesResponse.data ?? []).map((row) => mapActivityFromDb(row as Record<string, unknown>));
      const loadedRssi = (rssiResponse.data ?? []).map((row) => ({
        id: Number(row.id),
        time: String(row.time ?? ""),
        rssi: Number(row.rssi ?? 0),
        label: String(row.label ?? ""),
      }));
      const loadedLoans = (loansResponse.data ?? []).map((row) => mapLoanFromDb(row as Record<string, unknown>));

      setMembers(loadedMembers);
      setBooks(loadedBooks);
      setVisitorLogs(loadedVisitorLogs);
      setBookLogs(loadedBookLogs);
      setActivities(loadedActivities);
      setRssiHistory(loadedRssi);
      setLoans(loadedLoans);

      saveLocalBackup("smartlib_members", loadedMembers);
      saveLocalBackup("smartlib_books", loadedBooks);
      saveLocalBackup("smartlib_loans", loadedLoans);
      saveLocalBackup("smartlib_visitor_logs", loadedVisitorLogs);
      saveLocalBackup("smartlib_book_logs", loadedBookLogs);
      saveLocalBackup("smartlib_activities", loadedActivities);

      setDatabaseError(null);
      setMembersLoaded(true);
    } catch (error) {
      // Ambil data dari cache lokal jika pemuatan Supabase gagal (misal RLS ditolak atau offline)
      const cachedMembers = loadLocalBackup<Member[]>("smartlib_members", []);
      const cachedBooks = loadLocalBackup<Book[]>("smartlib_books", []);
      const cachedLoans = loadLocalBackup<Loan[]>("smartlib_loans", []);
      const cachedVisitorLogs = loadLocalBackup<VisitorLog[]>("smartlib_visitor_logs", []);
      const cachedBookLogs = loadLocalBackup<BookLog[]>("smartlib_book_logs", []);
      const cachedActivities = loadLocalBackup<Activity[]>("smartlib_activities", []);

      if (cachedMembers.length > 0) setMembers(cachedMembers);
      if (cachedBooks.length > 0) setBooks(cachedBooks);
      if (cachedLoans.length > 0) setLoans(cachedLoans);
      if (cachedVisitorLogs.length > 0) setVisitorLogs(cachedVisitorLogs);
      if (cachedBookLogs.length > 0) setBookLogs(cachedBookLogs);
      if (cachedActivities.length > 0) setActivities(cachedActivities);

      const errMessage = error instanceof Error ? error.message : String(error);
      setDatabaseError(errMessage);
      setMembersLoaded(true);
      console.warn("Failed to load Supabase library data (using local cache if available):", error);
    }
  };

  const persistMemberToSupabase = async (member: Member) => {
    const client = requireSupabase();
    const payload = mapMemberToDb(member);

    const { error } = await client.from("members").upsert(payload, { onConflict: "id" });
    if (error) {
      if (
        error.code === "23502" ||
        error.message?.includes("rfid_tag") ||
        error.message?.includes("null")
      ) {
        const fallbackPayload = {
          ...payload,
          rfid_tag: `UNASSIGNED_${member.id.replace(/[^a-zA-Z0-9]/g, "")}`,
        };
        const { error: fallbackError } = await client.from("members").upsert(fallbackPayload, { onConflict: "id" });
        if (fallbackError) throw fallbackError;
      } else {
        throw error;
      }
    }
    setDatabaseError(null);
  };

  const persistBookToSupabase = async (book: Book) => {
    const client = requireSupabase();
    const payload = mapBookToDb(book);

    const { error } = await client.from("books").upsert(payload, { onConflict: "id" });
    if (error) {
      if (
        error.code === "23502" ||
        error.message?.includes("rfid_tag") ||
        error.message?.includes("null")
      ) {
        const fallbackPayload = {
          ...payload,
          rfid_tag: `UNASSIGNED_${book.id.replace(/[^a-zA-Z0-9]/g, "")}`,
        };
        const { error: fallbackError } = await client.from("books").upsert(fallbackPayload, { onConflict: "id" });
        if (fallbackError) throw fallbackError;
      } else {
        throw error;
      }
    }
    setDatabaseError(null);
  };

  const persistVisitorLogToSupabase = async (log: VisitorLog) => {
    const client = requireSupabase();

    const { error } = await client.from("visitor_logs").upsert(mapVisitorLogToDb(log), { onConflict: "id" });
    if (error) throw error;
    setDatabaseError(null);
  };

  const storeVisitorLog = (log: VisitorLog) => persistVisitorLogToSupabase(log);

  const persistBookLogToSupabase = async (log: BookLog) => {
    const client = requireSupabase();

    const { error } = await client.from("book_logs").upsert(mapBookLogToDb(log), { onConflict: "id" });
    if (error) throw error;
    setDatabaseError(null);
  };

  const persistActivityToSupabase = async (activity: Activity) => {
    const client = requireSupabase();

    const { error } = await client.from("activities").upsert(mapActivityToDb(activity), { onConflict: "id" });
    if (error) throw error;
    setDatabaseError(null);
  };

  const reportBackgroundDatabaseError = useCallback((operation: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    setDatabaseError(`${operation}: ${message}`);
    console.error(`${operation}:`, error);
  }, []);

  useEffect(() => {
    if (mode === "kiosk") return;

    const timer = window.setTimeout(() => void loadSupabaseData(), 0);
    return () => window.clearTimeout(timer);
  }, [mode]);

  useEffect(() => {
    if (!rfidActive) return;

    let cancelled = false;

    const pollRfid = async () => {
      try {
        const [uidResult, statusResult] = await Promise.allSettled([
          getRfidUid(),
          getRfidStatus(),
        ]);

        if (cancelled) return;

        setConnectionStatus(statusResult.status === "fulfilled" && statusResult.value.reader_connected ? "Connected" : "Disconnected");

        if (uidResult.status !== "fulfilled") return;
        const detectedUid = uidResult.value.uid;
        if (!detectedUid) return;

        setRfidUid(detectedUid);
        setRfidScanVersion((version) => version + 1);
        if (mode !== "kiosk") {
          setPendingVisitorScans((previous) => [...previous, {
            id: globalThis.crypto.randomUUID(),
            uid: detectedUid,
            scannedAt: new Date().toISOString(),
          }].slice(-16));
        }
      } catch {
        if (!cancelled) setConnectionStatus("Disconnected");
      }
    };

    pollRfid();
    const interval = setInterval(pollRfid, 700);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mode, rfidActive]);

  // ── UHF WebSocket: baca EPC buku → otomatis tambah ke LOG BUKU ──────────────
  const handleUhfEpc = useCallback(
    (epc: string, rssi: number | null) => {
      if (mode === "kiosk") return;

      const normalizedEpc = normalizeRfid(epc);

      // Cocokkan EPC dengan buku yang terdaftar
      const matchedBook = books.find((book) =>
        [book.rfidTag, ...(book.epcList ?? [])].some(
          (tag) => normalizeRfid(tag) === normalizedEpc
        )
      );

      // Kalau tidak terdaftar tidak usah memasukkan EPC ke LOG
      if (!matchedBook) return;

      const timeStr = new Date().toTimeString().split(" ")[0];
      const rssiValue = rssi ?? -99;
      const judul = matchedBook.judul;
      const lokasiRak = matchedBook.lokasiRak;
      const isbn = matchedBook.isbn;
      const kategori = matchedBook.kategori;

      // Tambah ke RSSI history (untuk grafik monitor)
      setRssiHistory((prev) => {
        const next = [
          ...prev,
          {
            id: Date.now(),
            time: timeStr.substring(0, 5),
            rssi: rssiValue,
            label: judul.substring(0, 15),
          },
        ].slice(-20);
        return next;
      });

      // Buat BookLog entry
      const newLog: BookLog = {
        id: `BL_${globalThis.crypto.randomUUID()}`,
        waktu: timeStr,
        isbn,
        judul,
        kategori,
        lokasiRak,
        rssi: rssiValue,
        rfidTag: epc,
      };

      setBookLogs((prev) => [newLog, ...prev].slice(0, 50));
      void persistBookLogToSupabase(newLog).catch((error) =>
        reportBackgroundDatabaseError("Gagal menyimpan log buku UHF", error)
      );

      // Tambah ke aktivitas
      const newAct: Activity = {
        id: `ACT_${globalThis.crypto.randomUUID()}`,
        waktu: timeStr.substring(0, 5),
        deskripsi: `Tag RFID Buku [${judul.substring(0, 20)}] terdeteksi di ${lokasiRak} (${rssiValue} dBm)`,
        tipe: "book",
        iconType: "book",
      };
      setActivities((prev) => [newAct, ...prev].slice(0, 15));
      void persistActivityToSupabase(newAct).catch((error) =>
        reportBackgroundDatabaseError("Gagal menyimpan aktivitas UHF", error)
      );
    },
    [books, mode, reportBackgroundDatabaseError]
  );

  useUhfScanner({
    enabled: rfidActive && mode !== "kiosk",
    onEpc: handleUhfEpc,
  });

  useEffect(() => {
    if (mode === "kiosk" || !membersLoaded || pendingVisitorScans.length === 0) return;

    const timeoutId = window.setTimeout(() => {
      const newLogs = pendingVisitorScans.flatMap((scan) => {
        const scannedUid = normalizeRfid(scan.uid);
        const matchedMember = members.find((member) => normalizeRfid(member.rfidTag) === scannedUid);
        if (!matchedMember) return [];

        const timeStr = new Date(scan.scannedAt).toTimeString().split(" ")[0];
        const log: VisitorLog = {
          id: `V_${scan.id}`,
          waktu: timeStr,
          nama: matchedMember.nama,
          nim: matchedMember.nim,
          prodi: matchedMember.prodi,
          kategori: matchedMember.status,
          status: "Masuk",
          rfidTag: matchedMember.rfidTag,
          email: matchedMember.email,
          noHp: matchedMember.noHp,
        };
        const activity: Activity = {
          id: `ACT_${scan.id}`,
          waktu: timeStr.substring(0, 5),
          deskripsi: `${matchedMember.nama} (${matchedMember.nim}) tap masuk perpustakaan`,
          tipe: "visitor",
          iconType: "user",
        };
        void storeVisitorLog(log).catch((error) => reportBackgroundDatabaseError("Gagal menyimpan log pengunjung", error));
        void persistActivityToSupabase(activity).catch((error) => reportBackgroundDatabaseError("Gagal menyimpan aktivitas", error));
        return [{ log, activity }];
      });

      if (newLogs.length > 0) {
        setVisitorLogs((current) => mergeVisitorLogs(newLogs.map(({ log }) => log), current).slice(0, 16));
        setActivities((current) => [...newLogs.map(({ activity }) => activity), ...current].slice(0, 16));
      }

      const processedScanIds = new Set(pendingVisitorScans.map((scan) => scan.id));
      setPendingVisitorScans((current) => current.filter((scan) => !processedScanIds.has(scan.id)));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [members, membersLoaded, mode, pendingVisitorScans, reportBackgroundDatabaseError]);

  const toggleRfid = () => {
    setRfidActive((prev) => !prev);
    setConnectionStatus(rfidActive ? "Connecting..." : "Connected");
  };

  const addMember = async (memberData: Omit<Member, "id" | "dateRegistered">) => {
    const newMember: Member = {
      ...memberData,
      id: `M_${globalThis.crypto.randomUUID()}`,
      dateRegistered: new Date().toISOString().split("T")[0],
    };

    // Update state dan cache lokal terlebih dahulu
    setMembers((prev) => {
      const next = [newMember, ...prev];
      saveLocalBackup("smartlib_members", next);
      return next;
    });

    const newActivity: Activity = {
      id: `ACT_${globalThis.crypto.randomUUID()}`,
      waktu: new Date().toTimeString().substring(0, 5),
      deskripsi: `Anggota baru terdaftar: ${newMember.nama} (${newMember.nim})`,
      tipe: "member",
      iconType: "user",
    };
    setActivities((prev) => {
      const next = [newActivity, ...prev];
      saveLocalBackup("smartlib_activities", next);
      return next;
    });

    try {
      await persistMemberToSupabase(newMember);
      void persistActivityToSupabase(newActivity).catch((err) =>
        reportBackgroundDatabaseError("Gagal menyimpan aktivitas anggota baru", err)
      );
    } catch (error) {
      if (isRlsOrPermissionError(error)) {
        console.warn("Supabase member insert deferred (RLS restriction): Data tersimpan aman di cache lokal browser.", error);
        reportBackgroundDatabaseError("Akses database Supabase terbatas (RLS 42501). Data tersimpan di memori browser", error);
        return;
      }
      // Jika terjadi error validasi duplikat (23505), batalkan state lokal dan lempar error
      setMembers((prev) => {
        const next = prev.filter((m) => m.id !== newMember.id);
        saveLocalBackup("smartlib_members", next);
        return next;
      });
      throw error;
    }
  };

  const updateMember = async (id: string, updatedData: Partial<Member>) => {
    const currentMember = members.find((member) => member.id === id);
    if (!currentMember) throw new Error("Data anggota tidak ditemukan.");
    const updatedMember = { ...currentMember, ...updatedData };

    setMembers((prev) => {
      const next = prev.map((member) => (member.id === id ? updatedMember : member));
      saveLocalBackup("smartlib_members", next);
      return next;
    });

    const newActivity: Activity = {
      id: `ACT_${globalThis.crypto.randomUUID()}`,
      waktu: new Date().toTimeString().substring(0, 5),
      deskripsi: `Data anggota diperbarui: ${updatedMember.nama} (${updatedMember.nim})`,
      tipe: "member",
      iconType: "user",
    };
    setActivities((prev) => {
      const next = [newActivity, ...prev];
      saveLocalBackup("smartlib_activities", next);
      return next;
    });

    try {
      await persistMemberToSupabase(updatedMember);
      void persistActivityToSupabase(newActivity).catch((err) =>
        reportBackgroundDatabaseError("Gagal menyimpan aktivitas pembaruan anggota", err)
      );
    } catch (error) {
      if (isRlsOrPermissionError(error)) {
        console.warn("Supabase member update deferred (RLS restriction): Data tersimpan di cache lokal.", error);
        reportBackgroundDatabaseError("Akses database Supabase terbatas (RLS 42501). Data tersimpan di memori browser", error);
        return;
      }
      setMembers((prev) => {
        const next = prev.map((member) => (member.id === id ? currentMember : member));
        saveLocalBackup("smartlib_members", next);
        return next;
      });
      throw error;
    }
  };

  const deleteMember = async (id: string) => {
    const client = requireSupabase();

    // 1. Cek apakah anggota masih memiliki buku yang sedang dipinjam (belum dikembalikan)
    const activeLoan = loans.find((l) => l.memberId === id && l.status === "Dipinjam");
    if (activeLoan) {
      throw new Error(
        `Tidak dapat menghapus anggota: ${activeLoan.memberName || "Anggota"} masih meminjam buku "${activeLoan.bookTitle}". Harap kembalikan buku terlebih dahulu.`
      );
    }

    const previousMembers = members;
    const previousLoans = loans;

    setLoans((prev) => {
      const next = prev.filter((loan) => loan.memberId !== id);
      saveLocalBackup("smartlib_loans", next);
      return next;
    });
    setMembers((prev) => {
      const next = prev.filter((member) => member.id !== id);
      saveLocalBackup("smartlib_members", next);
      return next;
    });

    try {
      // 2. Bersihkan riwayat peminjaman buku anggota terlebih dahulu
      await client.from("book_loans").delete().eq("member_id", id);
      // 3. Hapus data anggota di Supabase
      const { error } = await client.from("members").delete().eq("id", id);
      if (error) {
        if (isRlsOrPermissionError(error)) {
          console.warn("Supabase member delete deferred (RLS restriction): Anggota dihapus dari tampilan lokal.", error);
          return;
        }
        throw error;
      }
    } catch (err) {
      if (isRlsOrPermissionError(err)) {
        return;
      }
      // Revert jika gagal selain RLS
      setMembers(previousMembers);
      setLoans(previousLoans);
      saveLocalBackup("smartlib_members", previousMembers);
      saveLocalBackup("smartlib_loans", previousLoans);
      throw err;
    }
    setDatabaseError(null);
  };

  const addBook = async (bookData: Omit<Book, "id">) => {
    const newBook: Book = {
      ...bookData,
      id: `B_${globalThis.crypto.randomUUID()}`,
    };

    setBooks((prev) => {
      const next = [newBook, ...prev];
      saveLocalBackup("smartlib_books", next);
      return next;
    });

    const newActivity: Activity = {
      id: `ACT_${globalThis.crypto.randomUUID()}`,
      waktu: new Date().toTimeString().substring(0, 5),
      deskripsi: `Buku baru didaftarkan: ${newBook.judul} [${newBook.lokasiRak}]`,
      tipe: "book",
      iconType: "book",
    };
    setActivities((prev) => {
      const next = [newActivity, ...prev];
      saveLocalBackup("smartlib_activities", next);
      return next;
    });

    try {
      await persistBookToSupabase(newBook);
      void persistActivityToSupabase(newActivity).catch((err) =>
        reportBackgroundDatabaseError("Gagal menyimpan aktivitas", err)
      );
    } catch (error) {
      if (isRlsOrPermissionError(error)) {
        console.warn("Supabase book insert deferred (RLS restriction): Buku tersimpan di cache lokal.", error);
        reportBackgroundDatabaseError("Akses database Supabase terbatas (RLS 42501). Data tersimpan di memori browser", error);
        return;
      }
      setBooks((prev) => {
        const next = prev.filter((b) => b.id !== newBook.id);
        saveLocalBackup("smartlib_books", next);
        return next;
      });
      throw error;
    }
  };

  const updateBook = async (id: string, updatedData: Partial<Book>) => {
    const currentBook = books.find((book) => book.id === id);
    if (!currentBook) throw new Error("Data buku tidak ditemukan.");
    const updatedBook = { ...currentBook, ...updatedData };

    setBooks((prev) => {
      const next = prev.map((book) => (book.id === id ? updatedBook : book));
      saveLocalBackup("smartlib_books", next);
      return next;
    });

    const newActivity: Activity = {
      id: `ACT_${Date.now()}`,
      waktu: new Date().toTimeString().substring(0, 5),
      deskripsi: `Data buku diperbarui: ${updatedBook.judul} (${updatedBook.isbn})`,
      tipe: "book",
      iconType: "book",
    };
    setActivities((prev) => {
      const next = [newActivity, ...prev];
      saveLocalBackup("smartlib_activities", next);
      return next;
    });

    try {
      await persistBookToSupabase(updatedBook);
      void persistActivityToSupabase(newActivity).catch((err) =>
        reportBackgroundDatabaseError("Gagal menyimpan aktivitas", err)
      );
    } catch (error) {
      if (isRlsOrPermissionError(error)) {
        console.warn("Supabase book update deferred (RLS restriction): Buku tersimpan di cache lokal.", error);
        reportBackgroundDatabaseError("Akses database Supabase terbatas (RLS 42501). Data tersimpan di memori browser", error);
        return;
      }
      setBooks((prev) => {
        const next = prev.map((book) => (book.id === id ? currentBook : book));
        saveLocalBackup("smartlib_books", next);
        return next;
      });
      throw error;
    }
  };

  const deleteBook = async (id: string) => {
    const client = requireSupabase();

    // 1. Cek apakah buku sedang dipinjam aktif
    const activeLoan = loans.find((l) => l.bookId === id && l.status === "Dipinjam");
    if (activeLoan) {
      throw new Error(
        `Tidak dapat menghapus buku: buku ini sedang dipinjam oleh ${activeLoan.memberName || "anggota"}. Harap selesaikan pengembalian terlebih dahulu.`
      );
    }

    const previousBooks = books;
    setBooks((prev) => {
      const next = prev.filter((book) => book.id !== id);
      saveLocalBackup("smartlib_books", next);
      return next;
    });

    try {
      // 2. Bersihkan riwayat peminjaman buku dari tabel book_loans terlebih dahulu
      await client.from("book_loans").delete().eq("book_id", id);
      // 3. Hapus data buku
      const { error } = await client.from("books").delete().eq("id", id);
      if (error) {
        if (isRlsOrPermissionError(error)) {
          console.warn("Supabase book delete deferred (RLS restriction): Buku dihapus dari tampilan lokal.", error);
          return;
        }
        throw error;
      }
    } catch (err) {
      if (isRlsOrPermissionError(err)) {
        return;
      }
      setBooks(previousBooks);
      saveLocalBackup("smartlib_books", previousBooks);
      throw err;
    }
  };

  const borrowBook = async (memberId: string, bookId: string, bookTagId: string, dueAt: string) => {
    const member = members.find((item) => item.id === memberId);
    const book = books.find((item) => item.id === bookId);
    if (!member) throw new Error("Anggota tidak ditemukan.");
    if (!book) throw new Error("Buku tidak ditemukan.");
    const normalizedBookTagId = normalizeRfid(bookTagId);
    const bookHasTag = [book.rfidTag, ...(book.epcList ?? [])]
      .some((tag) => normalizeRfid(tag) === normalizedBookTagId);
    if (!normalizedBookTagId || !bookHasTag) {
      throw new Error("ID tag EPC tidak terdaftar pada buku yang dipilih.");
    }
    const activeLoanForMember = loans.find(
      (item) => item.memberId === memberId && item.status === "Dipinjam"
    );
    if (activeLoanForMember) {
      throw new Error(`Anggota masih meminjam "${activeLoanForMember.bookTitle}". Kembalikan buku tersebut sebelum meminjam judul lain.`);
    }
    const legacyActiveLoanForBook = loans.find(
      (item) => item.bookId === bookId && item.status === "Dipinjam" && !item.bookTagId
    );
    if (legacyActiveLoanForBook) {
      throw new Error("Transaksi aktif lama belum memiliki ID tag EPC; selesaikan pengembaliannya sebelum meminjam eksemplar lain.");
    }
    const activeLoanForTag = loans.find(
      (item) => item.status === "Dipinjam" && normalizeRfid(item.bookTagId ?? "") === normalizedBookTagId
    );
    if (activeLoanForTag) throw new Error("ID tag EPC ini sudah tercatat pada pinjaman aktif.");

    const now = new Date();
    const borrowedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const loanId = `L_${globalThis.crypto.randomUUID()}`;
    const loan: Loan = {
      id: loanId,
      memberId: member.id,
      memberName: member.nama,
      memberNim: member.nim,
      bookId: book.id,
      bookTagId,
      bookTitle: book.judul,
      bookIsbn: book.isbn,
      borrowedAt,
      dueAt,
      returnedAt: null,
      status: "Dipinjam",
    };

    const client = requireSupabase();
    const { error } = await client.rpc("borrow_book", {
      p_loan_id: loanId,
      p_member_id: memberId,
      p_book_id: bookId,
      p_book_tag_id: bookTagId,
      p_due_at: dueAt,
    });
    if (error) {
      if (error.message.includes("book_loans_one_active_member_uidx") ||
          error.message.includes("Anggota masih memiliki pinjaman aktif")) {
        throw new Error("Anggota masih memiliki pinjaman aktif. Kembalikan buku tersebut sebelum meminjam judul lain.");
      }
      if (error.message.includes("book_loans_active_tag_uidx") ||
          error.message.includes("ID tag EPC ini sudah tercatat pada pinjaman aktif")) {
        throw new Error("ID tag EPC ini sudah tercatat pada pinjaman aktif.");
      }
      throw new Error(error.message || "Peminjaman gagal diproses.");
    }

    setDatabaseError(null);
    const updatedBook: Book = {
      ...book,
      stok: book.stok - 1,
      status: book.stok - 1 === 0 ? "Dipinjam" : "Tersedia",
    };
    setLoans((prev) => [loan, ...prev]);
    setBooks((prev) => prev.map((item) => item.id === bookId ? updatedBook : item));
  };

  const returnBook = async (loanId: string) => {
    const loan = loans.find((item) => item.id === loanId);
    if (!loan || loan.status !== "Dipinjam") {
      throw new Error("Transaksi aktif tidak ditemukan atau buku sudah dikembalikan.");
    }
    const book = books.find((item) => item.id === loan.bookId);
    if (!book) throw new Error("Data buku tidak ditemukan; hubungi administrator.");

    const todayDate = new Date();
    const returnedAt = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;
    const returnedLoan: Loan = { ...loan, returnedAt, status: "Dikembalikan" };

    const client = requireSupabase();
    const { error } = await client.rpc("return_book", { p_loan_id: loanId });
    if (error) throw new Error(error.message || "Pengembalian gagal diproses.");

    setDatabaseError(null);
    const updatedBook: Book = {
      ...book,
      stok: book.stok + 1,
      status: book.status === "Dalam Perawatan" ? book.status : "Tersedia",
    };
    setLoans((prev) => prev.map((item) => item.id === loanId ? returnedLoan : item));
    setBooks((prev) => prev.map((item) => item.id === book.id ? updatedBook : item));
  };

  const simulateVisitorScan = () => {
    const randomMember = members[Math.floor(Math.random() * members.length)];
    if (!randomMember) return;

    const timeStr = new Date().toTimeString().split(" ")[0];
    const statuses: ("Masuk" | "Keluar")[] = ["Masuk", "Keluar"];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    const newLog: VisitorLog = {
      id: `V_${globalThis.crypto.randomUUID()}`,
      waktu: timeStr,
      nama: randomMember.nama,
      nim: randomMember.nim,
      prodi: randomMember.prodi,
      kategori: randomMember.status,
      status: status,
      rfidTag: randomMember.rfidTag,
    };


    setVisitorLogs((prev) => [newLog, ...prev].slice(0, 16));
    void storeVisitorLog(newLog).catch((error) => reportBackgroundDatabaseError("Gagal menyimpan log pengunjung", error));

    const newAct: Activity = {
      id: `ACT_${globalThis.crypto.randomUUID()}`,
      waktu: timeStr.substring(0, 5),
      deskripsi: `${randomMember.nama} (${randomMember.nim}) tap ${status.toLowerCase()} perpustakaan`,
      tipe: "visitor",
      iconType: "user",
    };
    setActivities([newAct, ...activities.slice(0, 15)]);
    void persistActivityToSupabase(newAct).catch((error) => reportBackgroundDatabaseError("Gagal menyimpan aktivitas", error));
  };

  const simulateBookScan = () => {
    const randomBook = books[Math.floor(Math.random() * books.length)];
    if (!randomBook) return;

    const timeStr = new Date().toTimeString().split(" ")[0];
    const simulatedRssi = Math.floor(Math.random() * 35) - 80; // -80 to -45

    const newLog: BookLog = {
      id: `BL_${globalThis.crypto.randomUUID()}`,
      waktu: timeStr,
      isbn: randomBook.isbn,
      judul: randomBook.judul,
      kategori: randomBook.kategori,
      lokasiRak: randomBook.lokasiRak,
      rssi: simulatedRssi,
      rfidTag: randomBook.rfidTag,
    };

    setBookLogs([newLog, ...bookLogs.slice(0, 15)]);
    void persistBookLogToSupabase(newLog).catch((error) => reportBackgroundDatabaseError("Gagal menyimpan log buku", error));

    const newAct: Activity = {
      id: `ACT_${globalThis.crypto.randomUUID()}`,
      waktu: timeStr.substring(0, 5),
      deskripsi: `Tag RFID Buku [${randomBook.judul.substring(0, 20)}...] terdeteksi di ${randomBook.lokasiRak} (${simulatedRssi} dBm)`,
      tipe: "book",
      iconType: "book",
    };
    setActivities([newAct, ...activities.slice(0, 15)]);
    void persistActivityToSupabase(newAct).catch((error) => reportBackgroundDatabaseError("Gagal menyimpan aktivitas", error));
  };

  const clearBookLogs = async () => {
    setBookLogs([]);
    setRssiHistory([]);
    try {
      if (supabase) {
        await supabase.from("book_logs").delete().neq("id", "");
      }
    } catch (error) {
      console.error("Gagal membersihkan log buku:", error);
    }
  };

  const clearVisitorLogs = async () => {
    setVisitorLogs([]);
    try {
      if (supabase) {
        await supabase.from("visitor_logs").delete().neq("id", "");
      }
    } catch (error) {
      console.error("Gagal membersihkan log pengunjung:", error);
    }
  };

  const importMembers = async (memberList: Omit<Member, "id" | "dateRegistered">[]) => {
    const client = requireSupabase();
    const today = new Date().toISOString().split("T")[0];
    const newMembers: Member[] = memberList.map((m) => {
      const tag = m.rfidTag && m.rfidTag.trim() !== "" && m.rfidTag !== "-" && m.rfidTag !== "null" ? m.rfidTag.trim() : "Belum Ada";
      return {
        ...m,
        id: `M_${globalThis.crypto.randomUUID()}`,
        dateRegistered: today,
        rfidTag: tag,
      };
    });

    const dbPayloads = newMembers.map((m) => {
      const cleanRfid = m.rfidTag && m.rfidTag !== "Belum Ada" && m.rfidTag !== "-" ? m.rfidTag : null;
      return {
        id: m.id,
        nim: m.nim,
        nama: m.nama,
        prodi: m.prodi,
        email: m.email || `${m.nim}@student.itk.ac.id`,
        no_hp: m.noHp || "-",
        rfid_tag: cleanRfid,
        status: m.status || "Mahasiswa",
        date_registered: m.dateRegistered,
      };
    });

    try {
      const { error } = await client.from("members").insert(dbPayloads);
      if (error) {
        if (error.message.includes("rfid_tag") && (error.message.includes("null") || error.code === "23502")) {
          const fallbackPayloads = dbPayloads.map((p) => ({
            ...p,
            rfid_tag: p.rfid_tag || `UNASSIGNED_${p.id}`,
          }));
          const { error: fallbackError } = await client.from("members").insert(fallbackPayloads);
          if (fallbackError && !isRlsOrPermissionError(fallbackError)) throw fallbackError;
        } else if (!isRlsOrPermissionError(error)) {
          throw error;
        }
      }
    } catch (err) {
      if (!isRlsOrPermissionError(err)) {
        throw err;
      }
      console.warn("Supabase member import deferred (RLS restriction): Disimpan di tampilan dan cache lokal.", err);
    }

    setMembers((prev) => {
      const next = [...newMembers, ...prev];
      saveLocalBackup("smartlib_members", next);
      return next;
    });
    return newMembers.length;
  };

  const importBooks = async (bookList: Omit<Book, "id">[]) => {
    const client = requireSupabase();
    const newBooks: Book[] = bookList.map((b) => {
      const cleanEpcs = (b.epcList || []).filter((e) => e && e !== "Belum Ada" && e !== "-" && e !== "null");
      const primaryTag = cleanEpcs[0] || (b.rfidTag && b.rfidTag !== "Belum Ada" && b.rfidTag !== "-" ? b.rfidTag : "Belum Ada");
      return {
        ...b,
        id: `B_${globalThis.crypto.randomUUID()}`,
        rfidTag: primaryTag,
        epcList: cleanEpcs.length > 0 ? cleanEpcs : ["Belum Ada"],
        stok: Math.max(1, b.stok || cleanEpcs.length || 1),
      };
    });

    const dbPayloads = newBooks.map((b) => {
      const cleanRfid = b.rfidTag && b.rfidTag !== "Belum Ada" && b.rfidTag !== "-" ? b.rfidTag : null;
      const cleanEpcs = (b.epcList || []).filter((e) => e && e !== "Belum Ada" && e !== "-");
      return {
        id: b.id,
        isbn: b.isbn,
        judul: b.judul,
        pengarang: b.pengarang || "Anonim",
        penerbit: b.penerbit || "ITK Press",
        kategori: b.kategori || "Komputer & Teknologi",
        lokasi_rak: b.lokasiRak || "Rak A-01",
        rfid_tag: cleanRfid,
        epc_list: cleanEpcs,
        status: b.status || "Tersedia",
        stok: b.stok,
      };
    });

    try {
      const { error } = await client.from("books").insert(dbPayloads);
      if (error) {
        if (error.message.includes("rfid_tag") && (error.message.includes("null") || error.code === "23502")) {
          const fallbackPayloads = dbPayloads.map((p) => ({
            ...p,
            rfid_tag: p.rfid_tag || `UNASSIGNED_${p.id}`,
          }));
          const { error: fallbackError } = await client.from("books").insert(fallbackPayloads);
          if (fallbackError && !isRlsOrPermissionError(fallbackError)) throw fallbackError;
        } else if (!isRlsOrPermissionError(error)) {
          throw error;
        }
      }
    } catch (err) {
      if (!isRlsOrPermissionError(err)) {
        throw err;
      }
      console.warn("Supabase book import deferred (RLS restriction): Disimpan di tampilan dan cache lokal.", err);
    }

    setBooks((prev) => {
      const next = [...newBooks, ...prev];
      saveLocalBackup("smartlib_books", next);
      return next;
    });
    return newBooks.length;
  };

  return (
    <LibraryContext.Provider
      value={{
        visitorLogs,
        bookLogs,
        members,
        membersLoaded,
        books,
        loans,
        activities,
        rssiHistory,
        databaseError,
        rfidActive,
        rfidUid,
        rfidScanVersion,
        txPower,
        connectionStatus,
        toggleRfid,
        setTxPower,
        checkInVisitorByRfid,
        registerMemberFromKiosk,
        addMember,
        updateMember,
        deleteMember,
        addBook,
        updateBook,
        deleteBook,
        borrowBook,
        returnBook,
        simulateVisitorScan,
        simulateBookScan,
        clearBookLogs,
        clearVisitorLogs,
        importMembers,
        importBooks,
      }}
    >
      {databaseError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-[100] flex max-w-lg items-start gap-3 rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-800 shadow-lg"
        >
          <p className="flex-1">{databaseError}</p>
          <button
            type="button"
            onClick={() => setDatabaseError(null)}
            className="font-semibold text-rose-700 hover:text-rose-900"
          >
            Tutup
          </button>
        </div>
      )}
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used within a LibraryProvider");
  }
  return context;
};

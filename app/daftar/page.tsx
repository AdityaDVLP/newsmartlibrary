"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, UserRound, ArrowLeft } from "lucide-react";
import { useLibrary } from "../../context/LibraryContext";
import type { MemberCategory } from "../../context/LibraryContext";
import Image from "next/image";

const PRODI_ITK = [
  "Informatika",
  "Sistem Informasi",
  "Teknik Elektro",
  "Teknik Mesin",
  "Teknik Sipil",
  "Teknik Kimia",
  "Teknik Industri",
  "Teknik Kelautan",
  "Teknik Perkapalan",
  "Teknik Lingkungan",
  "Teknik Material",
  "Teknik Geologi",
  "Teknik Geofisika",
  "Teknik Pertambangan",
  "Teknik Minyak dan Gas",
  "Fisika",
  "Matematika",
  "Kimia",
  "Biologi",
  "Perencanaan Wilayah dan Kota",
  "Arsitektur",
  "Tamu / Eksternal",
];

function DaftarForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addMember } = useLibrary();

  const rfidFromUrl = searchParams.get("rfid") ?? "";

  const [form, setForm] = useState({
    nama: "",
    nim: "",
    prodi: "",
    status: "" as MemberCategory | "",
    email: "",
    noHp: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.nama.trim()) newErrors.nama = "Nama wajib diisi";
    if (!form.nim.trim()) newErrors.nim = "NIM / ID wajib diisi";
    if (!form.prodi) newErrors.prodi = "Program studi wajib dipilih";
    if (!form.status) newErrors.status = "Status wajib dipilih";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    addMember({
      nim: form.nim,
      nama: form.nama,
      prodi: form.prodi,
      email: form.email || `${form.nim}@student.itk.ac.id`,
      noHp: form.noHp || "-",
      rfidTag: rfidFromUrl || "-",
      status: form.status as MemberCategory,
    });

    setSubmitted(true);
    setTimeout(() => router.push("/"), 3000);
  };

  if (submitted) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          textAlign: "center",
          gap: 16,
          padding: "40px 24px",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "#d1fae5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle2 size={44} color="#059669" strokeWidth={2.5} />
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: "#0f2346", margin: 0 }}>
          Pendaftaran Berhasil!
        </h2>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, maxWidth: 320, margin: 0 }}>
          Akun <strong>{form.nama}</strong> berhasil didaftarkan. Kartu RFID Anda kini terhubung ke sistem perpustakaan.
        </p>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
          Mengarahkan ke halaman utama...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* RFID Tag (read-only) */}
      {rfidFromUrl && (
        <div>
          <label style={labelStyle}>RFID Tag Kartu</label>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#f1f5f9",
              border: "1.5px solid #e2e8f0",
              fontSize: 13,
              color: "#475569",
              fontFamily: "monospace",
              letterSpacing: "0.05em",
            }}
          >
            {rfidFromUrl}
          </div>
        </div>
      )}

      {/* Nama */}
      <div>
        <label style={labelStyle}>Nama Lengkap <span style={{ color: "#dc2626" }}>*</span></label>
        <input
          type="text"
          placeholder="Contoh: Ahmad Rizky Pratama"
          value={form.nama}
          onChange={(e) => setForm({ ...form, nama: e.target.value })}
          style={{ ...inputStyle, borderColor: errors.nama ? "#dc2626" : "#e2e8f0" }}
        />
        {errors.nama && <p style={errorStyle}>{errors.nama}</p>}
      </div>

      {/* NIM */}
      <div>
        <label style={labelStyle}>NIM / ID Karyawan <span style={{ color: "#dc2626" }}>*</span></label>
        <input
          type="text"
          placeholder="Contoh: 10221001 atau 198804122019031002"
          value={form.nim}
          onChange={(e) => setForm({ ...form, nim: e.target.value })}
          style={{ ...inputStyle, borderColor: errors.nim ? "#dc2626" : "#e2e8f0" }}
        />
        {errors.nim && <p style={errorStyle}>{errors.nim}</p>}
      </div>

      {/* Program Studi */}
      <div>
        <label style={labelStyle}>Program Studi <span style={{ color: "#dc2626" }}>*</span></label>
        <div style={{ position: "relative" }}>
          <select
            value={form.prodi}
            onChange={(e) => setForm({ ...form, prodi: e.target.value })}
            style={{
              ...inputStyle,
              appearance: "none",
              cursor: "pointer",
              borderColor: errors.prodi ? "#dc2626" : "#e2e8f0",
              paddingRight: 40,
              color: form.prodi ? "#0f172a" : "#94a3b8",
            }}
          >
            <option value="" disabled>Pilih program studi...</option>
            {PRODI_ITK.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ChevronDown
            size={16}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }}
          />
        </div>
        {errors.prodi && <p style={errorStyle}>{errors.prodi}</p>}
      </div>

      {/* Status */}
      <div>
        <label style={labelStyle}>Status <span style={{ color: "#dc2626" }}>*</span></label>
        <div style={{ display: "flex", gap: 10 }}>
          {(["Mahasiswa", "Dosen", "Visitor"] as MemberCategory[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setForm({ ...form, status: s })}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 10,
                border: `2px solid ${form.status === s ? "#1562e8" : "#e2e8f0"}`,
                background: form.status === s ? "#eff6ff" : "white",
                color: form.status === s ? "#1562e8" : "#64748b",
                fontSize: 13,
                fontWeight: form.status === s ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        {errors.status && <p style={errorStyle}>{errors.status}</p>}
      </div>

      {/* Email (opsional) */}
      <div>
        <label style={labelStyle}>Email <span style={{ color: "#94a3b8", fontWeight: 400 }}>(opsional)</span></label>
        <input
          type="email"
          placeholder="Contoh: nama@student.itk.ac.id"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={inputStyle}
        />
      </div>

      {/* No HP (opsional) */}
      <div>
        <label style={labelStyle}>No. HP <span style={{ color: "#94a3b8", fontWeight: 400 }}>(opsional)</span></label>
        <input
          type="tel"
          placeholder="Contoh: 081234567890"
          value={form.noHp}
          onChange={(e) => setForm({ ...form, noHp: e.target.value })}
          style={inputStyle}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        style={{
          marginTop: 4,
          padding: "13px 0",
          borderRadius: 12,
          border: "none",
          background: "linear-gradient(135deg, #1562e8, #0f2346)",
          color: "white",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(21,98,232,0.35)",
          transition: "opacity 0.2s",
          letterSpacing: "0.02em",
        }}
      >
        Daftarkan Anggota
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#374151",
  marginBottom: 6,
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1.5px solid #e2e8f0",
  fontSize: 13,
  color: "#0f172a",
  background: "white",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const errorStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 11,
  color: "#dc2626",
};

export default function DaftarPage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#e8f2fb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative wave top-right */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", top: 0, right: 0, width: "40%", maxWidth: 500, opacity: 0.5, pointerEvents: "none" }}
        viewBox="0 0 500 380"
        fill="none"
      >
        <path d="M500 0H150C260 60 380 40 450 130C520 220 490 320 500 380V0Z" fill="#c3d9f2" />
      </svg>
      <svg
        aria-hidden="true"
        style={{ position: "absolute", bottom: 0, left: 0, width: "35%", maxWidth: 450, opacity: 0.45, pointerEvents: "none" }}
        viewBox="0 0 450 300"
        fill="none"
      >
        <path d="M0 300C80 240 180 200 280 220C370 238 430 272 450 300H0Z" fill="#bcd5ee" />
      </svg>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: 540,
          background: "white",
          borderRadius: 24,
          boxShadow: "0 20px 60px rgba(15,35,70,0.10)",
          overflow: "hidden",
        }}
      >
        {/* Header strip */}
        <div
          style={{
            background: "linear-gradient(135deg, #0f2346, #1562e8)",
            padding: "24px 28px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <button
            onClick={() => router.push("/")}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "white",
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <Image
              src="/assets/logo-upa-itk.png"
              alt="UPA Perpustakaan ITK"
              width={200}
              height={40}
              style={{ height: "auto", width: "clamp(130px, 16vw, 190px)", objectFit: "contain", filter: "brightness(0) invert(1)" }}
            />
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>
              Pendaftaran Anggota Perpustakaan
            </p>
          </div>
        </div>

        {/* Form body */}
        <div style={{ padding: "28px 28px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "#eff6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <UserRound size={20} color="#1562e8" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f2346" }}>Daftar Anggota Baru</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Lengkapi data diri untuk mendaftarkan kartu RFID Anda</p>
            </div>
          </div>

          <Suspense fallback={<div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>Memuat form...</div>}>
            <DaftarForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

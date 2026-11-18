"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Leaf,
  LogOut,
  ShieldCheck,
  UserRound,
  Volume2,
} from "lucide-react";
import { useLibrary } from "../context/LibraryContext";
import type { MemberCategory } from "../context/LibraryContext";
import { supabase } from "../lib/supabase";

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

function speakMessage(message: string) {
  if (!("speechSynthesis" in window)) return false;

  const synthesis = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "id-ID";
  utterance.voice = synthesis.getVoices()
    .find((voice) => voice.lang.toLowerCase().startsWith("id")) ?? null;
  synthesis.speak(utterance);
  return true;
}

export default function Home() {
  const { members, membersLoaded, rfidUid, rfidScanVersion, rfidActive, connectionStatus, addMember } = useLibrary();
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const lastProcessedScanVersion = useRef(rfidScanVersion);
  const lastSpokenScanVersion = useRef(rfidScanVersion);

  // Inline registration form state
  const [showForm, setShowForm] = useState(false);
  const [registerDone, setRegisterDone] = useState(false);
  const [registerSaving, setRegisterSaving] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [regForm, setRegForm] = useState({ nama: "", nim: "", prodi: "", status: "" as MemberCategory | "" });
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  // Reset form when rfid changes
  useEffect(() => {
    setShowForm(false);
    setRegisterDone(false);
    setRegisterError("");
    setRegForm({ nama: "", nim: "", prodi: "", status: "" });
    setRegErrors({});
  }, [rfidUid]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!regForm.nama.trim()) errs.nama = "Nama wajib diisi";
    if (!regForm.nim.trim()) errs.nim = "NIM / ID wajib diisi";
    if (!regForm.prodi) errs.prodi = "Program studi wajib dipilih";
    if (!regForm.status) errs.status = "Status wajib dipilih";
    setRegErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setRegisterSaving(true);
    setRegisterError("");
    try {
      await addMember({
        nim: regForm.nim,
        nama: regForm.nama,
        prodi: regForm.prodi,
        email: `${regForm.nim}@student.itk.ac.id`,
        noHp: "-",
        rfidTag: rfidUid || "-",
        status: regForm.status as MemberCategory,
      });
      setRegisterDone(true);
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : "Gagal menyimpan data anggota.");
    } finally {
      setRegisterSaving(false);
    }
  };


  const scannedMember = members.find(
    (member) => member.rfidTag.replace(/\s/g, "").toUpperCase() === rfidUid
  );

  const enableNotificationSound = () => {
    if (!("speechSynthesis" in window)) {
      console.warn("Welcome speech is not supported by this browser.");
      return;
    }
    lastSpokenScanVersion.current = rfidScanVersion;
    setNotificationSoundEnabled(true);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setSignOutError(error.message);
  };

  useEffect(() => {
    if (!rfidUid || rfidScanVersion === lastProcessedScanVersion.current) return;
    lastProcessedScanVersion.current = rfidScanVersion;
    const showWelcome = window.setTimeout(() => setWelcomeVisible(true), 0);
    const hideWelcome = window.setTimeout(() => setWelcomeVisible(false), 7000);
    return () => {
      window.clearTimeout(showWelcome);
      window.clearTimeout(hideWelcome);
    };
  }, [rfidScanVersion, rfidUid]);

  useEffect(() => {
    if (!notificationSoundEnabled || !membersLoaded || !rfidUid || rfidScanVersion === lastSpokenScanVersion.current) return;
    lastSpokenScanVersion.current = rfidScanVersion;
    speakMessage(scannedMember
      ? `Selamat datang, ${scannedMember.nama}, di perpustakaan.`
      : "Maaf, Anda belum terdaftar. Silakan mendaftar.");
  }, [membersLoaded, notificationSoundEnabled, rfidScanVersion, rfidUid, scannedMember]);

  return (
    <div
      className="home-shell"
      style={{ minHeight: "100svh", display: "flex", flexDirection: "column", overflowX: "hidden", background: "#e8f2fb", fontFamily: "sans-serif", position: "relative" }}
    >
      {/* â”€â”€ Decorative SVG waves â”€â”€ */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", top: 0, right: 0, width: "50%", maxWidth: 720, opacity: 0.65, pointerEvents: "none", zIndex: 0 }}
        viewBox="0 0 720 520"
        fill="none"
      >
        <path d="M720 0H220C360 80 520 50 620 170C720 290 680 430 720 520V0Z" fill="#c3d9f2" />
      </svg>
      <svg
        aria-hidden="true"
        style={{ position: "absolute", bottom: 0, right: 0, width: "72%", maxWidth: 1100, opacity: 0.72, pointerEvents: "none", zIndex: 0 }}
        viewBox="0 0 1100 260"
        fill="none"
      >
        <path d="M0 260C200 200 450 155 700 185C900 210 1020 248 1100 260H0Z" fill="#bcd5ee" />
      </svg>

      {/* â”€â”€ HEADER â”€â”€ */}
      <header
        className="home-header"
        style={{
          position: "relative",
          zIndex: 20,
          display: "flex",
          height: 68,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(200,220,240,0.8)",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          padding: "0 clamp(16px, 4vw, 40px)",
        }}
      >
        {/* Brand Logo */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <Image
            src="/assets/logo-upa-itk.png"
            alt="UPA Perpustakaan Institut Teknologi Kalimantan"
            width={320}
            height={64}
            priority
            className="home-logo"
            style={{
              height: "auto",
              width: "clamp(200px, 22vw, 300px)",
              objectFit: "contain",
            }}
          />
        </div>

        {/* Right controls */}
        <div className="home-header-controls" style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div
            className="home-rfid-status"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              borderRadius: 999,
              padding: "6px 16px",
              fontSize: 11,
              fontWeight: 700,
              background: rfidActive && connectionStatus === "Connected" ? "#ecfdf5" : "#fffbeb",
              color: rfidActive && connectionStatus === "Connected" ? "#059669" : "#d97706",
            }}
          >
            <span
              style={{
                height: 8,
                width: 8,
                borderRadius: "50%",
                background: rfidActive && connectionStatus === "Connected" ? "#10b981" : "#f59e0b",
                animation: rfidActive && connectionStatus === "Connected" ? "pulse 2s infinite" : "none",
              }}
            />
            Sistem RFID {rfidActive && connectionStatus === "Connected" ? "Aktif" : "Menghubungkan"}
          </div>
          <button
            type="button"
            aria-pressed={notificationSoundEnabled}
            onClick={enableNotificationSound}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid #bfdbfe",
              borderRadius: 999,
              padding: "6px 12px",
              background: notificationSoundEnabled ? "#ecfdf5" : "white",
              color: notificationSoundEnabled ? "#047857" : "#1d4ed8",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Volume2 size={15} />
            {notificationSoundEnabled ? "Suara sambutan aktif" : "Aktifkan suara"}
          </button>
          <div className="home-header-divider" style={{ width: 1, height: 20, background: "#e2e8f0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "#0f2346" }}>
            <UserRound size={17} />
            <span className="home-visitor-label">Staf Perpustakaan</span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              aria-label="Keluar dari akun staf"
              title="Keluar"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #cbd5e1", borderRadius: 999, padding: "6px 10px", background: "white", color: "#334155", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >
              <LogOut size={14} />
              Keluar
            </button>
          </div>
        </div>
        {signOutError && (
          <p role="alert" style={{ position: "absolute", right: 24, top: 62, zIndex: 30, margin: 0, padding: "8px 12px", borderRadius: 8, background: "#fff1f2", color: "#be123c", fontSize: 12 }}>
            Gagal keluar: {signOutError}
          </p>
        )}
      </header>

      {/* â”€â”€ MAIN CONTENT â”€â”€ */}
      <div
        className="home-main"
        style={{
          flex: 1,
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "stretch",
          padding: "24px 40px",
          gap: 24,
          overflow: "hidden",
        }}
      >
        {/* â”€ LEFT HERO PANEL â”€ */}
        <div
          className="home-hero"
          style={{
            flex: "1 1 0%",
            position: "relative",
            borderRadius: 28,
            overflow: "hidden",
          }}
        >
          {/* Library room background */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url('/assets/background-perpustakaan.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          {/* Right-edge gradient â€” blends into page bg */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to right, rgba(232,242,251,0) 30%, rgba(232,242,251,0.45) 55%, rgba(232,242,251,0.92) 100%)",
            }}
          />

          {/* Content row inside hero */}
          <div className="home-hero-content" style={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end" }}>

            {/* Quote â€” top-left corner */}
            <div
              className="home-quote"
              style={{
                position: "absolute",
                top: 32,
                left: 24,
                transform: "rotate(-4deg)",
                userSelect: "none",
              }}
            >
              <p style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 900, fontSize: 15, lineHeight: 1.4, color: "rgba(30,50,80,0.85)" }}>
                &ldquo;Buku<br />Membuka<br />Dunia&rdquo;
              </p>
            </div>

            {/* Character illustration â€” bottom left */}
            <div className="home-illustration" style={{ position: "absolute", bottom: 0, left: 0, width: "clamp(200px, 48vw, 720px)", zIndex: 1 }}>
              <Image
                src="/assets/ilustrasi-pengunjung.png?v=2"
                alt="Pengunjung perpustakaan"
                width={607}
                height={615}
                priority
                unoptimized
                style={{
                  height: "auto",
                  width: "100%",
                  objectFit: "contain",
                  objectPosition: "bottom center",
                  display: "block",
                  filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.12))",
                }}
              />
            </div>

            {/* Hero typography â€” right side */}
            <div
              className="home-copy"
              style={{
                marginLeft: "auto",
                maxWidth: 400,
                position: "relative",
                zIndex: 2,
                alignSelf: "flex-start",
                paddingBottom: 40,
                paddingLeft: 16,
                paddingRight: 36,
                paddingTop: 56,
              }}
            >
              <h1
                style={{
                  fontSize: "clamp(28px, 3.2vw, 48px)",
                  fontWeight: 900,
                  lineHeight: 1.08,
                  letterSpacing: "-0.02em",
                  color: "#0f2346",
                  margin: 0,
                }}
              >
                Selamat Datang di{" "}
                <span style={{ color: "#1562e8" }}>Perpustakaan ITK</span>
              </h1>
              <p
                style={{
                  marginTop: 16,
                  fontSize: "clamp(13px, 1.2vw, 16px)",
                  fontWeight: 500,
                  lineHeight: 1.65,
                  color: "#64748b",
                }}
              >
                Temukan ilmu, perluas wawasan,<br />
                dan raih masa depan yang lebih baik.
              </p>
            </div>

          </div>
        </div>

        {/* â”€ RIGHT PANEL â”€ */}
        <div className="home-panel" style={{ width: "clamp(320px, 36vw, 500px)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* RFID Scanner Card */}
          <div
            className="home-scanner-card"
            style={{
              flex: "1 1 auto",
              background: "white",
              borderRadius: 24,
              padding: showForm ? "20px 24px" : "28px 32px",
              boxShadow: "0 8px 40px rgba(15,35,70,0.08)",
              display: "flex",
              flexDirection: "column",
              alignItems: showForm ? "stretch" : "center",
              justifyContent: showForm ? "flex-start" : "center",
              gap: showForm ? 0 : 20,
              textAlign: showForm ? "left" : "center",
              overflowY: showForm ? "auto" : "visible",
            }}
          >
            {showForm ? (
              registerDone ? (
                /* Success */
                <div style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "20px 0", textAlign: "center", boxSizing: "border-box" }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckCircle2 size={36} color="#059669" strokeWidth={2.5} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f2346" }}>Pendaftaran Berhasil!</h2>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                    <strong>{regForm.nama}</strong> berhasil didaftarkan.<br />Tempelkan kartu kembali untuk masuk.
                  </p>
                  <button onClick={() => { setShowForm(false); setRegisterDone(false); }} style={{ marginTop: 8, padding: "8px 20px", borderRadius: 999, background: "#0f2346", color: "white", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Kembali
                  </button>
                </div>
              ) : (
                /* Inline Register Form */
                <form onSubmit={handleRegisterSubmit} style={{ width: "100%", marginTop: 24, display: "flex", flexDirection: "column", gap: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#0f2346" }}>Daftar Anggota Baru</p>
                      <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>UID Anda: {rfidUid}</p>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Nama Lengkap <span style={{ color: "#dc2626" }}>*</span></label>
                    <input type="text" placeholder="Contoh: Ahmad Rizky Pratama" value={regForm.nama} onChange={e => setRegForm({ ...regForm, nama: e.target.value })} style={{ width: "100%", padding: "10px 13px", borderRadius: 8, border: `1.5px solid ${regErrors.nama ? "#dc2626" : "#e2e8f0"}`, fontSize: 15, color: "#0f172a", boxSizing: "border-box", outline: "none" }} />
                    {regErrors.nama && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#dc2626" }}>{regErrors.nama}</p>}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>NIM / ID Karyawan <span style={{ color: "#dc2626" }}>*</span></label>
                    <input type="text" placeholder="Contoh: 10221001" value={regForm.nim} onChange={e => setRegForm({ ...regForm, nim: e.target.value })} style={{ width: "100%", padding: "10px 13px", borderRadius: 8, border: `1.5px solid ${regErrors.nim ? "#dc2626" : "#e2e8f0"}`, fontSize: 15, color: "#0f172a", boxSizing: "border-box", outline: "none" }} />
                    {regErrors.nim && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#dc2626" }}>{regErrors.nim}</p>}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Program Studi <span style={{ color: "#dc2626" }}>*</span></label>
                    <div style={{ position: "relative" }}>
                      <select value={regForm.prodi} onChange={e => setRegForm({ ...regForm, prodi: e.target.value })} style={{ width: "100%", padding: "10px 34px 10px 13px", borderRadius: 8, border: `1.5px solid ${regErrors.prodi ? "#dc2626" : "#e2e8f0"}`, fontSize: 15, color: regForm.prodi ? "#0f172a" : "#94a3b8", appearance: "none", background: "white", boxSizing: "border-box", outline: "none", cursor: "pointer" }}>
                        <option value="" disabled>Pilih program studi...</option>
                        {PRODI_ITK.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <ChevronDown size={17} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                    </div>
                    {regErrors.prodi && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#dc2626" }}>{regErrors.prodi}</p>}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Status <span style={{ color: "#dc2626" }}>*</span></label>
                    <div style={{ display: "flex", gap: 9 }}>
                      {(["Mahasiswa", "Dosen", "Visitor"] as MemberCategory[]).map(s => (
                        <button key={s} type="button" onClick={() => setRegForm({ ...regForm, status: s })} style={{ flex: 1, minHeight: 40, padding: "8px 4px", borderRadius: 8, border: `2px solid ${regForm.status === s ? "#1562e8" : "#e2e8f0"}`, background: regForm.status === s ? "#eff6ff" : "white", color: regForm.status === s ? "#1562e8" : "#64748b", fontSize: 14, fontWeight: regForm.status === s ? 700 : 500, cursor: "pointer", transition: "all 0.15s" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                    {regErrors.status && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#dc2626" }}>{regErrors.status}</p>}
                  </div>
                  {registerError && <p role="alert" style={{ margin: 0, color: "#dc2626", fontSize: 13 }}>{registerError}</p>}
                  <button type="submit" disabled={registerSaving} style={{ marginTop: 4, minHeight: 44, padding: "11px 12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #1562e8, #0f2346)", color: "white", fontSize: 15, fontWeight: 700, cursor: registerSaving ? "wait" : "pointer", opacity: registerSaving ? 0.7 : 1, boxShadow: "0 4px 12px rgba(21,98,232,0.3)" }}>
                    {registerSaving ? "Menyimpan..." : "Daftarkan Anggota"}
                  </button>
                </form>
              )
            ) : (
              <>
                {/* RFID reader circle */}
                <div style={{ position: "relative", flexShrink: 0, width: 160, height: 160, borderRadius: "50%", background: "#ddeeff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Image src="/assets/reader-rfid.png" alt="Reader RFID" width={280} height={280} style={{ height: "auto", width: 120, objectFit: "contain" }} />
                  <div style={{ position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                    <span style={{ display: "block", height: 16, width: 5, borderRadius: 4, background: "rgba(59,130,246,0.65)" }} />
                    <span style={{ display: "block", height: 28, width: 5, borderRadius: 4, background: "#3b82f6" }} />
                  </div>
                </div>

                {/* Status text below RFID image */}
                <div style={{ width: "100%" }}>
                  {welcomeVisible && scannedMember ? (
                    <>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, background: "#d1fae5", padding: "5px 14px", fontSize: 11, fontWeight: 700, color: "#065f46" }}>
                        <CheckCircle2 size={14} /> Kunjungan Tercatat
                      </div>
                      <h2 style={{ marginTop: 14, fontSize: 24, fontWeight: 900, color: "#0f2346" }}>Hai, selamat datang</h2>
                      <p style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: "#1562e8" }}>{scannedMember.nama}</p>
                      <p style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: "#64748b" }}>di Perpustakaan ITK</p>
                      <p style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>RFID: {rfidUid}</p>
                    </>
                  ) : welcomeVisible && rfidUid && !scannedMember ? (
                    <>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, background: "#fee2e2", padding: "5px 14px", fontSize: 11, fontWeight: 700, color: "#991b1b" }}>
                        Kartu Belum Terdaftar
                      </div>
                      <h2 style={{ marginTop: 12, fontSize: 20, fontWeight: 900, color: "#0f2346" }}>Kartu tidak dikenali</h2>
                      <p style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: "#64748b" }}>
                        Kartu RFID Anda belum terdaftar sebagai anggota perpustakaan.
                      </p>
                      <button onClick={() => setShowForm(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, borderRadius: 999, background: "#dc2626", color: "white", padding: "10px 22px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(220,38,38,0.35)" }}>
                        Daftar Sekarang
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, background: "#e0f2fe", padding: "5px 14px", fontSize: 11, fontWeight: 700, color: "#0369a1" }}>
                        <UserRound size={14} /> Akses Pengunjung
                      </div>
                      <h2 style={{ marginTop: 14, fontSize: "clamp(22px, 2.4vw, 32px)", fontWeight: 900, lineHeight: 1.1, color: "#0f2346" }}>
                        Tempelkan<br />Kartu Anda
                      </h2>
                      <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.65, color: "#64748b" }}>
                        Silakan tempelkan kartu anggota pada reader untuk mengakses layanan perpustakaan.
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </div>




          {/* Feature Cards Row */}
          <div className="home-features" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, flexShrink: 0 }}>

            {/* Akses Anggota */}
            <Link
              href="/dashboard"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "14px 8px",
                background: "rgba(255,255,255,0.72)",
                borderRadius: 18,
                textDecoration: "none",
                backdropFilter: "blur(8px)",
                transition: "all 0.2s",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", height: 44, width: 44, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#dbeafe", color: "#2563eb" }}>
                <UserRound size={20} />
              </div>
              <strong style={{ marginTop: 10, display: "block", fontSize: 11, fontWeight: 700, color: "#0f2346", lineHeight: 1.3 }}>Akses Anggota</strong>
              <span style={{ marginTop: 4, display: "block", fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>Masuk dengan kartu anggota Anda</span>
            </Link>

            {/* Peminjaman Buku */}
            <Link
              href="/peminjaman"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "14px 8px",
                background: "rgba(255,255,255,0.72)",
                borderRadius: 18,
                textDecoration: "none",
                backdropFilter: "blur(8px)",
                transition: "all 0.2s",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", height: 44, width: 44, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#e0e7ff", color: "#4f46e5" }}>
                <BookOpen size={20} />
              </div>
              <strong style={{ marginTop: 10, display: "block", fontSize: 11, fontWeight: 700, color: "#0f2346", lineHeight: 1.3 }}>Peminjaman Buku</strong>
              <span style={{ marginTop: 4, display: "block", fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>Akses layanan perpustakaan</span>
            </Link>

            {/* Aman & Nyaman */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "14px 8px",
                background: "rgba(255,255,255,0.72)",
                borderRadius: 18,
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ display: "flex", height: 44, width: 44, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#d1fae5", color: "#059669" }}>
                <ShieldCheck size={20} />
              </div>
              <strong style={{ marginTop: 10, display: "block", fontSize: 11, fontWeight: 700, color: "#0f2346", lineHeight: 1.3 }}>Aman &amp; Nyaman</strong>
              <span style={{ marginTop: 4, display: "block", fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>Dengan teknologi RFID</span>
            </div>

            {/* Mari Jaga Perpustakaan */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "14px 8px",
                background: "rgba(255,255,255,0.72)",
                borderRadius: 18,
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ display: "flex", height: 44, width: 44, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#fef3c7", color: "#d97706" }}>
                <Leaf size={20} />
              </div>
              <strong style={{ marginTop: 10, display: "block", fontSize: 11, fontWeight: 700, color: "#0f2346", lineHeight: 1.3 }}>
                Mari jaga{" "}
                <span style={{ position: "relative", display: "inline-block" }}>
                  perpustakaan kita
                  <svg
                    aria-hidden="true"
                    style={{ position: "absolute", bottom: -2, left: 0, width: "100%", overflow: "visible" }}
                    height="4"
                    viewBox="0 0 100 4"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path d="M0 3.5 Q50 0.5 100 3.5" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </span>
              </strong>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

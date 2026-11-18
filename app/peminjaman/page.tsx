"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ScanLine,
  Search,
  X,
  Undo2,
} from "lucide-react";
import { useLibrary, type Book, type Loan } from "../../context/LibraryContext";

type LoanFilter = "Aktif" | "Terlambat" | "Riwayat";

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDisplayDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function parseDisplayDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return "";

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${yearText}-${monthText}-${dayText}`;
}

function formatDisplayDateEntry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatDate(value: string) {
  return toDisplayDate(value);
}

function normalizeRfid(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function getBookTagIds(book: Book) {
  const tagsById = new Map<string, string>();
  [book.rfidTag, ...(book.epcList ?? [])].forEach((tag) => {
    const tagId = normalizeRfid(tag);
    if (tagId && !tagsById.has(tagId)) tagsById.set(tagId, tag.trim());
  });
  return Array.from(tagsById.values());
}

function getAvailableBookTagIds(book: Book, activeLoans: Loan[]) {
  const activeTagIds = new Set(activeLoans.map((loan) => normalizeRfid(loan.bookTagId ?? "")).filter(Boolean));
  const hasLegacyLoanWithoutTag = activeLoans.some((loan) => loan.bookId === book.id && !loan.bookTagId);
  if (hasLegacyLoanWithoutTag) return [];
  return getBookTagIds(book).filter((tag) => !activeTagIds.has(normalizeRfid(tag)));
}

function playWarningTone() {
  try {
    const audioContext = new window.AudioContext();
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    const startTime = audioContext.currentTime;
    const pulseOffsets = [0, 0.28, 0.84, 1.12, 1.68, 1.96];

    oscillator.type = "square";
    pulseOffsets.forEach((offset, index) => {
      const pulseStart = startTime + offset;
      oscillator.frequency.setValueAtTime(index % 2 === 0 ? 988 : 784, pulseStart);
      volume.gain.setValueAtTime(0.0001, pulseStart);
      volume.gain.exponentialRampToValueAtTime(0.3, pulseStart + 0.015);
      volume.gain.setValueAtTime(0.3, pulseStart + 0.17);
      volume.gain.exponentialRampToValueAtTime(0.0001, pulseStart + 0.22);
    });
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 2.22);
    oscillator.addEventListener("ended", () => void audioContext.close(), { once: true });
  } catch {
    return;
  }
}

function playVerifiedTone() {
  try {
    const audioContext = new window.AudioContext();
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    const startTime = audioContext.currentTime;

    oscillator.type = "sine";
    [1318, 1760].forEach((frequency, index) => {
      const toneStart = startTime + index * 0.14;
      oscillator.frequency.setValueAtTime(frequency, toneStart);
      volume.gain.setValueAtTime(0.0001, toneStart);
      volume.gain.exponentialRampToValueAtTime(0.18, toneStart + 0.015);
      volume.gain.setValueAtTime(0.18, toneStart + 0.09);
      volume.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.13);
    });
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.28);
    oscillator.addEventListener("ended", () => void audioContext.close(), { once: true });
  } catch {
    return;
  }
}

export default function PeminjamanPage() {
  const { members, books, loans, borrowBook, returnBook, rfidUid, rfidScanVersion, connectionStatus } = useLibrary();
  const today = toDateInputValue(new Date());
  const tomorrowDate = new Date(`${today}T00:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const firstDueDate = toDateInputValue(tomorrowDate);
  const maximumDueDate = new Date(`${today}T00:00:00`);
  maximumDueDate.setDate(maximumDueDate.getDate() + 7);
  const lastDueDate = toDateInputValue(maximumDueDate);
  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 7);

  const [memberId, setMemberId] = useState("");
  const [bookId, setBookId] = useState("");
  const [bookTagId, setBookTagId] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [bookQuery, setBookQuery] = useState("");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [bookSearchOpen, setBookSearchOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanResult, setScanResult] = useState<"idle" | "success" | "error">("idle");
  const lastProcessedScanVersion = useRef(rfidScanVersion);
  const [dueAtText, setDueAtText] = useState(toDisplayDate(toDateInputValue(defaultDue)));
  const dueAt = parseDisplayDate(dueAtText);
  const [filter, setFilter] = useState<LoanFilter>("Aktif");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedGateTargetKey, setSelectedGateTargetKey] = useState("");
  const [gateAlert, setGateAlert] = useState<{
    type: "warning" | "verified";
    bookTitle: string;
    tag: string;
    detectedAt: string;
  } | null>(null);

  const activeLoans = loans.filter((loan) => loan.status === "Dipinjam");
  const overdueLoans = activeLoans.filter((loan) => loan.dueAt < today);
  const memberActiveLoan = activeLoans.find((loan) => loan.memberId === memberId);
  const availableBooks = books.filter((book) => book.stok > 0 && book.status !== "Dalam Perawatan");
  const selectedBook = books.find((book) => book.id === bookId);
  const availableBookTagIds = selectedBook ? getAvailableBookTagIds(selectedBook, activeLoans) : [];
  const taggedBookTargets = useMemo(() => books.flatMap((book) => {
    return getBookTagIds(book).map((tag) => ({ book, tag, key: `${book.id}::${tag}` }));
  }), [books]);
  const selectedGateTarget = taggedBookTargets.find((target) => target.key === selectedGateTargetKey);
  const matchingMembers = useMemo(() => {
    const query = memberQuery.trim().toLocaleLowerCase("id-ID");
    if (!query) return [];
    return members.filter((member) =>
      [member.nama, member.nim, member.prodi, member.rfidTag]
        .some((value) => value.toLocaleLowerCase("id-ID").includes(query))
    ).slice(0, 8);
  }, [memberQuery, members]);
  const matchingBooks = useMemo(() => {
    const query = bookQuery.trim().toLocaleLowerCase("id-ID");
    if (!query) return [];
    return books.filter((book) =>
      [book.judul, book.isbn, book.pengarang, book.kategori, book.rfidTag, ...(book.epcList ?? [])]
        .some((value) => value.toLocaleLowerCase("id-ID").includes(query))
    ).slice(0, 8);
  }, [books, bookQuery]);

  useEffect(() => {
    if (!rfidUid || rfidScanVersion === lastProcessedScanVersion.current) return;

    const timeoutId = window.setTimeout(() => {
      if (rfidScanVersion === lastProcessedScanVersion.current) return;
      lastProcessedScanVersion.current = rfidScanVersion;

      const scannedTag = normalizeRfid(rfidUid);
      const matchedMember = members.find((member) => normalizeRfid(member.rfidTag) === scannedTag);
      if (matchedMember) {
        setMemberId(matchedMember.id);
        setMemberQuery(`${matchedMember.nama} · ${matchedMember.nim}`);
        setMemberSearchOpen(false);
        setBookSearchOpen(false);
        setScanMessage(`Anggota ${matchedMember.nama} berhasil dipindai.`);
        setScanResult("success");
        return;
      }

      const matchedBook = books.find((book) => getBookTagIds(book).some((tag) => normalizeRfid(tag) === scannedTag));
      if (matchedBook) {
        const matchedTag = getBookTagIds(matchedBook).find((tag) => normalizeRfid(tag) === scannedTag);
        const tagHasActiveLoan = activeLoans.some((loan) => normalizeRfid(loan.bookTagId ?? "") === scannedTag);
        if (tagHasActiveLoan || matchedBook.stok < 1 || matchedBook.status === "Dalam Perawatan") {
          setScanMessage(`ID tag ${matchedTag ?? rfidUid} sudah dipinjam atau tidak tersedia.`);
          setScanResult("error");
          return;
        }
        setBookId(matchedBook.id);
        setBookTagId(matchedTag ?? "");
        setBookQuery(matchedBook.judul);
        setBookSearchOpen(false);
        setMemberSearchOpen(false);
        setScanMessage(`Buku "${matchedBook.judul}" berhasil dipindai.`);
        setScanResult("success");
        return;
      }

      setScanMessage(`Tag ${rfidUid} belum terdaftar sebagai anggota atau buku tersedia.`);
      setScanResult("error");
      setGateAlert({
        type: "warning",
        bookTitle: "Tag tidak dikenal",
        tag: rfidUid,
        detectedAt: new Date().toLocaleTimeString("id-ID"),
      });
      playWarningTone();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeLoans, books, members, rfidScanVersion, rfidUid]);

  const visibleLoans = useMemo(() => {
    const filtered = loans.filter((loan) => {
      if (filter === "Aktif") return loan.status === "Dipinjam" && loan.dueAt >= today;
      if (filter === "Terlambat") return loan.status === "Dipinjam" && loan.dueAt < today;
      return loan.status === "Dikembalikan";
    });
    const query = search.trim().toLocaleLowerCase("id-ID");
    if (!query) return filtered;
    return filtered.filter((loan) =>
      [loan.memberName, loan.memberNim, loan.bookTitle, loan.bookIsbn]
        .some((value) => value.toLocaleLowerCase("id-ID").includes(query))
    );
  }, [filter, loans, search, today]);

  const handleBorrow = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!memberId || !bookId) {
      setError("Pilih anggota dan buku terlebih dahulu.");
      return;
    }
    if (!bookTagId) {
      setError("Pilih atau pindai ID tag EPC buku yang akan dipinjam.");
      return;
    }
    if (memberActiveLoan) {
      setError(`Anggota masih meminjam "${memberActiveLoan.bookTitle}". Proses pengembalian buku tersebut sebelum meminjam judul lain.`);
      return;
    }
    if (!dueAt) {
      setError("Masukkan tanggal valid dengan format DD/MM/YYYY.");
      return;
    }
    if (dueAt < firstDueDate || dueAt > lastDueDate) {
      setError("Tanggal jatuh tempo harus dalam rentang 1 sampai 7 hari.");
      return;
    }

    setBusy(true);
    try {
      const storage = await borrowBook(memberId, bookId, bookTagId, dueAt);
      const selectedBook = books.find((book) => book.id === bookId);
      setNotice(storage === "local"
        ? `Peminjaman ${selectedBook?.judul ?? "buku"} tersimpan di browser ini untuk uji coba. Belum terkirim ke database.`
        : `Peminjaman ${selectedBook?.judul ?? "buku"} berhasil dicatat.`);
      setBookId("");
      setBookTagId("");
      setBookQuery("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Peminjaman gagal diproses.");
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = async (loanId: string) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const storage = await returnBook(loanId);
      setNotice(storage === "local"
        ? "Pengembalian tersimpan di browser ini untuk uji coba. Stok lokal sudah diperbarui, tetapi belum tersinkron ke database."
        : "Pengembalian berhasil dicatat dan stok buku telah diperbarui.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Pengembalian gagal diproses.");
    } finally {
      setBusy(false);
    }
  };

  const simulateUhfExit = () => {
    if (!selectedGateTarget) return;
    const targetTagId = normalizeRfid(selectedGateTarget.tag);
    const tagIsVerified = activeLoans.some((loan) => normalizeRfid(loan.bookTagId ?? "") === targetTagId);
    setGateAlert({
      type: tagIsVerified ? "verified" : "warning",
      bookTitle: selectedGateTarget.book.judul,
      tag: selectedGateTarget.tag,
      detectedAt: new Date().toLocaleTimeString("id-ID"),
    });
    if (tagIsVerified) {
      playVerifiedTone();
    } else {
      playWarningTone();
    }
  };

  const filters: LoanFilter[] = ["Aktif", "Terlambat", "Riwayat"];

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold uppercase text-slate-800">Peminjaman Buku</h1>
            <p className="mt-1 text-xs text-slate-500">Catat peminjaman, pantau tenggat, dan proses pengembalian.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
          <CalendarDays className="h-4 w-4 text-blue-600" />
          Hari ini, {formatDate(today)}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Ringkasan peminjaman">
        <Summary icon={<BookOpen className="h-5 w-5" />} label="Pinjaman aktif" value={activeLoans.length} tone="blue" />
        <Summary icon={<Clock3 className="h-5 w-5" />} label="Terlambat" value={overdueLoans.length} tone="rose" />
        <Summary icon={<CheckCircle2 className="h-5 w-5" />} label="Buku tersedia" value={availableBooks.reduce((total, book) => total + book.stok, 0)} tone="emerald" />
      </section>

      <section className="rounded-xl border border-amber-300 bg-amber-50/70 p-4" aria-labelledby="uhf-test-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-700">
              <ScanLine className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="uhf-test-title" className="text-sm font-bold text-slate-900">Simulasi gate keluar UHF</h2>
                <span className="rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Uji coba</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">Alarm mencocokkan EPC/ID tag yang tersimpan di transaksi aktif. ID berbeda pada judul sama tetap dianggap belum dipinjam.</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Transaksi lama tanpa EPC tidak bisa diverifikasi per eksemplar. Simulasi ini belum terhubung ke gate UHF fisik.</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-80 sm:flex-row">
            <select
              aria-label="Pilih tag buku untuk simulasi keluar"
              value={selectedGateTargetKey}
              onChange={(event) => setSelectedGateTargetKey(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            >
              <option value="">Pilih buku bertag UHF/EPC</option>
              {taggedBookTargets.map((target) => (
                <option key={target.key} value={target.key}>{target.book.judul} · {target.tag}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!selectedGateTarget}
                onClick={simulateUhfExit}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                Simulasikan keluar
              </button>
            </div>
          </div>
        </div>
        {taggedBookTargets.length === 0 && <p className="mt-3 text-xs font-medium text-amber-800">Belum ada tag buku terdaftar untuk diuji.</p>}
      </section>

      {gateAlert && (
        <div
          role={gateAlert.type === "warning" ? "alert" : "status"}
          aria-live={gateAlert.type === "warning" ? "assertive" : "polite"}
          className={`fixed right-4 top-20 z-50 flex w-[calc(100vw-2rem)] max-w-lg items-start gap-4 rounded-xl border p-5 shadow-lg ${gateAlert.type === "warning" ? "border-rose-300 bg-rose-50 text-rose-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`}
        >
          {gateAlert.type === "warning" ? <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-700" /> : <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />}
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold">{gateAlert.type === "warning" ? "PERINGATAN: ID tag belum tercatat dipinjam" : "ID tag terdaftar pada pinjaman"}</p>
            <p className="mt-1 break-words text-sm leading-6">{gateAlert.bookTitle} · Tag {gateAlert.tag} terdeteksi keluar pukul {gateAlert.detectedAt}. {gateAlert.type === "warning" ? "Tidak ditemukan transaksi aktif untuk ID tag ini." : "ID tag ini tercatat pada transaksi aktif."}</p>
          </div>
          <button type="button" aria-label="Tutup notifikasi simulasi" onClick={() => setGateAlert(null)} className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-current/70 hover:bg-black/5 hover:text-current">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {(error || notice) && (
        <div role={error ? "alert" : "status"} className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{error || notice}</span>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <form onSubmit={handleBorrow} className="h-fit rounded-xl border border-slate-200 bg-white p-6 shadow-sm 2xl:p-7">
          <div className="mb-6 flex items-center gap-4 border-b border-slate-100 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <ArrowUpRight className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Transaksi peminjaman</h2>
              <p className="mt-1 text-sm text-slate-500">Maksimal 1 buku aktif per anggota</p>
            </div>
          </div>

          {memberActiveLoan && (
            <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <p className="font-bold">Pengembalian diperlukan sebelum pinjam lagi</p>
              <p className="mt-1">{memberActiveLoan.bookTitle} · jatuh tempo {formatDate(memberActiveLoan.dueAt)}</p>
            </div>
          )}

          <div className="my-5 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
                  <ScanLine className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">Scan Kartu</p>
                  <p className="mt-0.5 text-xs text-slate-500">Reader {connectionStatus === "Connected" ? "terhubung" : connectionStatus === "Connecting..." ? "menghubungkan" : "tidak terhubung"}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700">
                Tempelkan Kartu ID
              </span>
            </div>
            {scanMessage && <p aria-live="polite" className={`mt-3 text-xs ${scanResult === "error" ? "text-rose-700" : scanResult === "success" ? "text-emerald-700" : "text-blue-700"}`}>{scanMessage}</p>}
          </div>

          <div className="relative mb-4" onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setMemberSearchOpen(false);
          }}>
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="loan-member">Anggota</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="loan-member"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={memberSearchOpen}
                aria-controls="loan-member-results"
                autoComplete="off"
                value={memberQuery}
                onFocus={() => {
                  setMemberSearchOpen(true);
                  setBookSearchOpen(false);
                }}
                onChange={(event) => {
                  setMemberQuery(event.target.value);
                  setMemberId("");
                  setMemberSearchOpen(true);
                }}
                placeholder="Cari nama, NIM, atau UID anggota"
                className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-10 text-base text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {memberQuery && <button type="button" aria-label="Hapus pencarian anggota" onClick={() => {
                setMemberId("");
                setMemberQuery("");
                setMemberSearchOpen(true);
                setBookSearchOpen(false);
              }} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>}
            </div>
            {memberSearchOpen && (
              <div id="loan-member-results" role="listbox" aria-label="Hasil pencarian anggota" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {!memberQuery.trim() ? <p className="px-4 py-3 text-sm text-slate-500">Ketik nama, NIM, prodi, atau UID RFID.</p> : matchingMembers.length === 0 ? <p className="px-4 py-3 text-sm text-slate-500">Anggota tidak ditemukan.</p> : matchingMembers.map((member) => (
                  <button key={member.id} type="button" role="option" aria-selected={member.id === memberId} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                    setMemberId(member.id);
                    setMemberQuery(`${member.nama} · ${member.nim}`);
                    setMemberSearchOpen(false);
                  }} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50">
                    <span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-800">{member.nama}</span><span className="mt-1 block truncate text-xs text-slate-500">{member.nim} · {member.prodi}</span></span>
                    <span className="shrink-0 rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{member.status}</span>
                  </button>
                ))}
                {matchingMembers.length === 8 && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">Menampilkan 8 hasil pertama. Perjelas kata kunci untuk hasil lain.</p>}
              </div>
            )}
          </div>

          <div className="relative mb-4" onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setBookSearchOpen(false);
          }}>
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="loan-book">Buku</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="loan-book"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={bookSearchOpen}
                aria-controls="loan-book-results"
                autoComplete="off"
                value={bookQuery}
                onFocus={() => {
                  setBookSearchOpen(true);
                  setMemberSearchOpen(false);
                }}
                onChange={(event) => {
                  setBookQuery(event.target.value);
                  setBookId("");
                  setBookTagId("");
                  setBookSearchOpen(true);
                }}
                placeholder="Cari judul, ISBN, atau pengarang"
                className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-10 text-base text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {bookQuery && <button type="button" aria-label="Hapus pencarian buku" onClick={() => {
                setBookId("");
                setBookTagId("");
                setBookQuery("");
                setBookSearchOpen(true);
                setMemberSearchOpen(false);
              }} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>}
            </div>
            {bookSearchOpen && (
              <div id="loan-book-results" role="listbox" aria-label="Hasil pencarian katalog buku" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {!bookQuery.trim() ? <p className="px-4 py-3 text-sm text-slate-500">Ketik judul, ISBN, atau pengarang.</p> : matchingBooks.length === 0 ? <p className="px-4 py-3 text-sm text-slate-500">Buku tidak ditemukan.</p> : matchingBooks.map((book) => {
                  const availableTagIds = getAvailableBookTagIds(book, activeLoans);
                  const canBorrowBook = book.stok > 0 && book.status !== "Dalam Perawatan" && availableTagIds.length > 0;
                  const availabilityLabel = book.status === "Dalam Perawatan" ? "Dalam perawatan" : canBorrowBook ? `Stok ${book.stok}` : book.stok < 1 ? "Stok tidak tersedia" : "EPC sedang dipinjam";
                  return <button key={book.id} type="button" role="option" aria-selected={book.id === bookId} aria-disabled={!canBorrowBook} disabled={!canBorrowBook} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                    setBookId(book.id);
                    setBookTagId(availableTagIds[0] ?? "");
                    setBookQuery(book.judul);
                    setBookSearchOpen(false);
                  }} className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${canBorrowBook ? "hover:bg-blue-50" : "cursor-not-allowed bg-slate-50"}`}>
                    <span className="min-w-0"><span className={`block truncate text-sm font-bold ${canBorrowBook ? "text-slate-800" : "text-slate-500"}`}>{book.judul}</span><span className="mt-1 block truncate text-xs text-slate-500">{book.isbn} · {book.pengarang || "Pengarang tidak dicantumkan"}</span></span>
                    <span className={`shrink-0 rounded px-2.5 py-1 text-xs font-semibold ${canBorrowBook ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{availabilityLabel}</span>
                  </button>;
                })}
                {matchingBooks.length === 8 && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">Menampilkan 8 hasil pertama. Perjelas kata kunci untuk hasil lain.</p>}
              </div>
            )}
          </div>

          {bookId && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="loan-book-tag">ID Tag UHF / EPC</label>
              <select
                id="loan-book-tag"
                required
                value={bookTagId}
                onChange={(event) => setBookTagId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Pilih ID tag eksemplar</option>
                {availableBookTagIds.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">Alarm keluar akan diverifikasi berdasarkan ID tag ini, bukan judul buku.</p>
              {availableBookTagIds.length === 0 && <p className="mt-1 text-xs font-medium text-rose-700">Tidak ada ID tag tersedia untuk buku ini.</p>}
            </div>
          )}

          <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="loan-due-date">Jatuh tempo</label>
          <input
            id="loan-due-date"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="DD/MM/YYYY"
            maxLength={10}
            required
            value={dueAtText}
            onChange={(event) => setDueAtText(formatDisplayDateEntry(event.target.value))}
            aria-describedby="loan-due-date-hint"
            className="mb-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <p id="loan-due-date-hint" className="mb-5 text-xs text-slate-500">Format DD/MM/YYYY · masa pinjam 1 minggu</p>

          <button type="submit" disabled={busy || !memberId || !bookId || Boolean(memberActiveLoan) || members.length === 0 || availableBooks.length === 0} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
            <ArrowUpRight className="h-5 w-5" />
            {busy ? "Memproses..." : "Catat peminjaman"}
          </button>
          {(members.length === 0 || books.length === 0) && <p className="mt-3 text-sm leading-6 text-amber-700">Daftarkan anggota dan koleksi buku sebelum membuat transaksi.</p>}
        </form>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 2xl:p-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Daftar transaksi</h2>
              <p className="mt-1 text-sm text-slate-500">{visibleLoans.length} transaksi ditampilkan</p>
            </div>
            <label className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2.5 sm:max-w-80">
              <Search className="h-5 w-5 shrink-0 text-slate-400" />
              <input aria-label="Cari anggota atau buku" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari anggota atau buku" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </label>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-5 pt-4">
            {filters.map((item) => (
              <button key={item} type="button" onClick={() => setFilter(item)} className={`whitespace-nowrap border-b-2 px-4 pb-3 text-sm font-bold transition-colors ${filter === item ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                {item}{item === "Terlambat" && overdueLoans.length > 0 ? ` (${overdueLoans.length})` : ""}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-bold">Anggota / Buku</th>
                  <th className="px-5 py-4 font-bold">Dipinjam</th>
                  <th className="px-5 py-4 font-bold">Jatuh tempo</th>
                  <th className="px-5 py-4 font-bold">Status</th>
                  <th className="px-5 py-4 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleLoans.map((loan) => {
                  const isOverdue = loan.status === "Dipinjam" && loan.dueAt < today;
                  return (
                    <tr key={loan.id} className="align-top hover:bg-slate-50/70">
                      <td className="max-w-80 px-5 py-4">
                        <p className="truncate font-bold text-slate-800">{loan.memberName}</p>
                        <p className="mt-1 text-xs text-slate-500">{loan.memberNim}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-700">{loan.bookTitle}</p>
                        <p className="mt-1 text-xs text-slate-400">ISBN {loan.bookIsbn}</p>
                        <p className="mt-1 text-xs text-slate-500">EPC {loan.bookTagId ?? "belum tercatat"}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(loan.borrowedAt)}</td>
                      <td className={`whitespace-nowrap px-5 py-4 ${isOverdue ? "font-bold text-rose-700" : "text-slate-600"}`}>{formatDate(loan.dueAt)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold ${loan.status === "Dikembalikan" ? "bg-emerald-50 text-emerald-700" : isOverdue ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>
                          {loan.status === "Dikembalikan" ? "Dikembalikan" : isOverdue ? "Terlambat" : "Dipinjam"}
                        </span>
                        {loan.returnedAt && <p className="mt-1 text-xs text-slate-400">{formatDate(loan.returnedAt)}</p>}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {loan.status === "Dipinjam" && (
                          <button type="button" disabled={busy} onClick={() => void handleReturn(loan.id)} className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50">
                            <Undo2 className="h-4 w-4" /> Kembalikan
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visibleLoans.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-16 text-center text-base text-slate-400">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100"><ArrowDownLeft className="h-5 w-5" /></div>
                    Belum ada transaksi pada kategori ini.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}

function Summary({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "blue" | "rose" | "emerald" }) {
  const colors = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${colors[tone]}`}>{icon}</div>
      <div>
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
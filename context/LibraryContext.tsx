"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getRfidStatus, getRfidUid } from "../lib/rfid";
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

const normalizeRfid = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase();

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
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
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

  const requireSupabase = () => {
    if (!supabase) {
      throw new Error("Supabase belum dikonfigurasi. Periksa URL dan publishable key di file .env.");
    }
    return supabase;
  };

  const mapMemberFromDb = (row: Record<string, unknown>): Member => ({
    id: String(row.id ?? ""),
    nim: String(row.nim ?? ""),
    nama: String(row.nama ?? ""),
    prodi: String(row.prodi ?? ""),
    email: String(row.email ?? ""),
    noHp: String(row.no_hp ?? row.noHp ?? ""),
    rfidTag: String(row.rfid_tag ?? row.rfidTag ?? ""),
    status: String(row.status ?? "") as MemberCategory,
    dateRegistered: String(row.date_registered ?? row.dateRegistered ?? ""),
  });

  const mapBookFromDb = (row: Record<string, unknown>): Book => ({
    id: String(row.id ?? ""),
    isbn: String(row.isbn ?? ""),
    judul: String(row.judul ?? ""),
    pengarang: String(row.pengarang ?? ""),
    penerbit: String(row.penerbit ?? ""),
    kategori: String(row.kategori ?? ""),
    lokasiRak: String(row.lokasi_rak ?? row.lokasiRak ?? ""),
    rfidTag: String(row.rfid_tag ?? row.rfidTag ?? ""),
    epcList: Array.isArray(row.epc_list) ? row.epc_list.map((item) => String(item)) : Array.isArray(row.epcList) ? row.epcList.map((item) => String(item)) : [],
    status: String(row.status ?? "") as Book["status"],
    stok: Number(row.stok ?? 0),
  });

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

  const mapMemberToDb = (member: Member) => ({
    id: member.id,
    nim: member.nim,
    nama: member.nama,
    prodi: member.prodi,
    email: member.email,
    no_hp: member.noHp,
    rfid_tag: member.rfidTag,
    status: member.status,
    date_registered: member.dateRegistered,
  });

  const mapBookToDb = (book: Book) => ({
    id: book.id,
    isbn: book.isbn,
    judul: book.judul,
    pengarang: book.pengarang,
    penerbit: book.penerbit,
    kategori: book.kategori,
    lokasi_rak: book.lokasiRak,
    rfid_tag: book.rfidTag,
    epc_list: book.epcList ?? [],
    status: book.status,
    stok: book.stok,
  });

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

      setMembers((membersResponse.data ?? []).map((row) => mapMemberFromDb(row as Record<string, unknown>)));
      setBooks((booksResponse.data ?? []).map((row) => mapBookFromDb(row as Record<string, unknown>)));
      setVisitorLogs((visitorLogsResponse.data ?? []).map((row) => mapVisitorLogFromDb(row as Record<string, unknown>)).slice(0, 100));
      setBookLogs((bookLogsResponse.data ?? []).map((row) => mapBookLogFromDb(row as Record<string, unknown>)));
      setActivities((activitiesResponse.data ?? []).map((row) => mapActivityFromDb(row as Record<string, unknown>)));
      setRssiHistory((rssiResponse.data ?? []).map((row) => ({
        id: Number(row.id),
        time: String(row.time ?? ""),
        rssi: Number(row.rssi ?? 0),
        label: String(row.label ?? ""),
      })));
      setLoans((loansResponse.data ?? []).map((row) => mapLoanFromDb(row as Record<string, unknown>)));
      setDatabaseError(null);
      setMembersLoaded(true);
    } catch (error) {
      setMembers([]);
      setBooks([]);
      setLoans([]);
      setVisitorLogs([]);
      setBookLogs([]);
      setActivities([]);
      setRssiHistory([]);
      setDatabaseError(error instanceof Error ? error.message : String(error));
      setMembersLoaded(true);
      console.warn("Failed to load Supabase library data:", error);
    }
  };

  const persistMemberToSupabase = async (member: Member) => {
    const client = requireSupabase();

    const { error } = await client.from("members").upsert(mapMemberToDb(member), { onConflict: "id" });
    if (error) throw error;
    setDatabaseError(null);
  };

  const persistBookToSupabase = async (book: Book) => {
    const client = requireSupabase();

    const { error } = await client.from("books").upsert(mapBookToDb(book), { onConflict: "id" });
    if (error) throw error;
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
    const timer = window.setTimeout(() => void loadSupabaseData(), 0);
    return () => window.clearTimeout(timer);
  }, []);

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
        setPendingVisitorScans((previous) => [...previous, {
          id: globalThis.crypto.randomUUID(),
          uid: detectedUid,
          scannedAt: new Date().toISOString(),
        }].slice(-16));
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
  }, [rfidActive]);

  useEffect(() => {
    if (!membersLoaded || pendingVisitorScans.length === 0) return;

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
  }, [members, membersLoaded, pendingVisitorScans, reportBackgroundDatabaseError]);

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
    await persistMemberToSupabase(newMember);
    setMembers((prev) => [newMember, ...prev]);

    const newActivity: Activity = {
      id: `ACT_${globalThis.crypto.randomUUID()}`,
      waktu: new Date().toTimeString().substring(0, 5),
      deskripsi: `Anggota baru terdaftar: ${newMember.nama} (${newMember.nim})`,
      tipe: "member",
      iconType: "user",
    };
    setActivities((prev) => [newActivity, ...prev]);
    void persistActivityToSupabase(newActivity).catch((error) => reportBackgroundDatabaseError("Gagal menyimpan aktivitas", error));
  };

  const updateMember = async (id: string, updatedData: Partial<Member>) => {
    const currentMember = members.find((member) => member.id === id);
    if (!currentMember) throw new Error("Data anggota tidak ditemukan.");
    const updatedMember = { ...currentMember, ...updatedData };
    await persistMemberToSupabase(updatedMember);
    setMembers((prev) => prev.map((member) => member.id === id ? updatedMember : member));
    const newActivity: Activity = {
      id: `ACT_${globalThis.crypto.randomUUID()}`,
      waktu: new Date().toTimeString().substring(0, 5),
      deskripsi: `Data anggota diperbarui: ID ${id}`,
      tipe: "member",
      iconType: "user",
    };
    setActivities((prev) => [newActivity, ...prev]);
    void persistActivityToSupabase(newActivity).catch((error) => reportBackgroundDatabaseError("Gagal menyimpan aktivitas", error));
  };

  const deleteMember = async (id: string) => {
    const client = requireSupabase();
    const { error } = await client.from("members").delete().eq("id", id);
    if (error) throw error;
    setDatabaseError(null);
    setMembers((prev) => prev.filter((member) => member.id !== id));
  };

  const addBook = async (bookData: Omit<Book, "id">) => {
    const newBook: Book = {
      ...bookData,
      id: `B_${globalThis.crypto.randomUUID()}`,
    };
    await persistBookToSupabase(newBook);
    setBooks((prev) => [newBook, ...prev]);

    const newActivity: Activity = {
      id: `ACT_${globalThis.crypto.randomUUID()}`,
      waktu: new Date().toTimeString().substring(0, 5),
      deskripsi: `Buku baru didaftarkan: ${newBook.judul} [${newBook.lokasiRak}]`,
      tipe: "book",
      iconType: "book",
    };
    setActivities((prev) => [newActivity, ...prev]);
    void persistActivityToSupabase(newActivity).catch((error) => reportBackgroundDatabaseError("Gagal menyimpan aktivitas", error));
  };

  const updateBook = async (id: string, updatedData: Partial<Book>) => {
    const currentBook = books.find((book) => book.id === id);
    if (!currentBook) throw new Error("Data buku tidak ditemukan.");
    const updatedBook = { ...currentBook, ...updatedData };
    await persistBookToSupabase(updatedBook);
    setBooks((prev) => prev.map((book) => book.id === id ? updatedBook : book));
    const newActivity: Activity = {
      id: `ACT_${Date.now()}`,
      waktu: new Date().toTimeString().substring(0, 5),
      deskripsi: `Data buku diperbarui: ID ${id}`,
      tipe: "book",
      iconType: "book",
    };
    setActivities((prev) => [newActivity, ...prev]);
    void persistActivityToSupabase(newActivity).catch((error) => reportBackgroundDatabaseError("Gagal menyimpan aktivitas", error));
  };

  const deleteBook = async (id: string) => {
    const client = requireSupabase();
    const { error } = await client.from("books").delete().eq("id", id);
    if (error) throw error;
    setDatabaseError(null);
    setBooks((prev) => prev.filter((book) => book.id !== id));
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

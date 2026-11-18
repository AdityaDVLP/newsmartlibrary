"use client";

import React, { useState } from "react";
import {
  BookPlus,
  Search,
  Trash2,
  Radio,
  BookOpen,
  Filter,
  Layers,
  MapPin,
  Eye,
  Pencil,
  X,
  Barcode,
  BookCheck,
  Plus,
  Minus,
  Tag,
  Package,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Download,
} from "lucide-react";
import { useLibrary, Book } from "../../../context/LibraryContext";
import ExportModal, { ExportColumn } from "../../../components/ExportModal";

export default function PendaftaranBukuPage() {
  const { books, addBook, updateBook, deleteBook } = useLibrary();

  // Form states (Add)
  const [isbn, setIsbn] = useState("");
  const [judul, setJudul] = useState("");
  const [pengarang, setPengarang] = useState("");
  const [penerbit, setPenerbit] = useState("");
  const [kategori, setKategori] = useState("Komputer & Teknologi");
  const [lokasiRak, setLokasiRak] = useState("Rak A-01");
  const [rfidTag, setRfidTag] = useState("");
  const [epcList, setEpcList] = useState<string[]>([]);
  const [newEpcInput, setNewEpcInput] = useState("");
  const [stok, setStok] = useState(1);

  // Lock & Validation States (Per-Eksemplar)
  const [lockedEpcs, setLockedEpcs] = useState<boolean[]>([false]);
  const [epcError, setEpcError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("Semua");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [crudError, setCrudError] = useState("");
  const [saving, setSaving] = useState(false);

  // Export Modal State
  const [exportModalConfig, setExportModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    filenamePrefix: string;
    columns: ExportColumn[];
    data: any[];
  } | null>(null);

  const bookCatalogExportColumns: ExportColumn[] = [
    { header: "ISBN", key: "isbn" },
    { header: "JUDUL BUKU", key: "judul" },
    { header: "PENGARANG", key: "pengarang" },
    { header: "PENERBIT", key: "penerbit" },
    { header: "KATEGORI", key: "kategori" },
    { header: "LOKASI RAK", key: "lokasiRak" },
    { header: "JUMLAH STOK (EKSEMPLAR)", key: "stok", formatter: (val) => `${val} Eksemplar` },
    { header: "TAG RFID UTAMA (BASE EPC)", key: "rfidTag" },
    {
      header: "DAFTAR EPC ALL COPIES",
      key: "epcList",
      formatter: (val, row) => (val && val.length > 0 ? val.join(" | ") : row.rfidTag),
    },
    { header: "STATUS KOLEKSI", key: "status" },
  ];

  const generateRandomEpc = (basePrefix = "E280") => {
    const randomHex = () =>
      Math.floor(Math.random() * 65536)
        .toString(16)
        .toUpperCase()
        .padStart(4, "0");
    return `${basePrefix} ${randomHex()} ${randomHex()}`;
  };

  // Adjust stock directly in table (+1 or -1)
  const handleAdjustStock = async (book: Book, delta: number) => {
    const currentEpcs = book.epcList && book.epcList.length > 0 ? [...book.epcList] : [book.rfidTag];
    const newStok = Math.max(0, book.stok + delta);

    if (delta > 0) {
      const basePrefix = book.rfidTag.split("-")[0];
      const newTag = `${basePrefix}-${String(newStok).padStart(2, "0")}`;
      currentEpcs.push(newTag);
    } else if (delta < 0 && currentEpcs.length > 1) {
      currentEpcs.pop();
    }

    setCrudError("");
    try {
      await updateBook(book.id, {
        stok: newStok,
        epcList: currentEpcs,
        status: newStok === 0 ? "Dipinjam" : "Tersedia",
      });
    } catch (error) {
      setCrudError(error instanceof Error ? error.message : "Gagal memperbarui stok buku.");
    }
  };

  // Per-Eksemplar EPC Helpers
  const handleUpdateSingleEpc = (index: number, newEpc: string) => {
    setEpcError(null);
    setEpcList((prev) => {
      const next = [...prev];
      next[index] = newEpc;
      return next;
    });
    setLockedEpcs((prev) => {
      const next = [...prev];
      next[index] = false;
      return next;
    });
  };

  const handleScanSingleEpc = (index: number) => {
    setEpcError(null);
    const scannedTag = generateRandomEpc();
    setEpcList((prev) => {
      const next = [...prev];
      next[index] = scannedTag;
      return next;
    });
    setLockedEpcs((prev) => {
      const next = [...prev];
      next[index] = false;
      return next;
    });
  };

  const handleLockSingleEpc = (index: number, currentBookId?: string, listToValidate?: string[]) => {
    setEpcError(null);
    const targetEpcs = listToValidate || epcList;
    const targetEpc = (targetEpcs[index] || "").trim();

    if (!targetEpc) {
      setEpcError(`⚠️ Tag EPC untuk Eksemplar #${index + 1} belum diisi/discan!`);
      return false;
    }

    // 1. Check duplicate within current form list
    const duplicateIndex = targetEpcs.findIndex((e, i) => i !== index && e.trim() === targetEpc);
    if (duplicateIndex !== -1) {
      setEpcError(`❌ Tag EPC "${targetEpc}" pada Eksemplar #${index + 1} terduplikat dengan Eksemplar #${duplicateIndex + 1}!`);
      return false;
    }

    // 2. Check duplicate with catalog books
    const existingBook = books.find(
      (b) =>
        b.id !== currentBookId &&
        ((b.epcList && b.epcList.includes(targetEpc)) || b.rfidTag === targetEpc)
    );

    if (existingBook) {
      setEpcError(
        `❌ Tag EPC "${targetEpc}" sudah terdaftar pada buku "${existingBook.judul}". Mohon gunakan tag EPC lain agar data tidak terdouble!`
      );
      return false;
    }

    setLockedEpcs((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    return true;
  };

  const handleUnlockSingleEpc = (index: number) => {
    setLockedEpcs((prev) => {
      const next = [...prev];
      next[index] = false;
      return next;
    });
    setEpcError(null);
  };

  // Stock Change for Add Modal
  const handleStokChange = (val: number) => {
    setEpcError(null);
    const newCount = Math.max(1, val);
    setStok(newCount);

    setEpcList((prev) => {
      const next = [...prev];
      if (next.length < newCount) {
        for (let i = next.length; i < newCount; i++) {
          next.push(generateRandomEpc());
        }
      } else if (next.length > newCount) {
        return next.slice(0, newCount);
      }
      return next;
    });

    setLockedEpcs((prev) => {
      const next = [...prev];
      if (next.length < newCount) {
        for (let i = next.length; i < newCount; i++) {
          next.push(false);
        }
      } else if (next.length > newCount) {
        return next.slice(0, newCount);
      }
      return next;
    });
  };

  // Stock Change for Edit Modal
  const handleEditBookStokChange = (val: number) => {
    if (!editingBook) return;
    setEpcError(null);
    const newCount = Math.max(1, val);
    const currentEpcs = editingBook.epcList && editingBook.epcList.length > 0 ? [...editingBook.epcList] : [editingBook.rfidTag];
    const nextEpcs = [...currentEpcs];

    if (nextEpcs.length < newCount) {
      for (let i = nextEpcs.length; i < newCount; i++) {
        nextEpcs.push(generateRandomEpc());
      }
    } else if (nextEpcs.length > newCount) {
      nextEpcs.splice(newCount);
    }

    setLockedEpcs((prev) => {
      const next = [...prev];
      if (next.length < newCount) {
        for (let i = next.length; i < newCount; i++) {
          next.push(false);
        }
      } else if (next.length > newCount) {
        return next.slice(0, newCount);
      }
      return next;
    });

    setEditingBook({
      ...editingBook,
      stok: newCount,
      epcList: nextEpcs,
      rfidTag: nextEpcs[0],
    });
  };

  // Submit Add
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isbn || !judul) return;

    const finalEpcList = epcList.length > 0 ? epcList : [generateRandomEpc()];

    // Validate all unlocked EPCs before saving
    for (let i = 0; i < finalEpcList.length; i++) {
      if (!lockedEpcs[i]) {
        const isOk = handleLockSingleEpc(i, undefined, finalEpcList);
        if (!isOk) return;
      }
    }

    const primaryTag = finalEpcList[0];

    setSaving(true);
    setCrudError("");
    try {
      await addBook({
        isbn,
        judul,
        pengarang: pengarang || "Anonim",
        penerbit: penerbit || "ITK Press",
        kategori,
        lokasiRak,
        rfidTag: primaryTag,
        epcList: finalEpcList,
        status: "Tersedia",
        stok: finalEpcList.length,
      });

      setIsbn("");
      setJudul("");
      setPengarang("");
      setPenerbit("");
      setRfidTag("");
      setEpcList([]);
      setStok(1);
      setLockedEpcs([false]);
      setEpcError(null);
      setShowAddModal(false);
    } catch (error) {
      setCrudError(error instanceof Error ? error.message : "Gagal menyimpan buku ke database.");
    } finally {
      setSaving(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;

    const currentEpcs = editingBook.epcList && editingBook.epcList.length > 0 ? editingBook.epcList : [editingBook.rfidTag];

    // Validate all unlocked EPCs before saving
    for (let i = 0; i < currentEpcs.length; i++) {
      if (!lockedEpcs[i]) {
        const isOk = handleLockSingleEpc(i, editingBook.id, currentEpcs);
        if (!isOk) return;
      }
    }

    setSaving(true);
    setCrudError("");
    try {
      await updateBook(editingBook.id, {
        isbn: editingBook.isbn,
        judul: editingBook.judul,
        pengarang: editingBook.pengarang,
        penerbit: editingBook.penerbit,
        kategori: editingBook.kategori,
        lokasiRak: editingBook.lokasiRak,
        rfidTag: currentEpcs[0] || editingBook.rfidTag,
        epcList: currentEpcs,
        status: editingBook.status,
        stok: editingBook.stok,
      });

      setEditingBook(null);
      setLockedEpcs([false]);
      setEpcError(null);
    } catch (error) {
      setCrudError(error instanceof Error ? error.message : "Gagal memperbarui data buku.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBook = async (book: Book) => {
    if (!window.confirm(`Hapus buku ${book.judul}?`)) return;
    setCrudError("");
    try {
      await deleteBook(book.id);
    } catch (error) {
      setCrudError(error instanceof Error ? error.message : "Gagal menghapus buku.");
    }
  };

  const filteredBooks = books.filter((b) => {
    const matchesSearch =
      b.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.isbn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.lokasiRak.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.rfidTag.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesKat = kategoriFilter === "Semua" || b.kategori === kategoriFilter;
    return matchesSearch && matchesKat;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h1 className="text-base font-extrabold uppercase text-slate-800 tracking-wide">
              PENDAFTARAN BUKU & INVENTARIS RFID
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Katalogisasi koleksi buku perpustakaan dan pemetaan tag RFID UHF (EPC Gen2) lokasi rak.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() =>
              setExportModalConfig({
                isOpen: true,
                title: "Katalog Koleksi Buku & Inventaris RFID",
                filenamePrefix: "katalog_buku_itk",
                columns: bookCatalogExportColumns,
                data: filteredBooks,
              })
            }
            className="flex items-center space-x-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-2xs"
          >
            <Download className="h-4 w-4 text-slate-600" />
            <span>Ekspor Data Katalog</span>
          </button>
          <button
            onClick={() => { setCrudError(""); setShowAddModal(true); }}
            className="flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all"
          >
            <BookPlus className="h-4 w-4" />
            <span>Registrasi Buku Baru</span>
          </button>
        </div>
      </div>

      {crudError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {crudError}
        </div>
      )}
      {/* Main Content Card: Books Catalog Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari Judul Buku, ISBN, Lokasi Rak, atau Tag RFID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={kategoriFilter}
                onChange={(e) => setKategoriFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none transition-all"
              >
                <option value="Semua">Semua Kategori</option>
                <option value="Komputer & Teknologi">Komputer & Teknologi</option>
                <option value="Sains & Matematika">Sains & Matematika</option>
                <option value="Jaringan">Jaringan</option>
                <option value="Manajemen & Bisnis">Manajemen & Bisnis</option>
              </select>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Total Judul: <span className="text-blue-600 font-bold">{filteredBooks.length}</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">ISBN</th>
                <th className="py-3 px-4">JUDUL BUKU</th>
                <th className="py-3 px-4">PENGARANG & PENERBIT</th>
                <th className="py-3 px-4">KATEGORI</th>
                <th className="py-3 px-4">LOKASI RAK</th>
                <th className="py-3 px-4">EPC TAG TERDAFTAR</th>
                <th className="py-3 px-4 text-center">STOK (EKSEMPLAR)</th>
                <th className="py-3 px-4 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredBooks.length > 0 ? (
                filteredBooks.map((book) => {
                  const epcs = book.epcList && book.epcList.length > 0 ? book.epcList : [book.rfidTag];

                  return (
                    <tr key={book.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">
                        {book.isbn}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 max-w-[200px]">
                        {book.judul}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-semibold">{book.pengarang}</div>
                        <div className="text-[10px] text-slate-400">{book.penerbit}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center space-x-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium text-[11px]">
                          <Layers className="h-3 w-3 text-slate-400" />
                          <span>{book.kategori}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center space-x-1 font-bold text-slate-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                          <MapPin className="h-3 w-3 text-amber-500" />
                          <span>{book.lokasiRak}</span>
                        </span>
                      </td>

                      {/* MULTI-EPC TAG BADGES */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="inline-flex items-center space-x-1 font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            <Radio className="h-3 w-3 text-emerald-500 shrink-0" />
                            <span className="truncate max-w-[130px]">{epcs[0]}</span>
                          </span>
                          {epcs.length > 1 && (
                            <div className="text-[10px] font-mono text-slate-400 font-semibold pl-1">
                              + {epcs.length - 1} tag EPC eksemplar lain
                            </div>
                          )}
                        </div>
                      </td>

                      {/* STOK COLUMN - DISPLAY ONLY */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center font-extrabold font-mono text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100/80 shadow-2xs">
                          {book.stok} Eksemplar
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* VIEW */}
                          <button
                            onClick={() => setViewingBook(book)}
                            aria-label={`Lihat detail ${book.judul}`}
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                            title="Lihat Detail Buku"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {/* EDIT */}
                          <button
                            onClick={() => {
                              const epcs = book.epcList && book.epcList.length > 0 ? book.epcList : [book.rfidTag];
                              setEditingBook({
                                ...book,
                                stok: book.stok || epcs.length,
                                epcList: epcs,
                              });
                            }}
                            aria-label={`Edit ${book.judul}`}
                            className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                            title="Edit Buku"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {/* DELETE */}
                          <button
                            onClick={() => void handleDeleteBook(book)}
                            aria-label={`Hapus ${book.judul}`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Hapus Buku"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="h-24" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: VIEW BOOK DETAILS */}
      {viewingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <BookCheck className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                  DETAIL INVENTARIS BUKU
                </h3>
              </div>
              <button
                onClick={() => setViewingBook(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Book Header Card */}
            <div className="rounded-xl bg-slate-900 p-4 text-white shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-amber-400 font-bold">
                  ISBN: {viewingBook.isbn}
                </span>
                <span className="rounded-md px-2 py-0.5 text-[10px] font-extrabold bg-blue-500 text-white">
                  STOK: {viewingBook.stok || 1} EKSEMPLAR
                </span>
              </div>

              <div>
                <h4 className="text-base font-extrabold text-white leading-snug">
                  {viewingBook.judul}
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  oleh <span className="font-semibold text-slate-100">{viewingBook.pengarang}</span>
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[9px] text-slate-400 uppercase">LOKASI RAK</div>
                  <div className="text-xs font-bold text-amber-400">{viewingBook.lokasiRak}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-slate-400 uppercase">PENERBIT</div>
                  <div className="text-xs font-bold text-slate-200">
                    {viewingBook.penerbit}
                  </div>
                </div>
              </div>
            </div>

            {/* Registered Copy EPCs Breakdown List */}
            <div className="space-y-2">
              <h5 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center justify-between">
                <span>DAFTAR EKSEMPLAR RFID ({viewingBook.epcList?.length || 1} STOK)</span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  UHF Gen2 EPC
                </span>
              </h5>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2 space-y-1.5">
                {(viewingBook.epcList && viewingBook.epcList.length > 0 ? viewingBook.epcList : [viewingBook.rfidTag]).map((epc, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 text-xs shadow-2xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        Copy #{idx + 1}
                      </span>
                      <span className="font-mono font-bold text-emerald-700 flex items-center space-x-1">
                        <Radio className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span>{epc}</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      Tersedia
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Book Specs */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                  KATEGORI
                </span>
                <span className="font-bold text-slate-800">{viewingBook.kategori}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                  FREKUENSI RFID
                </span>
                <span className="font-mono text-slate-700">920 - 925 MHz (UHF)</span>
              </div>
            </div>

            {/* Close button */}
            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingBook(null)}
                className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT BOOK */}
      {editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Pencil className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                  EDIT BUKU ({editingBook.isbn})
                </h3>
              </div>
              <button
                onClick={() => setEditingBook(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor ISBN *</label>
                <input
                  type="text"
                  required
                  value={editingBook.isbn}
                  onChange={(e) => setEditingBook({ ...editingBook, isbn: e.target.value })}
                  className="w-full font-mono rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Buku *</label>
                <input
                  type="text"
                  required
                  value={editingBook.judul}
                  onChange={(e) => setEditingBook({ ...editingBook, judul: e.target.value })}
                  className="w-full font-bold rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pengarang</label>
                  <input
                    type="text"
                    value={editingBook.pengarang}
                    onChange={(e) => setEditingBook({ ...editingBook, pengarang: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Penerbit</label>
                  <input
                    type="text"
                    value={editingBook.penerbit}
                    onChange={(e) => setEditingBook({ ...editingBook, penerbit: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={editingBook.kategori}
                    onChange={(e) => setEditingBook({ ...editingBook, kategori: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Komputer & Teknologi">Komputer & Teknologi</option>
                    <option value="Sains & Matematika">Sains & Matematika</option>
                    <option value="Jaringan">Jaringan</option>
                    <option value="Manajemen & Bisnis">Manajemen & Bisnis</option>
                    <option value="Bahasa & Sastra">Bahasa & Sastra</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lokasi Rak</label>
                  <select
                    value={editingBook.lokasiRak}
                    onChange={(e) => setEditingBook({ ...editingBook, lokasiRak: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    <option value="Rak A-01">Rak A-01 (Komputer)</option>
                    <option value="Rak A-02">Rak A-02 (AI / ML)</option>
                    <option value="Rak A-05">Rak A-05 (Database)</option>
                    <option value="Rak A-09">Rak A-09 (Jaringan)</option>
                    <option value="Rak B-01">Rak B-01 (Sains)</option>
                  </select>
                </div>
              </div>

              {/* STOK & PER-EKSEMPLAR SCAN & LOCK SECTION */}
              <div className="space-y-3.5 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-extrabold text-slate-800 text-xs">
                      Jumlah Stok (Eksemplar)
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Setiap eksemplar memerlukan scan tag RFID secara individual
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleEditBookStokChange(editingBook.stok - 1)}
                      disabled={editingBook.stok <= 1}
                      className="h-8 w-8 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 cursor-pointer shadow-2xs"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={editingBook.stok}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        handleEditBookStokChange(isNaN(val) ? 1 : val);
                      }}
                      className="w-16 text-center font-mono font-extrabold text-blue-700 bg-white rounded-xl border border-slate-300 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleEditBookStokChange(editingBook.stok + 1)}
                      className="h-8 w-8 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-2xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Per-Eksemplar Scanning List */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700 text-[11px] uppercase tracking-wide">
                    Scan & Lock Tag EPC Per Eksemplar ({editingBook.stok} Stok):
                  </label>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {Array.from({ length: editingBook.stok }, (_, idx) => {
                      const epcs = editingBook.epcList && editingBook.epcList.length > 0 ? editingBook.epcList : [editingBook.rfidTag];
                      const val = epcs[idx] || "";
                      const isLocked = lockedEpcs[idx];

                      return (
                        <div
                          key={idx}
                          className={`flex flex-wrap items-center justify-between p-2.5 rounded-xl border text-xs gap-2 transition-all ${
                            isLocked
                              ? "bg-emerald-50/60 border-emerald-200"
                              : "bg-white border-slate-200 shadow-2xs"
                          }`}
                        >
                          <div className="flex items-center space-x-2 flex-1 min-w-[210px]">
                            <span className="font-mono text-[10px] font-bold text-slate-400 shrink-0">
                              Eksemplar #{idx + 1}:
                            </span>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={val}
                              onChange={(e) => {
                                const next = [...epcs];
                                next[idx] = e.target.value;
                                setEditingBook({ ...editingBook, epcList: next, rfidTag: next[0] });
                                handleUnlockSingleEpc(idx);
                              }}
                              placeholder="Scan/Ketik EPC RFID"
                              className="flex-1 font-mono font-bold text-emerald-800 bg-slate-50/80 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] focus:border-blue-500 focus:bg-white focus:outline-none disabled:bg-emerald-100/50 disabled:text-emerald-900"
                            />
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => {
                                  const scanned = generateRandomEpc();
                                  const next = [...epcs];
                                  next[idx] = scanned;
                                  setEditingBook({ ...editingBook, epcList: next, rfidTag: next[0] });
                                  handleUnlockSingleEpc(idx);
                                }}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                              >
                                Scan Tag
                              </button>
                            )}

                            {isLocked ? (
                              <div className="flex items-center space-x-1">
                                <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-300">
                                  <Lock className="h-3 w-3 text-emerald-600" />
                                  <span>Terkunci</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUnlockSingleEpc(idx)}
                                  className="rounded-lg bg-white border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                  title="Buka Kunci untuk Edit"
                                >
                                  <Unlock className="h-3 w-3 text-slate-500" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleLockSingleEpc(idx, editingBook.id, epcs)}
                                className="inline-flex items-center space-x-1 font-extrabold text-xs text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-lg shadow-2xs cursor-pointer"
                              >
                                <Lock className="h-3 w-3 text-white" />
                                <span>Simpan & Lock</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Error Banner */}
                {epcError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11px] font-semibold flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                    <span>{epcError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBook(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD BOOK */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                FORM REGISTRASI BUKU BARU
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              {crudError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700">{crudError}</p>}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor ISBN *</label>
                <input
                  type="text"
                  required
                  placeholder="978-602-XXXX-X"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Buku *</label>
                <input
                  type="text"
                  required
                  placeholder="Judul lengkap buku"
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pengarang</label>
                  <input
                    type="text"
                    placeholder="Nama pengarang"
                    value={pengarang}
                    onChange={(e) => setPengarang(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Penerbit</label>
                  <input
                    type="text"
                    placeholder="Penerbit"
                    value={penerbit}
                    onChange={(e) => setPenerbit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Komputer & Teknologi">Komputer & Teknologi</option>
                    <option value="Sains & Matematika">Sains & Matematika</option>
                    <option value="Jaringan">Jaringan</option>
                    <option value="Manajemen & Bisnis">Manajemen & Bisnis</option>
                    <option value="Bahasa & Sastra">Bahasa & Sastra</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lokasi Rak</label>
                  <select
                    value={lokasiRak}
                    onChange={(e) => setLokasiRak(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    <option value="Rak A-01">Rak A-01 (Komputer)</option>
                    <option value="Rak A-02">Rak A-02 (AI / ML)</option>
                    <option value="Rak A-05">Rak A-05 (Database)</option>
                    <option value="Rak A-09">Rak A-09 (Jaringan)</option>
                    <option value="Rak B-01">Rak B-01 (Sains)</option>
                  </select>
                </div>
              </div>

              {/* STOK & PER-EKSEMPLAR SCAN & LOCK SECTION */}
              <div className="space-y-3.5 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-extrabold text-slate-800 text-xs">
                      Jumlah Stok (Eksemplar)
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Setiap eksemplar memerlukan scan tag RFID secara individual
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleStokChange(stok - 1)}
                      disabled={stok <= 1}
                      className="h-8 w-8 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 cursor-pointer shadow-2xs"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={stok}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        handleStokChange(isNaN(val) ? 1 : val);
                      }}
                      className="w-16 text-center font-mono font-extrabold text-blue-700 bg-white rounded-xl border border-slate-300 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleStokChange(stok + 1)}
                      className="h-8 w-8 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-2xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Per-Eksemplar Scanning List */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700 text-[11px] uppercase tracking-wide">
                    Scan & Lock Tag EPC Per Eksemplar ({stok} Stok):
                  </label>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {Array.from({ length: stok }, (_, idx) => {
                      const val = epcList[idx] || "";
                      const isLocked = lockedEpcs[idx];

                      return (
                        <div
                          key={idx}
                          className={`flex flex-wrap items-center justify-between p-2.5 rounded-xl border text-xs gap-2 transition-all ${
                            isLocked
                              ? "bg-emerald-50/60 border-emerald-200"
                              : "bg-white border-slate-200 shadow-2xs"
                          }`}
                        >
                          <div className="flex items-center space-x-2 flex-1 min-w-[210px]">
                            <span className="font-mono text-[10px] font-bold text-slate-400 shrink-0">
                              Eksemplar #{idx + 1}:
                            </span>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={val}
                              onChange={(e) => handleUpdateSingleEpc(idx, e.target.value)}
                              placeholder="Scan/Ketik EPC RFID"
                              className="flex-1 font-mono font-bold text-emerald-800 bg-slate-50/80 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] focus:border-blue-500 focus:bg-white focus:outline-none disabled:bg-emerald-100/50 disabled:text-emerald-900"
                            />
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => handleScanSingleEpc(idx)}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                              >
                                Scan Tag
                              </button>
                            )}

                            {isLocked ? (
                              <div className="flex items-center space-x-1">
                                <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-300">
                                  <Lock className="h-3 w-3 text-emerald-600" />
                                  <span>Terkunci</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUnlockSingleEpc(idx)}
                                  className="rounded-lg bg-white border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                  title="Buka Kunci untuk Edit"
                                >
                                  <Unlock className="h-3 w-3 text-slate-500" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleLockSingleEpc(idx)}
                                className="inline-flex items-center space-x-1 font-extrabold text-xs text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-lg shadow-2xs cursor-pointer"
                              >
                                <Lock className="h-3 w-3 text-white" />
                                <span>Simpan & Lock</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Error Banner */}
                {epcError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11px] font-semibold flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                    <span>{epcError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "Simpan Buku"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EXPORT MODAL */}
      {exportModalConfig && (
        <ExportModal
          isOpen={exportModalConfig.isOpen}
          onClose={() => setExportModalConfig(null)}
          title={exportModalConfig.title}
          filenamePrefix={exportModalConfig.filenamePrefix}
          columns={exportModalConfig.columns}
          data={exportModalConfig.data}
        />
      )}
    </div>
  );
}

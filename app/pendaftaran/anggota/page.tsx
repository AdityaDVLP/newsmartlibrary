"use client";

import React, { useEffect, useState } from "react";
import {
  UserPlus,
  Search,
  Trash2,
  Radio,
  Filter,
  UserCheck,
  Eye,
  Pencil,
  Mail,
  Phone,
  Calendar,
  X,
  CreditCard,
  GraduationCap,
  Briefcase,
  Globe,
  Users,
  Download,
} from "lucide-react";
import { useLibrary, Member, MemberCategory, getInitials, getAvatarColor } from "../../../context/LibraryContext";
import ExportModal, { ExportColumn } from "../../../components/ExportModal";

const getDatabaseErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const databaseError = error as { code?: string; message?: string; details?: string; hint?: string };
    const description = [databaseError.message, databaseError.details, databaseError.hint]
      .filter((part): part is string => Boolean(part))
      .join(" | ");
    if (description) {
      return `${fallback} ${description}${databaseError.code ? ` (kode ${databaseError.code})` : ""}`;
    }
  }

  return error instanceof Error ? `${fallback} ${error.message}` : fallback;
};

export default function PendaftaranAnggotaPage() {
  const { members, addMember, updateMember, deleteMember, rfidUid } = useLibrary();

  // Form states (Add)
  const [nim, setNim] = useState("");
  const [nama, setNama] = useState("");
  const [prodi, setProdi] = useState("Informatika");
  const [email, setEmail] = useState("");
  const [noHp, setNoHp] = useState("");
  const [rfidTag, setRfidTag] = useState("");
  const [status, setStatus] = useState<MemberCategory>("Mahasiswa");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [prodiFilter, setProdiFilter] = useState("Semua");
  const [kategoriFilter, setKategoriFilter] = useState<string>("Semua");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [crudError, setCrudError] = useState("");
  const [crudNotice, setCrudNotice] = useState("");
  const [saving, setSaving] = useState(false);

  // Export Modal State
  const [exportModalConfig, setExportModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    filenamePrefix: string;
    columns: ExportColumn[];
    data: any[];
  } | null>(null);

  const memberCatalogExportColumns: ExportColumn[] = [
    { header: "NIM / NIP / ID", key: "nim" },
    { header: "NAMA LENGKAP", key: "nama" },
    { header: "KATEGORI ANGGOTA", key: "status" },
    { header: "PROGRAM STUDI / INSTANSI", key: "prodi" },
    { header: "EMAIL REGISTRASI", key: "email" },
    { header: "NO. WHATSAPP / HP", key: "noHp" },
    { header: "UID TAG RFID", key: "rfidTag" },
    { header: "TANGGAL REGISTRASI", key: "dateRegistered" },
  ];

  // Statistics Calculation (Synced in Realtime)
  const totalCount = members.length;
  const mahasiswaCount = members.filter((m) => m.status === "Mahasiswa").length;
  const dosenCount = members.filter((m) => m.status === "Dosen").length;
  const visitorCount = members.filter((m) => m.status === "Visitor").length;

  const mahasiswaPct = totalCount ? Math.round((mahasiswaCount / totalCount) * 100) : 0;
  const dosenPct = totalCount ? Math.round((dosenCount / totalCount) * 100) : 0;
  const visitorPct = totalCount ? Math.round((visitorCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (!showAddModal || !rfidUid) return;

    const syncUid = window.setTimeout(() => setRfidTag(rfidUid), 0);
    return () => window.clearTimeout(syncUid);
  }, [showAddModal, rfidUid]);

  // RFID simulation fallback when the physical reader is unavailable.
  const handleAutoGenerateRfid = (setter: (val: string) => void) => {
    const randomHex = () =>
      Math.floor(Math.random() * 65536)
        .toString(16)
        .toUpperCase()
        .padStart(4, "0");
    setter(`E200 ${randomHex()} ${randomHex()}`);
  };

  // Submit Add
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nim || !nama) return;

    setSaving(true);
    setCrudError("");
    setCrudNotice("");
    try {
      const storage = await addMember({
        nim,
        nama,
        prodi,
        email,
        noHp,
        rfidTag: rfidTag || `E200 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`,
        status,
      });

      setNim("");
      setNama("");
      setEmail("");
      setNoHp("");
      setRfidTag("");
      setStatus("Mahasiswa");
      setShowAddModal(false);
      if (storage === "local") {
        setCrudNotice("Data anggota tersimpan di browser ini untuk uji coba. Data belum terkirim ke database.");
      }
    } catch (error) {
      console.error("Supabase member insert failed:", error);
      setCrudError(getDatabaseErrorMessage(error, "Gagal menyimpan anggota ke database."));
    } finally {
      setSaving(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setSaving(true);
    setCrudError("");
    try {
      await updateMember(editingMember.id, {
        nim: editingMember.nim,
        nama: editingMember.nama,
        prodi: editingMember.prodi,
        email: editingMember.email,
        noHp: editingMember.noHp,
        rfidTag: editingMember.rfidTag,
        status: editingMember.status,
      });
      setEditingMember(null);
    } catch (error) {
      console.error("Supabase member update failed:", error);
      setCrudError(getDatabaseErrorMessage(error, "Gagal memperbarui data anggota."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async (member: Member) => {
    if (!window.confirm(`Hapus anggota ${member.nama}?`)) return;
    setCrudError("");
    try {
      await deleteMember(member.id);
    } catch (error) {
      console.error("Supabase member delete failed:", error);
      setCrudError(getDatabaseErrorMessage(error, "Gagal menghapus anggota."));
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.nim.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.rfidTag.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProdi = prodiFilter === "Semua" || m.prodi === prodiFilter;
    const matchesKat = kategoriFilter === "Semua" || m.status === kategoriFilter;
    return matchesSearch && matchesProdi && matchesKat;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <UserCheck className="h-5 w-5 text-blue-600" />
            <h1 className="text-base font-extrabold uppercase text-slate-800 tracking-wide">
              PENDAFTARAN ANGGOTA PERPUSTAKAAN
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manajemen data sivitas akademika ITK & visitor yang terhubung dengan sistem kartu RFID Smart Library.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() =>
              setExportModalConfig({
                isOpen: true,
                title: "Data Anggota Perpustakaan ITK",
                filenamePrefix: "data_anggota_itk",
                columns: memberCatalogExportColumns,
                data: filteredMembers,
              })
            }
            className="flex items-center space-x-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-2xs"
          >
            <Download className="h-4 w-4 text-slate-600" />
            <span>Ekspor Data Anggota</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all"
          >
            <UserPlus className="h-4 w-4" />
            <span>Tambah Anggota Baru</span>
          </button>
        </div>
      </div>

      {crudError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {crudError}
        </div>
      )}
      {crudNotice && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {crudNotice}
        </div>
      )}

      {/* STATISTICAL BAR (KPI Cards synchronized in Realtime) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Anggota (Neutral Dark / Slate) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400">
              TOTAL ANGGOTA
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{totalCount}</span>
            <span className="text-[11px] font-bold text-slate-600">Terdaftar</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Sinkron dengan log perpustakaan</p>
        </div>

        {/* Card 2: Mahasiswa (Hijau / Green) */}
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-emerald-800">
              MAHASISWA
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{mahasiswaCount}</span>
            <span className="text-[11px] font-bold text-emerald-600">
              {mahasiswaPct}% dari total
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-emerald-50 rounded-full overflow-hidden">
            <div
              style={{ width: `${mahasiswaPct}%` }}
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            />
          </div>
        </div>

        {/* Card 3: Dosen (Biru / Blue) */}
        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-blue-800">
              DOSEN & STAF
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{dosenCount}</span>
            <span className="text-[11px] font-bold text-blue-600">
              {dosenPct}% dari total
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-blue-50 rounded-full overflow-hidden">
            <div
              style={{ width: `${dosenPct}%` }}
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
            />
          </div>
        </div>

        {/* Card 4: Visitor (Oranye / Amber) */}
        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-amber-800">
              VISITOR / TAMU
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Globe className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{visitorCount}</span>
            <span className="text-[11px] font-bold text-amber-600">
              {visitorPct}% dari total
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-amber-50 rounded-full overflow-hidden">
            <div
              style={{ width: `${visitorPct}%` }}
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content Card: Registered Members List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan Nama, NIM/NIP, atau Tag RFID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* Filter Kategori Status */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={kategoriFilter}
                onChange={(e) => setKategoriFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-all"
              >
                <option value="Semua">Semua Kategori</option>
                <option value="Mahasiswa">Mahasiswa</option>
                <option value="Dosen">Dosen</option>
                <option value="Visitor">Visitor</option>
              </select>
            </div>

            {/* Prodi Filter */}
            <select
              value={prodiFilter}
              onChange={(e) => setProdiFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none transition-all"
            >
              <option value="Semua">Semua Prodi / Instansi</option>
              <option value="Informatika">Informatika</option>
              <option value="Sistem Informasi">Sistem Informasi</option>
              <option value="Teknik Elektro">Teknik Elektro</option>
              <option value="Teknik Kimia">Teknik Kimia</option>
              <option value="Tamu / Eksternal">Tamu / Eksternal</option>
            </select>
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Menampilkan: <span className="text-blue-600 font-bold">{filteredMembers.length}</span> dari {totalCount}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">NIM / NIP / ID</th>
                <th className="py-3 px-4">NAMA LENGKAP</th>
                <th className="py-3 px-4">KATEGORI ANGGOTA</th>
                <th className="py-3 px-4">PROGRAM STUDI</th>
                <th className="py-3 px-4">UID ANGGOTA</th>
                <th className="py-3 px-4 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {member.nim}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 border shadow-2xs ${getAvatarColor(
                            member.nama
                          )}`}
                        >
                          {getInitials(member.nama)}
                        </div>
                        <div>
                          <div>{member.nama}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-extrabold border ${
                          member.status === "Mahasiswa"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : member.status === "Dosen"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{member.prodi}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center space-x-1 font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        <Radio className="h-3 w-3 text-blue-500" />
                        <span>{member.rfidTag}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {/* VIEW */}
                        <button
                          onClick={() => setViewingMember(member)}
                          aria-label={`Lihat detail ${member.nama}`}
                          className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                          title="Lihat Detail Anggota"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {/* EDIT */}
                        <button
                          onClick={() => setEditingMember(member)}
                          aria-label={`Edit ${member.nama}`}
                          className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                          title="Edit Anggota"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {/* DELETE */}
                        <button
                          onClick={() => void handleDeleteMember(member)}
                          aria-label={`Hapus ${member.nama}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Hapus Anggota"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="h-24" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: VIEW MEMBER DETAILS */}
      {viewingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                  PROFIL KARTU ANGGOTA
                </h3>
              </div>
              <button
                onClick={() => setViewingMember(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Member Profile Banner */}
            <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest uppercase text-blue-200">
                  ITK SMART LIBRARY CARD
                </span>
                <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-extrabold text-white backdrop-blur-xs">
                  {viewingMember.status}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-white font-extrabold text-xs shadow-inner">
                  {getInitials(viewingMember.nama)}
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white">{viewingMember.nama}</h4>
                  <p className="text-xs font-mono text-blue-100">{viewingMember.nim}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/20 flex items-center justify-between">
                <div>
                  <div className="text-[9px] text-blue-200 uppercase">PROGRAM STUDI</div>
                  <div className="text-xs font-semibold">{viewingMember.prodi}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-blue-200 uppercase">UID ANGGOTA</div>
                  <div className="text-xs font-mono font-bold text-amber-300">
                    {viewingMember.rfidTag}
                  </div>
                </div>
              </div>
            </div>

            {/* Details List */}
            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50">
                <Mail className="h-4 w-4 text-blue-500 shrink-0" />
                <div className="flex-1 truncate">
                  <span className="text-[10px] text-slate-400 block font-medium">EMAIL REGISTRASI</span>
                  <span className="font-semibold text-slate-800">{viewingMember.email}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50">
                <Phone className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] text-slate-400 block font-medium">NO. WHATSAPP</span>
                  <span className="font-semibold font-mono text-slate-800">{viewingMember.noHp}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50">
                <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] text-slate-400 block font-medium">TANGGAL REGISTRASI</span>
                  <span className="font-semibold text-slate-800">{viewingMember.dateRegistered}</span>
                </div>
              </div>
            </div>

            {/* Close button */}
            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingMember(null)}
                className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-all"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT MEMBER */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Pencil className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                  EDIT ANGGOTA ({editingMember.nim})
                </h3>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori Anggota *</label>
                  <select
                    value={editingMember.status}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, status: e.target.value as MemberCategory })
                    }
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-bold"
                  >
                    <option value="Mahasiswa">Mahasiswa</option>
                    <option value="Dosen">Dosen</option>
                    <option value="Visitor">Visitor</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIM / NIP / ID *</label>
                  <input
                    type="text"
                    required
                    value={editingMember.nim}
                    onChange={(e) => setEditingMember({ ...editingMember, nim: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={editingMember.nama}
                  onChange={(e) => setEditingMember({ ...editingMember, nama: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Program Studi / Instansi</label>
                <input
                  type="text"
                  value={editingMember.prodi}
                  onChange={(e) => setEditingMember({ ...editingMember, prodi: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editingMember.email}
                    onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. WhatsApp/HP</label>
                  <input
                    type="text"
                    value={editingMember.noHp}
                    onChange={(e) => setEditingMember({ ...editingMember, noHp: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">UID Anggota</label>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={editingMember.rfidTag}
                    onChange={(e) => setEditingMember({ ...editingMember, rfidTag: e.target.value })}
                    className="w-full font-mono rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAutoGenerateRfid((val) => setEditingMember({ ...editingMember, rfidTag: val }))}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-2.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 shrink-0"
                  >
                    Tap
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:bg-amber-700"
                >
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD MEMBER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                FORM PENDAFTARAN ANGGOTA
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              {crudError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700">{crudError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori Anggota *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MemberCategory)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-bold"
                  >
                    <option value="Mahasiswa">Mahasiswa</option>
                    <option value="Dosen">Dosen</option>
                    <option value="Visitor">Visitor</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIM / NIP / ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="NIM / NIP / ID Visitor"
                    value={nim}
                    onChange={(e) => setNim(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Program Studi / Instansi</label>
                <input
                  type="text"
                  placeholder="Contoh: Informatika / Universitas Mulawarman"
                  value={prodi}
                  onChange={(e) => setProdi(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="email@itk.ac.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. WhatsApp/HP</label>
                  <input
                    type="text"
                    placeholder="0812xxxxxxxx"
                    value={noHp}
                    onChange={(e) => setNoHp(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">UID Anggota</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="E200 XXXX XXXX"
                    value={rfidTag}
                    onChange={(e) => setRfidTag(e.target.value)}
                    className="flex-1 font-mono rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAutoGenerateRfid(setRfidTag)}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                  >
                    Simulasi Tap
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Tempelkan kartu RFID pada RFID Reader atau klik Simulasi Tap.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "Simpan Anggota"}
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

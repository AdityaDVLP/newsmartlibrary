"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Download,
  Radio,
  SlidersHorizontal,
  Maximize2,
  ListFilter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Printer,
  BarChart3,
  PieChart,
  LineChart,
  TrendingUp,
  Phone,
  Mail,
  User,
  UserCheck,
  CreditCard,
  Calendar,
  X,
  Lock,
  Unlock,
  GripVertical,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useLibrary, Member, getInitials, getAvatarColor } from "../../context/LibraryContext";
import ExportModal, { ExportColumn } from "../../components/ExportModal";

type WidgetId =
  | "trend_kunjungan"
  | "distribusi_kategori"
  | "log_pengunjung"
  | "log_buku"
  | "rssi_monitor"
  | "aktivitas_terakhir"
  | "power_gauge";

export default function DashboardPage() {
  const {
    members,
    visitorLogs,
    bookLogs,
    activities,
    rssiHistory,
    rfidActive,
    txPower,
    setTxPower,
    toggleRfid,
    connectionStatus,
    clearBookLogs,
    clearVisitorLogs,
  } = useLibrary();

  // Search & Filter States
  const [visitorSearch, setVisitorSearch] = useState("");
  const [visitorFilter, setVisitorFilter] = useState("Semua");
  const [visitorLogPage, setVisitorLogPage] = useState(1);
  const VISITOR_LOG_PAGE_SIZE = 5;
  const [bookSearch, setBookSearch] = useState("");
  const [bookLogPage, setBookLogPage] = useState(1);
  const BOOK_LOG_PAGE_SIZE = 5;

  // Viewing Member Identity Modal State
  const [viewingMember, setViewingMember] = useState<Member | null>(null);

  // Export Modal State
  const [exportModalConfig, setExportModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    filenamePrefix: string;
    columns: ExportColumn[];
    data: any[];
  } | null>(null);

  const visitorExportColumns: ExportColumn[] = [
    { header: "WAKTU SCAN", key: "waktu" },
    { header: "NAMA LENGKAP", key: "nama" },
    { header: "NIM / NIP / ID", key: "nim" },
    { header: "PROGRAM STUDI / INSTANSI", key: "prodi" },
    { header: "KATEGORI", key: "kategori" },
    { header: "STATUS KUNJUNGAN", key: "status" },
    { header: "UID TAG RFID", key: "rfidTag" },
  ];

  const bookExportColumns: ExportColumn[] = [
    { header: "WAKTU SCAN", key: "waktu" },
    { header: "ISBN", key: "isbn" },
    { header: "JUDUL BUKU", key: "judul" },
    { header: "KATEGORI BUKU", key: "kategori" },
    { header: "LOKASI RAK", key: "lokasiRak" },
    { header: "KEKUATAN SINYAL (RSSI)", key: "rssi", formatter: (val: any) => `${val} dBm` },
    { header: "TAG EPC RFID", key: "rfidTag" },
  ];

  // Chart View Switcher States (Bar, Line/Area, Donut)
  const [trendChartType, setTrendChartType] = useState<"bar" | "line" | "area">("bar");
  const [categoryChartType, setCategoryChartType] = useState<"bar" | "donut">("bar");

  // Drag & Drop Layout States
  const [isLayoutLocked, setIsLayoutLocked] = useState(true);
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>([
    "log_pengunjung",
    "log_buku",
    "trend_kunjungan",
    "distribusi_kategori",
    "rssi_monitor",
    "aktivitas_terakhir",
    "power_gauge",
  ]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load layout from localStorage if available
  useEffect(() => {
    const savedOrder = localStorage.getItem("itk_smartlib_widget_order_v3");
    const savedLock = localStorage.getItem("itk_smartlib_layout_locked");
    if (savedOrder) {
      try {
        setWidgetOrder(JSON.parse(savedOrder));
      } catch (e) {}
    }
    if (savedLock !== null) {
      setIsLayoutLocked(savedLock === "true");
    }
  }, []);

  // Save layout to localStorage
  useEffect(() => {
    localStorage.setItem("itk_smartlib_widget_order_v3", JSON.stringify(widgetOrder));
    localStorage.setItem("itk_smartlib_layout_locked", String(isLayoutLocked));
  }, [widgetOrder, isLayoutLocked]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (isLayoutLocked) return;
    e.dataTransfer.setData("text/plain", String(index));
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (isLayoutLocked) return;
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (isLayoutLocked || draggedIndex === null) return;
    e.preventDefault();
    const newOrder = [...widgetOrder];
    const [draggedWidget] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedWidget);
    setWidgetOrder(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleResetLayout = () => {
    const defaultOrder: WidgetId[] = [
      "log_pengunjung",
      "log_buku",
      "trend_kunjungan",
      "distribusi_kategori",
      "rssi_monitor",
      "aktivitas_terakhir",
      "power_gauge",
    ];
    setWidgetOrder(defaultOrder);
    setIsLayoutLocked(false);
  };

  // Filtered visitor logs
  const filteredVisitorLogs = visitorLogs.filter((log) => {
    const matchesSearch =
      log.nama.toLowerCase().includes(visitorSearch.toLowerCase()) ||
      log.nim.toLowerCase().includes(visitorSearch.toLowerCase()) ||
      log.prodi.toLowerCase().includes(visitorSearch.toLowerCase());
    const matchesFilter =
      visitorFilter === "Semua" ||
      log.status === visitorFilter ||
      log.kategori === visitorFilter;
    return matchesSearch && matchesFilter;
  });

  // Filtered book logs
  const filteredBookLogs = bookLogs.filter((log) => {
    return (
      log.isbn.toLowerCase().includes(bookSearch.toLowerCase()) ||
      log.judul.toLowerCase().includes(bookSearch.toLowerCase()) ||
      log.kategori.toLowerCase().includes(bookSearch.toLowerCase()) ||
      log.lokasiRak.toLowerCase().includes(bookSearch.toLowerCase())
    );
  });

  // Export CSV mock function
  const handleExportCSV = (filename: string, data: any[]) => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      Object.keys(data[0] || {}).join(",") +
      "\n" +
      data.map((e) => Object.values(e).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper to render Drag Handle Header for unlocked cards
  const renderCardHeaderWrapper = (title: string, children?: React.ReactNode) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        {!isLayoutLocked && (
          <GripVertical className="h-4 w-4 text-blue-500 cursor-grab hover:text-blue-700 shrink-0" />
        )}
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );

  // Widget Render Map
  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case "trend_kunjungan": {
        const hourlyCounts = visitorLogs.reduce<Record<string, number>>((counts, log) => {
          const hour = log.waktu.slice(0, 2);
          if (/^\d{2}$/.test(hour)) counts[hour] = (counts[hour] ?? 0) + 1;
          return counts;
        }, {});
        const hourlyItems = Object.entries(hourlyCounts)
          .sort(([hourA], [hourB]) => hourA.localeCompare(hourB))
          .map(([hour, val]) => ({ hour: `${hour}:00`, val }));
        const maxVal = Math.max(1, ...hourlyItems.map((item) => item.val));
        const peakHour = hourlyItems.reduce<(typeof hourlyItems)[number] | null>(
          (peak, item) => (!peak || item.val > peak.val ? item : peak),
          null
        );

        // Math for SVG Line/Area Spline
        const svgPoints = hourlyItems.map((pt, idx) => {
          const x = 35 + (idx / Math.max(1, hourlyItems.length - 1)) * 430;
          const y = 135 - (pt.val / maxVal) * 105;
          return { ...pt, x, y };
        });

        let linePath = svgPoints.length > 0 ? `M ${svgPoints[0].x} ${svgPoints[0].y}` : "";
        for (let i = 0; i < svgPoints.length - 1; i++) {
          const cp1x = svgPoints[i].x + (svgPoints[i + 1].x - svgPoints[i].x) / 2;
          const cp1y = svgPoints[i].y;
          const cp2x = svgPoints[i].x + (svgPoints[i + 1].x - svgPoints[i].x) / 2;
          const cp2y = svgPoints[i + 1].y;
          linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${svgPoints[i + 1].x} ${svgPoints[i + 1].y}`;
        }
        const areaPath = svgPoints.length > 0
          ? `${linePath} L ${svgPoints[svgPoints.length - 1].x} 135 L ${svgPoints[0].x} 135 Z`
          : "";

        return (
          <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              {renderCardHeaderWrapper(
                "TREN KUNJUNGAN PERPUSTAKAAN (JAM)",
                <div className="flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                  <button
                    onClick={() => setTrendChartType("bar")}
                    title="Grafik Batang (Bar Chart)"
                    className={`flex items-center space-x-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      trendChartType === "bar"
                        ? "bg-white text-blue-600 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Bar</span>
                  </button>
                  <button
                    onClick={() => setTrendChartType("line")}
                    title="Grafik Garis (Line Chart)"
                    className={`flex items-center space-x-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      trendChartType === "line"
                        ? "bg-white text-blue-600 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <LineChart className="h-3.5 w-3.5" />
                    <span>Line</span>
                  </button>
                  <button
                    onClick={() => setTrendChartType("area")}
                    title="Grafik Area (Area Chart)"
                    className={`flex items-center space-x-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      trendChartType === "area"
                        ? "bg-white text-blue-600 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Area</span>
                  </button>
                </div>
              )}
              <p className="text-[11px] text-slate-400 mb-3">
                Jumlah log pengunjung berdasarkan jam yang tercatat
              </p>

              {/* Chart Visualizer */}
              {hourlyItems.length === 0 ? (
                <div className="h-48 w-full border border-slate-100 bg-slate-50/50 rounded-xl flex items-center justify-center text-xs text-slate-400">
                  Belum ada data kunjungan.
                </div>
              ) : trendChartType === "bar" ? (
                <div className="h-48 w-full border border-slate-100 bg-slate-50/50 rounded-xl p-3 flex flex-col justify-between relative overflow-hidden">
                  {/* Subtle Grid Lines */}
                  <div className="absolute inset-x-3 top-4 border-b border-slate-200/50 border-dashed pointer-events-none" />
                  <div className="absolute inset-x-3 top-1/2 border-b border-slate-200/50 border-dashed pointer-events-none" />

                  <div className="flex-1 flex items-end justify-between gap-2 pt-4 px-1 relative z-10">
                    {hourlyItems.map((item, i) => {
                      const isPeak = item.val === peakHour?.val;
                      return (
                        <div key={i} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                          {/* Value Tooltip */}
                          <div className="absolute -top-7 text-[10px] font-mono font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap pointer-events-none">
                            {item.val} orang
                          </div>
                          {/* Column Bar Container */}
                          <div className="w-full flex-1 flex items-end justify-center">
                            <div
                              style={{ height: `${(item.val / maxVal) * 100}%` }}
                              className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 shadow-2xs ${
                                isPeak
                                  ? "bg-gradient-to-t from-blue-600 via-indigo-600 to-indigo-500 group-hover:from-blue-500 group-hover:to-indigo-400"
                                  : "bg-gradient-to-t from-blue-500 to-blue-400 group-hover:from-blue-600 group-hover:to-blue-500"
                              }`}
                            />
                          </div>
                          <span className={`text-[9px] font-mono mt-2 transition-colors ${isPeak ? "font-black text-blue-600" : "font-medium text-slate-500"}`}>
                            {item.hour}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-48 w-full border border-slate-100 bg-slate-50/50 rounded-xl p-2 flex items-center justify-center relative overflow-hidden">
                  <svg className="w-full h-full" viewBox="0 0 500 165">
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <line x1="30" y1="30" x2="470" y2="30" stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" />
                    <line x1="30" y1="82.5" x2="470" y2="82.5" stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" />
                    <line x1="30" y1="135" x2="470" y2="135" stroke="#94a3b8" strokeWidth="1.5" />

                    {/* Area Fill */}
                    {trendChartType === "area" && areaPath && <path d={areaPath} fill="url(#trendGradient)" />}

                    {/* Spline Path Line */}
                    {linePath && <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

                    {/* Dots and Labels */}
                    {svgPoints.map((pt, idx) => {
                      const isPeak = pt.val === peakHour?.val;
                      return (
                        <g key={idx} className="group cursor-pointer">
                          {isPeak && (
                            <circle cx={pt.x} cy={pt.y} r="8" fill="none" stroke="#2563eb" className="animate-ping" opacity="0.6" />
                          )}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isPeak ? "5.5" : "4"}
                            fill={isPeak ? "#2563eb" : "#ffffff"}
                            stroke="#2563eb"
                            strokeWidth="2.5"
                          />
                          <text x={pt.x} y="152" textAnchor="middle" className="text-[9px] font-mono fill-slate-500 font-medium">
                            {pt.hour}
                          </text>

                          {/* Hover Tooltip */}
                          <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <rect x={pt.x - 20} y={pt.y - 24} width="40" height="17" rx="4" fill="#0f172a" />
                            <text x={pt.x} y={pt.y - 12} textAnchor="middle" fill="#ffffff" className="text-[9px] font-mono font-bold">
                              {pt.val} org
                            </text>
                          </g>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>Jam tertinggi: <strong className="text-slate-800 font-bold">{peakHour ? `${peakHour.hour} (${peakHour.val} kunjungan)` : "Belum tersedia"}</strong></span>
            </div>
          </div>
        );
      }

      case "distribusi_kategori": {
        const categoryColors = [
          { color: "#2563eb", bgClass: "bg-blue-600" },
          { color: "#10b981", bgClass: "bg-emerald-500" },
          { color: "#f59e0b", bgClass: "bg-amber-500" },
          { color: "#6366f1", bgClass: "bg-indigo-500" },
          { color: "#e11d48", bgClass: "bg-rose-600" },
          { color: "#0891b2", bgClass: "bg-cyan-600" },
        ];
        const categoryCounts = bookLogs.reduce<Record<string, number>>((counts, log) => {
          const category = log.kategori.trim();
          if (category) counts[category] = (counts[category] ?? 0) + 1;
          return counts;
        }, {});
        const totalScan = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
        const categories = Object.entries(categoryCounts)
          .sort(([, countA], [, countB]) => countB - countA)
          .map(([name, count], index) => ({
            name,
            count,
            pct: totalScan ? Math.round((count / totalScan) * 100) : 0,
            ...categoryColors[index % categoryColors.length],
          }));
        const popularCategory = categories[0]?.name;

        // SVG Donut Calculations
        const circumference = 345.57; // 2 * pi * 55
        let accumulatedPct = 0;

        return (
          <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              {renderCardHeaderWrapper(
                "DISTRIBUSI KATEGORI SCAN BUKU",
                <div className="flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                  <button
                    onClick={() => setCategoryChartType("bar")}
                    title="Grafik Batang (Progress Bar)"
                    className={`flex items-center space-x-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      categoryChartType === "bar"
                        ? "bg-white text-indigo-600 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Bar</span>
                  </button>
                  <button
                    onClick={() => setCategoryChartType("donut")}
                    title="Grafik Donut (Pie Chart)"
                    className={`flex items-center space-x-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      categoryChartType === "donut"
                        ? "bg-white text-indigo-600 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <PieChart className="h-3.5 w-3.5" />
                    <span>Donut</span>
                  </button>
                </div>
              )}
              <p className="text-[11px] text-slate-400 mb-3">
                Distribusi kategori dari log scan buku yang tersimpan
              </p>

              {categoryChartType === "bar" ? (
                <div className="space-y-3.5 my-1">
                  {categories.length === 0 ? (
                    <p className="py-12 text-center text-xs text-slate-400">Belum ada data scan buku.</p>
                  ) : categories.map((cat, idx) => (
                    <div key={idx} className="space-y-1 group">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="group-hover:text-blue-600 transition-colors">{cat.name}</span>
                        <span className="font-mono text-slate-500">{cat.count} scan ({cat.pct}%)</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/40">
                        <div
                          style={{ width: `${cat.pct}%` }}
                          className={`h-full ${cat.bgClass} rounded-full transition-all duration-500 shadow-2xs`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-6 my-1">
                  {/* SVG Donut Chart */}
                  <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
                    {categories.length > 0 ? <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
                      {categories.map((cat, idx) => {
                        const dashArray = `${(cat.pct / 100) * circumference} ${
                          circumference - (cat.pct / 100) * circumference
                        }`;
                        const dashOffset = -((accumulatedPct / 100) * circumference);
                        accumulatedPct += cat.pct;

                        return (
                          <circle
                            key={idx}
                            cx="90"
                            cy="90"
                            r="55"
                            fill="none"
                            stroke={cat.color}
                            strokeWidth="18"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            className="transition-all duration-500 hover:opacity-85 cursor-pointer"
                          />
                        );
                      })}
                    </svg> : <p className="text-center text-xs text-slate-400">Belum ada data scan buku.</p>}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-xl font-black text-slate-900 font-mono leading-none">{totalScan}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mt-0.5">Total Scan</span>
                    </div>
                  </div>

                  {/* Legend List */}
                  <div className="flex-1 space-y-2 min-w-[170px]">
                    {categories.map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2 truncate pr-1">
                          <span style={{ backgroundColor: cat.color }} className="h-2.5 w-2.5 rounded-full shrink-0" />
                          <span className="font-semibold text-slate-700 truncate text-[11px]">{cat.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 text-[11px]">{cat.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
              <span>Kategori terbanyak: <strong className="text-blue-600 font-bold">{popularCategory ?? "Belum tersedia"}</strong></span>
            </div>
          </div>
        );
      }

      case "log_pengunjung": {
        const totalVisitorLogPages = Math.max(1, Math.ceil(filteredVisitorLogs.length / VISITOR_LOG_PAGE_SIZE));
        const currentVisitorLogPage = Math.min(visitorLogPage, totalVisitorLogPages);
        const paginatedVisitorLogs = filteredVisitorLogs.slice(
          (currentVisitorLogPage - 1) * VISITOR_LOG_PAGE_SIZE,
          currentVisitorLogPage * VISITOR_LOG_PAGE_SIZE
        );

        return (
          <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md flex flex-col justify-between">
            <div>
              {renderCardHeaderWrapper(
                "LOG PENGUNJUNG",
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      if (window.confirm("Bersihkan semua catatan log pengunjung? Data di log akan direset.")) {
                        void clearVisitorLogs();
                        setVisitorLogPage(1);
                      }
                    }}
                    className="flex items-center space-x-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-all cursor-pointer"
                    title="Bersihkan Log Pengunjung"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    <span>Bersihkan</span>
                  </button>
                  <button
                    onClick={() =>
                      setExportModalConfig({
                        isOpen: true,
                        title: "Laporan Log Pengunjung Perpustakaan",
                        filenamePrefix: "log_pengunjung_itk",
                        columns: visitorExportColumns,
                        data: filteredVisitorLogs,
                      })
                    }
                    className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export</span>
                  </button>
                  <button
                    onClick={toggleRfid}
                    className={`flex items-center space-x-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      rfidActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Radio className="h-3.5 w-3.5" />
                    <span>Aktifkan RFID</span>
                  </button>
                </div>
              )}

              {/* Search and Select Bar */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama, NIM/NIP..."
                    value={visitorSearch}
                    onChange={(e) => {
                      setVisitorSearch(e.target.value);
                      setVisitorLogPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                  />
                </div>
                <select
                  value={visitorFilter}
                  onChange={(e) => {
                    setVisitorFilter(e.target.value);
                    setVisitorLogPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-all"
                >
                  <option value="Semua">Semua</option>
                  <option value="Mahasiswa">Mahasiswa</option>
                  <option value="Dosen">Dosen</option>
                  <option value="Visitor">Visitor</option>
                </select>
              </div>

              {/* Log Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-2 px-2">WAKTU</th>
                      <th className="py-2 px-2">NAMA</th>
                      <th className="py-2 px-2">KATEGORI</th>
                      <th className="py-2 px-2">STATUS</th>
                      <th className="py-2 px-2 text-center">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                    {paginatedVisitorLogs.length > 0 ? (
                      paginatedVisitorLogs.map((log) => {
                        const matchedMember = members.find((m) => m.nim === log.nim || m.nama === log.nama);

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-2 font-mono text-slate-500 text-[11px]">
                              {log.waktu}
                            </td>
                            <td className="py-2.5 px-2 font-bold text-slate-900 max-w-[200px]">
                              <div className="flex items-center space-x-2.5">
                                <div
                                  className={`h-7 w-7 rounded-full flex items-center justify-center font-extrabold text-[11px] shrink-0 border shadow-2xs ${getAvatarColor(
                                    log.nama
                                  )}`}
                                >
                                  {getInitials(log.nama)}
                                </div>
                                <span className="truncate">{log.nama}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-extrabold border ${
                                  log.kategori === "Mahasiswa"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : log.kategori === "Dosen"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {log.kategori || "Mahasiswa"}
                              </span>
                            </td>
                            <td className="py-2.5 px-2">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  log.status === "Masuk"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                onClick={() => {
                                  const mData: Member = matchedMember || {
                                    id: `M_${log.id}`,
                                    nim: log.nim,
                                    nama: log.nama,
                                    prodi: log.prodi,
                                    email: log.email || "",
                                    noHp: log.noHp || "",
                                    rfidTag: log.rfidTag,
                                    status: log.kategori || "Mahasiswa",
                                    dateRegistered: "",
                                  };
                                  setViewingMember(mData);
                                }}
                                title={`Lihat Kartu Identitas (${log.nama})`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition-all hover:bg-indigo-600 hover:text-white shadow-2xs group cursor-pointer"
                              >
                                <User className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Belum ada data kunjungan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredVisitorLogs.length > 0 && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div>
                    Halaman <span className="font-bold text-slate-700">{currentVisitorLogPage}</span> dari{" "}
                    <span className="font-bold text-slate-700">{totalVisitorLogPages}</span> ({filteredVisitorLogs.length} total data)
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={currentVisitorLogPage <= 1}
                      onClick={() => setVisitorLogPage((prev) => Math.max(1, prev - 1))}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={currentVisitorLogPage >= totalVisitorLogPages}
                      onClick={() => setVisitorLogPage((prev) => Math.min(totalVisitorLogPages, prev + 1))}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      case "log_buku": {
        const totalBookLogPages = Math.max(1, Math.ceil(filteredBookLogs.length / BOOK_LOG_PAGE_SIZE));
        const currentBookLogPage = Math.min(bookLogPage, totalBookLogPages);
        const paginatedBookLogs = filteredBookLogs.slice(
          (currentBookLogPage - 1) * BOOK_LOG_PAGE_SIZE,
          currentBookLogPage * BOOK_LOG_PAGE_SIZE
        );

        return (
          <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md flex flex-col justify-between">
            <div>
              {renderCardHeaderWrapper(
                "LOG BUKU",
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      if (window.confirm("Bersihkan semua catatan log buku? Data di log akan direset.")) {
                        void clearBookLogs();
                        setBookLogPage(1);
                      }
                    }}
                    className="flex items-center space-x-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-all cursor-pointer"
                    title="Bersihkan Log Buku"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    <span>Bersihkan</span>
                  </button>
                  <button
                    onClick={() =>
                      setExportModalConfig({
                        isOpen: true,
                        title: "Laporan Scan Inventaris Buku",
                        filenamePrefix: "log_buku_itk",
                        columns: bookExportColumns,
                        data: filteredBookLogs,
                      })
                    }
                    className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export</span>
                  </button>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari ISBN, judul, kategori..."
                  value={bookSearch}
                  onChange={(e) => {
                    setBookSearch(e.target.value);
                    setBookLogPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                />
              </div>

              {/* Log Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-2 px-2">WAKTU</th>
                      <th className="py-2 px-2">JUDUL BUKU</th>
                      <th className="py-2 px-2">LOKASI RAK</th>
                      <th className="py-2 px-2">RSSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                    {paginatedBookLogs.length > 0 ? (
                      paginatedBookLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-2 font-mono text-slate-500 text-[11px]">
                            {log.waktu}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-slate-900 max-w-[140px] truncate">
                            {log.judul}
                          </td>
                          <td className="py-2.5 px-2 font-semibold text-slate-800">
                            {log.lokasiRak}
                          </td>
                          <td className="py-2.5 px-2 font-mono font-bold text-[11px] text-emerald-600">
                            {log.rssi} dBm
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          Belum ada data scan buku.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredBookLogs.length > 0 && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div>
                    Halaman <span className="font-bold text-slate-700">{currentBookLogPage}</span> dari{" "}
                    <span className="font-bold text-slate-700">{totalBookLogPages}</span> ({filteredBookLogs.length} total data)
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={currentBookLogPage <= 1}
                      onClick={() => setBookLogPage((prev) => Math.max(1, prev - 1))}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={currentBookLogPage >= totalBookLogPages}
                      onClick={() => setBookLogPage((prev) => Math.min(totalBookLogPages, prev + 1))}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      case "rssi_monitor": {
        // Calculate points & smooth bezier path for RSSI Monitor
        const minRssi = -95;
        const maxRssi = -30;
        const rssiRange = maxRssi - minRssi; // 65
        const plotWidth = 450;
        const plotHeight = 150;
        const startX = 45;
        const startY = 25;
        const endY = startY + plotHeight; // 175

        const points = rssiHistory.map((pt, idx) => {
          const x = startX + (idx / Math.max(1, rssiHistory.length - 1)) * plotWidth;
          const clampedRssi = Math.min(maxRssi, Math.max(minRssi, pt.rssi));
          const y = startY + ((maxRssi - clampedRssi) / rssiRange) * plotHeight;
          return { ...pt, x, y };
        });

        // Smooth cubic bezier path string
        let pathD = "";
        if (points.length > 0) {
          pathD = `M ${points[0].x} ${points[0].y}`;
          for (let i = 0; i < points.length - 1; i++) {
            const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 2;
            const cp1y = points[i].y;
            const cp2x = points[i].x + (points[i + 1].x - points[i].x) / 2;
            const cp2y = points[i + 1].y;
            pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`;
          }
        }

        const areaD = points.length > 0 ? `${pathD} L ${points[points.length - 1].x} ${endY} L ${points[0].x} ${endY} Z` : "";
        const lastPt = points[points.length - 1];
        const lastRssi = lastPt ? lastPt.rssi : 0;
        const lastQuality = lastRssi > -54 ? "Kuat" : lastRssi > -72 ? "Sedang" : "Lemah";
        const lastQualityBg =
          lastRssi > -54
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : lastRssi > -72
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-rose-50 text-rose-700 border-rose-200";

        // Y-axis threshold heights
        const yKuat = startY + ((maxRssi - (-54)) / rssiRange) * plotHeight; // -54 dBm
        const ySedang = startY + ((maxRssi - (-72)) / rssiRange) * plotHeight; // -72 dBm

        return (
          <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              {renderCardHeaderWrapper(
                "RSSI MONITOR",
                <div className="flex items-center space-x-2">
                  {lastPt && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${lastQualityBg}`}>
                      Sinyal: {lastRssi} dBm ({lastQuality})
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                    <Clock className="h-3 w-3 mr-1" />
                    TX {txPower} dBm
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 border border-emerald-200">
                    {connectionStatus}
                  </span>
                </div>
              )}

              {/* Threshold & Signal Info Box */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 mb-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-4 font-semibold text-slate-600">
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-2xs" />
                    <span className="text-slate-700">Kuat &gt; -54 dBm</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-2xs" />
                    <span className="text-slate-700">Sedang -72 ~ -54 dBm</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-2xs" />
                    <span className="text-slate-700">Lemah &lt; -72 dBm</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Update tiap 3 dtk
                </div>
              </div>

              {/* RSSI Live Smooth Vector Chart */}
              <div className="relative h-60 w-full rounded-xl bg-slate-900/[0.02] border border-slate-100 p-1 flex items-center justify-center overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 520 210">
                  <defs>
                    <linearGradient id="rssiGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* Threshold Zones Background Fills */}
                  {/* Kuat Zone */}
                  <rect x={startX} y={startY} width={plotWidth} height={yKuat - startY} fill="#ecfdf5" opacity="0.6" />
                  {/* Sedang Zone */}
                  <rect x={startX} y={yKuat} width={plotWidth} height={ySedang - yKuat} fill="#fffbeb" opacity="0.6" />
                  {/* Lemah Zone */}
                  <rect x={startX} y={ySedang} width={plotWidth} height={endY - ySedang} fill="#fef2f2" opacity="0.6" />

                  {/* Horizontal Threshold Grid Lines */}
                  <line x1={startX} y1={startY} x2={startX + plotWidth} y2={startY} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1={startX} y1={yKuat} x2={startX + plotWidth} y2={yKuat} stroke="#10b981" strokeDasharray="4 4" strokeWidth="1.5" opacity="0.7" />
                  <line x1={startX} y1={ySedang} x2={startX + plotWidth} y2={ySedang} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth="1.5" opacity="0.7" />
                  <line x1={startX} y1={endY} x2={startX + plotWidth} y2={endY} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" />

                  {/* Y-Axis Label Text (dBm scale) */}
                  <text x={startX - 6} y={startY + 4} textAnchor="end" className="text-[9px] font-mono fill-slate-400 font-semibold">-30</text>
                  <text x={startX - 6} y={yKuat + 3} textAnchor="end" className="text-[9px] font-mono fill-emerald-600 font-bold">-54</text>
                  <text x={startX - 6} y={ySedang + 3} textAnchor="end" className="text-[9px] font-mono fill-amber-600 font-bold">-72</text>
                  <text x={startX - 6} y={endY + 3} textAnchor="end" className="text-[9px] font-mono fill-slate-400 font-semibold">-95</text>

                  {/* Area Fill Gradient Under Graph Line */}
                  {rfidActive && areaD && <path d={areaD} fill="url(#rssiGradient)" />}

                  {/* Smooth Bezier Signal Line */}
                  {rfidActive && pathD && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {!rfidActive && (
                    <text x={startX + plotWidth / 2} y={startY + plotHeight / 2} textAnchor="middle" className="text-xs font-semibold fill-slate-400">
                      Sinyal RFID Nonaktif (Klik Sakelar RFID untuk Memulai)
                    </text>
                  )}

                  {/* Plot Dots and Live Pulsing Highlight */}
                  {rfidActive &&
                    points.map((pt, idx) => {
                      const isLast = idx === points.length - 1;
                      const dotColor = pt.rssi > -54 ? "#10b981" : pt.rssi > -72 ? "#f59e0b" : "#ef4444";

                      return (
                        <g key={pt.id}>
                          {isLast && (
                            <circle cx={pt.x} cy={pt.y} r="10" fill="none" stroke={dotColor} className="animate-ping" opacity="0.6" />
                          )}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isLast ? "5.5" : "4"}
                            fill={dotColor}
                            stroke="#ffffff"
                            strokeWidth="2"
                          />

                          {/* Floating Value Tag over latest data point */}
                          {isLast && (
                            <g transform={`translate(${Math.min(startX + plotWidth - 26, Math.max(startX + 26, pt.x))}, ${Math.max(startY + 15, pt.y - 12)})`}>
                              <rect x="-24" y="-14" width="48" height="15" rx="7" fill={dotColor} />
                              <text x="0" y="-4" textAnchor="middle" fill="#ffffff" className="text-[9px] font-black font-mono">
                                {pt.rssi} dBm
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                  {/* X-Axis Timestamps */}
                  {rfidActive &&
                    points.map((pt, idx) => {
                      const showLabel = points.length <= 8 || idx % 2 === 0 || idx === points.length - 1;
                      if (!showLabel) return null;
                      return (
                        <text
                          key={`time-${pt.id}`}
                          x={pt.x}
                          y={endY + 18}
                          textAnchor="middle"
                          className="text-[9px] font-mono fill-slate-400"
                        >
                          {pt.time}
                        </text>
                      );
                    })}
                </svg>
              </div>
            </div>
          </div>
        );
      }

      case "aktivitas_terakhir":
        return (
          <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              {renderCardHeaderWrapper(
                "AKTIVITAS TERAKHIR",
                <ListFilter className="h-4 w-4 text-slate-400" />
              )}

              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {activities.length > 0 ? (
                  activities.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start space-x-3 rounded-xl bg-slate-50 p-2.5 transition-all hover:bg-blue-50/50"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-2xs border border-slate-200/60 text-slate-600 mt-0.5">
                        {act.iconType === "user" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : act.iconType === "book" ? (
                          <Radio className="h-3.5 w-3.5 text-blue-600" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-slate-800 leading-snug line-clamp-2">
                          {act.deskripsi}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                          {act.waktu}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-6 text-center">Belum ada aktivitas.</p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <button className="flex items-center justify-end w-full text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                <span>Lihat semua</span>
                <ChevronRight className="h-4 w-4 ml-0.5" />
              </button>
            </div>
          </div>
        );

      case "power_gauge":
        return (
          <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              {renderCardHeaderWrapper(
                "POWER GAUGE",
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                    txPower > 25
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : txPower > 12
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {txPower > 25 ? "Tinggi" : txPower > 12 ? "Sedang" : "Kuat"} - {txPower} dBm
                </span>
              )}

              <div className="flex flex-col items-center justify-center my-1">
                <div className="relative w-48 h-28 flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 100 68">
                    <path
                      d="M 18 40 A 32 32 0 0 1 82 40"
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="9"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 18 40 A 32 32 0 0 1 35 17"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="9"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 35 17 A 32 32 0 0 1 65 17"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="9"
                    />
                    <path
                      d="M 65 17 A 32 32 0 0 1 82 40"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="9"
                      strokeLinecap="round"
                    />

                    {(() => {
                      const angle = -180 + (txPower / 33) * 180;
                      const rad = (angle * Math.PI) / 180;
                      const nx = 50 + 25 * Math.cos(rad);
                      const ny = 40 + 25 * Math.sin(rad);
                      return (
                        <line
                          x1="50"
                          y1="40"
                          x2={nx}
                          y2={ny}
                          stroke="#1e293b"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      );
                    })()}
                    <circle cx="50" cy="40" r="3.5" fill="#0f172a" />

                    <text
                      x="50"
                      y="59"
                      textAnchor="middle"
                      className="text-[17px] font-black fill-slate-900"
                      style={{ fontStyle: "normal" }}
                    >
                      {txPower}
                    </text>
                  </svg>
                </div>

                <div className="text-center mt-1">
                  <div className="text-[10px] font-extrabold uppercase text-slate-800 tracking-wider">
                    TRANSMIT POWER
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono">
                    byte 0x14 - RC3 Series
                  </div>
                </div>
              </div>

              <div className="mt-3 px-2">
                <input
                  type="range"
                  min="0"
                  max="33"
                  value={txPower}
                  onChange={(e) => setTxPower(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between px-2 pt-3 border-t border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="flex items-end space-x-1 h-5">
                  <div className={`w-1.5 rounded-xs ${txPower >= 5 ? "h-2 bg-emerald-500" : "h-2 bg-slate-200"}`} />
                  <div className={`w-1.5 rounded-xs ${txPower >= 12 ? "h-3 bg-emerald-500" : "h-3 bg-slate-200"}`} />
                  <div className={`w-1.5 rounded-xs ${txPower >= 20 ? "h-4 bg-amber-500" : "h-4 bg-slate-200"}`} />
                  <div className={`w-1.5 rounded-xs ${txPower >= 26 ? "h-5 bg-amber-500" : "h-5 bg-slate-200"}`} />
                  <div className={`w-1.5 rounded-xs ${txPower >= 30 ? "h-6 bg-rose-500" : "h-6 bg-slate-200"}`} />
                </div>
                <span className="text-[10px] font-mono text-slate-400">0 dBm</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">33 dBm</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Helper to determine responsive column span class
  const getColSpanClass = (id: WidgetId) => {
    switch (id) {
      case "trend_kunjungan":
      case "distribusi_kategori":
      case "log_pengunjung":
      case "log_buku":
      case "rssi_monitor":
        return "lg:col-span-6";
      case "aktivitas_terakhir":
      case "power_gauge":
        return "lg:col-span-3";
      default:
        return "lg:col-span-6";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header Laporan & Analitik */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-base font-extrabold uppercase text-slate-800 tracking-wide">
            DASHBOARD UTAMA & MONITORING
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pusat kendali real-time log pengunjung, inventaris buku, dan grafik analitik Smart Library ITK.
          </p>
        </div>
      </div>

      {/* Helper Banner when layout unlocked */}
      {!isLayoutLocked && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-800 flex items-center justify-between shadow-2xs animate-fade-in">
          <div className="flex items-center space-x-2">
            <GripVertical className="h-4 w-4 text-blue-600 animate-bounce" />
            <span>
              <strong>Mode Pengaturan Layout Aktif!</strong> Tarik ikon genggam pada sudut kiri atas card untuk memindahkan posisi. Klik <strong>Layout Dikunci</strong> jika sudah selesai.
            </span>
          </div>
          <button
            onClick={() => setIsLayoutLocked(true)}
            className="rounded-lg bg-blue-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-blue-700"
          >
            Kunci Sekarang
          </button>
        </div>
      )}

      {/* Dynamic Drag and Drop Grid Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {widgetOrder.map((widgetId, index) => {
          const isBeingDragged = draggedIndex === index;
          const isOver = dragOverIndex === index;

          return (
            <div
              key={widgetId}
              draggable={!isLayoutLocked}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              className={`col-span-1 ${getColSpanClass(widgetId)} transition-all duration-200 ${
                !isLayoutLocked ? "hover:border-blue-400 hover:shadow-md cursor-grab" : ""
              } ${isBeingDragged ? "opacity-40 scale-95 border-dashed border-2 border-blue-400" : ""} ${
                isOver ? "border-2 border-blue-600 bg-blue-50/20 scale-[1.01]" : ""
              }`}
            >
              {renderWidget(widgetId)}
            </div>
          );
        })}
      </div>

      {/* MODAL VIEW MEMBER IDENTITY */}
      {viewingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-indigo-600" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  KARTU IDENTITAS ANGGOTA / PENGUNJUNG
                </h3>
              </div>
              <button
                onClick={() => setViewingMember(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Member Card Box */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-lg relative overflow-hidden border border-slate-700">
              <div className="absolute right-3 top-3 opacity-10 font-black text-6xl select-none font-mono text-slate-100">
                ITK
              </div>
              <div className="flex items-start space-x-3.5 relative z-10">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-base font-black shadow-inner">
                  {getInitials(viewingMember.nama)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="inline-block rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider mb-1 bg-white/10 text-slate-100 border border-white/15">
                    {viewingMember.status}
                  </span>
                  <h4 className="text-sm font-extrabold text-white truncate leading-snug">
                    {viewingMember.nama}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-300 mt-0.5">
                    {viewingMember.nim}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs relative z-10">
                <div>
                  <div className="text-[9px] text-slate-300 uppercase font-medium">PROGRAM STUDI / INSTANSI</div>
                  <div className="text-[11px] font-semibold text-slate-100">{viewingMember.prodi}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-slate-300 uppercase font-medium">UID ANGGOTA</div>
                  <div className="text-[11px] font-mono font-bold text-slate-100">{viewingMember.rfidTag}</div>
                </div>
              </div>
            </div>

            {/* Details List & Contact Actions */}
            <div className="space-y-2.5 text-xs text-slate-700">
              <a
                href={`tel:${viewingMember.noHp}`}
                className="flex items-center space-x-3 p-3 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all group"
              >
                <Phone className="h-4 w-4 text-slate-700 group-hover:scale-110 transition-transform shrink-0" />
                <div className="flex-1">
                  <span className="text-[9px] text-slate-700 block font-bold">TELEPON / WHATSAPP (KLIK UNTUK TELEPON)</span>
                  <span className="font-bold font-mono text-slate-900">{viewingMember.noHp}</span>
                </div>
              </a>

              <a
                href={`mailto:${viewingMember.email}`}
                className="flex items-center space-x-3 p-3 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all group"
              >
                <Mail className="h-4 w-4 text-slate-700 group-hover:scale-110 transition-transform shrink-0" />
                <div className="flex-1 truncate">
                  <span className="text-[9px] text-slate-700 block font-bold">EMAIL REGISTRASI (KLIK UNTUK KIRIM EMAIL)</span>
                  <span className="font-bold text-slate-900 truncate block">{viewingMember.email}</span>
                </div>
              </a>
            </div>

            {/* Close button */}
            <div className="pt-2">
              <button
                onClick={() => setViewingMember(null)}
                className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-white hover:bg-slate-900 transition-all shadow-md"
              >
                Tutup Kartu Identitas
              </button>
            </div>
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

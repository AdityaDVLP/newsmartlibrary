"use client";

import React, { useState } from "react";
import {
  Download,
  X,
  FileSpreadsheet,
  FileText,
  FileCode,
  Database,
  CheckCircle2,
  Table as TableIcon,
} from "lucide-react";
import {
  ExportColumn,
  exportToCSV,
  exportToXLSX,
  exportToPDF,
  exportToBSON,
} from "../utils/exportUtils";

export type { ExportColumn } from "../utils/exportUtils";

export type ExportFormat = "csv" | "xlsx" | "pdf" | "bson";

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  filenamePrefix: string;
  columns: ExportColumn[];
  data: any[];
}

export default function ExportModal({
  isOpen,
  onClose,
  title,
  filenamePrefix,
  columns,
  data,
}: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("xlsx");
  const [customFilename, setCustomFilename] = useState(
    `${filenamePrefix}_${new Date().toISOString().split("T")[0]}`
  );
  const [isExporting, setIsExporting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  if (!isOpen) return null;

  const handleExecuteExport = () => {
    setIsExporting(true);

    setTimeout(() => {
      const finalFilename = customFilename.trim() || filenamePrefix;

      switch (selectedFormat) {
        case "csv":
          exportToCSV(finalFilename, title, columns, data);
          break;
        case "xlsx":
          exportToXLSX(finalFilename, title, columns, data);
          break;
        case "pdf":
          exportToPDF(finalFilename, title, columns, data);
          break;
        case "bson":
          exportToBSON(finalFilename, title, columns, data);
          break;
      }

      setIsExporting(false);
      setShowSuccessToast(true);

      setTimeout(() => {
        setShowSuccessToast(false);
        onClose();
      }, 1500);
    }, 400);
  };

  const formats: {
    id: ExportFormat;
    label: string;
    ext: string;
    desc: string;
    icon: React.ReactNode;
    colorClass: string;
    bgBadge: string;
  }[] = [
    {
      id: "csv",
      label: "CSV (Comma Separated)",
      ext: ".csv",
      desc: "Format teks standar dengan BOM UTF-8 (Kompatibel Excel & Google Sheets)",
      icon: <FileText className="h-5 w-5 text-emerald-600" />,
      colorClass: "border-emerald-500 bg-emerald-50/40 text-emerald-950",
      bgBadge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    },
    {
      id: "xlsx",
      label: "Excel Spreadsheet",
      ext: ".xlsx",
      desc: "Format Microsoft Excel resmi dengan Styling Header Biru & Cell Gridlines",
      icon: <FileSpreadsheet className="h-5 w-5 text-blue-600" />,
      colorClass: "border-blue-500 bg-blue-50/40 text-blue-950",
      bgBadge: "bg-blue-100 text-blue-800 border-blue-300",
    },
    {
      id: "pdf",
      label: "Dokumen PDF Report",
      ext: ".pdf",
      desc: "Layout laporan siap cetak A4 dengan Kop ITK Smart Library & Kolom TTD",
      icon: <FileCode className="h-5 w-5 text-rose-600" />,
      colorClass: "border-rose-500 bg-rose-50/40 text-rose-950",
      bgBadge: "bg-rose-100 text-rose-800 border-rose-300",
    },
    {
      id: "bson",
      label: "Binary BSON Data Dump",
      ext: ".bson",
      desc: "Format BSON Binary JSON resmi (Kompatibel MongoDB & BSON Parsers)",
      icon: <Database className="h-5 w-5 text-indigo-600" />,
      colorClass: "border-indigo-500 bg-indigo-50/40 text-indigo-950",
      bgBadge: "bg-indigo-100 text-indigo-800 border-indigo-300",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                EKSPOR DATA PERPUSTAKAAN
              </h3>
              <p className="text-[11px] text-slate-400">
                Pilih format & sesuaikan opsi susunan data sebelum mengunduh
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dataset Summary Banner */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-xs">
          <div className="flex items-center space-x-2">
            <TableIcon className="h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-700">Dataset: <strong>{title}</strong></span>
          </div>
          <span className="rounded-md bg-blue-50 px-2.5 py-0.5 font-bold text-blue-700 border border-blue-200 text-[11px]">
            {data.length} Rekaman Data
          </span>
        </div>

        {/* Format Selection Cards (4 Options) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            PILIH FORMAT FILE EKSPOR:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {formats.map((fmt) => {
              const isSelected = selectedFormat === fmt.id;
              return (
                <button
                  type="button"
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`flex flex-col justify-between rounded-xl p-3.5 border text-left transition-all relative ${
                    isSelected
                      ? `${fmt.colorClass} ring-2 ring-blue-500/40 shadow-xs`
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      {fmt.icon}
                      <span className="font-extrabold text-xs text-slate-900">{fmt.label}</span>
                    </div>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold border ${fmt.bgBadge}`}>
                      {fmt.ext}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                    {fmt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Filename Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            NAMA FILE EKSPOR:
          </label>
          <div className="flex items-center space-x-1">
            <input
              type="text"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              placeholder="Masukkan nama file..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-mono text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
            />
            <span className="rounded-xl bg-slate-100 px-3 py-2.5 font-mono text-xs font-bold text-slate-600 border border-slate-200">
              .{selectedFormat}
            </span>
          </div>
        </div>

        {/* Live Data Preview (Top 3 Rows) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              PREVIEW PRATINJAU SUSUNAN DATA (3 BARIS PERTAMA):
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {columns.length} Kolom Dikirim
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/50 max-h-36">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                  {columns.map((col) => (
                    <th key={col.key} className="py-2 px-2.5 whitespace-nowrap">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {data.slice(0, 3).map((item, idx) => (
                  <tr key={idx} className="hover:bg-white">
                    {columns.map((col) => {
                      let val = item[col.key];
                      if (col.formatter) {
                        val = col.formatter(val, item);
                      }
                      return (
                        <td key={col.key} className="py-1.5 px-2.5 truncate max-w-[140px]">
                          {val !== null && val !== undefined ? String(val) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Toast feedback */}
        {showSuccessToast && (
          <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-bold animate-fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>File <strong>{customFilename}.{selectedFormat}</strong> berhasil diunduh!</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isExporting || data.length === 0}
            onClick={handleExecuteExport}
            className="flex items-center space-x-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            <Download className="h-4 w-4" />
            <span>
              {isExporting ? "Memproses..." : `Unduh File (${selectedFormat.toUpperCase()})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

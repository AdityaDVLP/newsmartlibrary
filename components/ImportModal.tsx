"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  X,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
  Table as TableIcon,
  RefreshCw,
  Radio,
} from "lucide-react";

export interface ImportColumnDefinition {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[];
  defaultValue?: string;
  isTagField?: boolean; // For UID / EPC tag fields
}

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entityName: string; // e.g. "Anggota" atau "Buku"
  columns: ImportColumnDefinition[];
  sampleData: Record<string, string>[];
  onImport: (rows: Record<string, string>[]) => Promise<{ successCount: number; errorCount: number; errorMessage?: string }>;
}

export default function ImportModal({
  isOpen,
  onClose,
  title,
  entityName,
  columns,
  sampleData,
  onImport,
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{ successCount: number; errorCount: number; errorMessage?: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setParseErrors([]);
    setImportResult(null);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Helper: Parse CSV text into array of objects with delimiter auto-detection
  const parseCSVText = (text: string) => {
    const lines = text
      .split(/\r\n|\n|\r/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setParseErrors(["File CSV harus memiliki baris judul kolom (header) dan minimal 1 baris data."]);
      setParsedData([]);
      return;
    }

    // Detect delimiter: semicolon or comma or tab
    const firstLine = lines[0];
    let delimiter = ",";
    if (firstLine.includes(";") && (firstLine.split(";").length > firstLine.split(",").length)) {
      delimiter = ";";
    } else if (firstLine.includes("\t") && (firstLine.split("\t").length > firstLine.split(",").length)) {
      delimiter = "\t";
    }

    // Split line respecting quotes
    const splitRow = (rowStr: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, "").trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, "").trim());
      return result;
    };

    const rawHeaders = splitRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

    // Map columns by matching keys and aliases
    const headerMapping: { [colKey: string]: number } = {};
    columns.forEach((col) => {
      const candidates = [
        col.key.toLowerCase().replace(/[^a-z0-9]/g, ""),
        col.label.toLowerCase().replace(/[^a-z0-9]/g, ""),
        ...(col.aliases || []).map((a) => a.toLowerCase().replace(/[^a-z0-9]/g, "")),
      ];

      const foundIndex = rawHeaders.findIndex((h) => candidates.includes(h));
      if (foundIndex !== -1) {
        headerMapping[col.key] = foundIndex;
      }
    });

    const rows: Record<string, string>[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = splitRow(lines[i]);
      if (values.every((v) => !v)) continue; // skip blank lines

      const rowObj: Record<string, string> = {};
      let rowMissingRequired = false;

      columns.forEach((col) => {
        const colIdx = headerMapping[col.key];
        let val = colIdx !== undefined && values[colIdx] !== undefined ? values[colIdx].trim() : "";

        if (!val && col.defaultValue) {
          val = col.defaultValue;
        }

        // If tag field (UID / EPC) is empty, assign "Belum Ada"
        if (col.isTagField) {
          if (!val || val === "-" || val.toLowerCase() === "null" || val.toLowerCase() === "belum ada") {
            val = "Belum Ada";
          }
        }

        if (col.required && !val) {
          errors.push(`Baris ${i + 1}: Kolom "${col.label}" wajib diisi.`);
          rowMissingRequired = true;
        }

        rowObj[col.key] = val;
      });

      if (!rowMissingRequired) {
        rows.push(rowObj);
      }
    }

    setParsedData(rows);
    setParseErrors(errors);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          parseCSVText(text);
        }
      };
      reader.readAsText(selectedFile, "UTF-8");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setImportResult(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          parseCSVText(text);
        }
      };
      reader.readAsText(droppedFile, "UTF-8");
    }
  };

  const handleDownloadTemplate = () => {
    const headers = columns.map((c) => `"${c.label}"`).join(",");
    const sampleRows = sampleData.map((row) =>
      columns.map((c) => `"${(row[c.key] ?? "").replace(/"/g, '""')}"`).join(",")
    );

    const csvContent = "\uFEFF" + [headers, ...sampleRows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `template_impor_${entityName.toLowerCase().replace(/[^a-z0-9]/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExecuteImport = async () => {
    if (parsedData.length === 0) return;
    setIsProcessing(true);
    setImportResult(null);

    try {
      const res = await onImport(parsedData);
      setImportResult(res);
      if (res.errorCount === 0) {
        setTimeout(() => {
          handleClose();
        }, 1800);
      }
    } catch (err) {
      setImportResult({
        successCount: 0,
        errorCount: parsedData.length,
        errorMessage: err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan data impor.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Find tag column key to display badge in preview
  const tagCol = columns.find((c) => c.isTagField);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 shadow-2xs">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                {title}
              </h2>
              <p className="text-xs text-slate-400">
                Impor data {entityName} dari file CSV. Tag RFID / EPC yang belum ada dapat diisi nanti.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Template Info Card */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                <span>Format Template CSV</span>
              </span>
              <p className="text-[11px] text-blue-700/80 leading-relaxed max-w-md">
                Gunakan format template yang sesuai. Jika data lama belum memiliki RFID/EPC, kolom tersebut boleh dikosongkan dan akan otomatis diberi status <strong>&quot;Belum Ada&quot;</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-1.5 rounded-xl border border-blue-300 bg-white px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>Unduh Template CSV</span>
            </button>
          </div>

          {/* File Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-blue-500 bg-blue-50/50"
                : file
                ? "border-emerald-400 bg-emerald-50/20"
                : "border-slate-200 bg-slate-50/40 hover:border-blue-300 hover:bg-slate-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl mb-3 shadow-2xs ${
                file ? "bg-emerald-100 text-emerald-600" : "bg-blue-50 text-blue-600"
              }`}
            >
              {file ? <FileSpreadsheet className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
            </div>
            {file ? (
              <div>
                <p className="text-xs font-bold text-slate-800">{file.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB &bull; Klik atau seret file lain untuk mengganti
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-slate-700">
                  Pilih file CSV atau seret ke area ini
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Mendukung format file <code>.csv</code> standar UTF-8
                </p>
              </div>
            )}
          </div>

          {/* Parse Errors */}
          {parseErrors.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 space-y-1">
              <div className="font-bold flex items-center space-x-1.5">
                <AlertCircle className="h-4 w-4" />
                <span>Terdapat kesalahan pada file CSV:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                {parseErrors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
                {parseErrors.length > 5 && <li>...dan {parseErrors.length - 5} kesalahan lainnya.</li>}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold flex items-center space-x-1 text-slate-700">
                  <TableIcon className="h-3.5 w-3.5 text-blue-600" />
                  <span>Pratinjau Data ({parsedData.length} baris terdeteksi):</span>
                </span>
                {tagCol && (
                  <span className="text-[11px] text-slate-500">
                    <strong className="text-emerald-700">
                      {parsedData.filter((r) => r[tagCol.key] && r[tagCol.key] !== "Belum Ada").length}
                    </strong>{" "}
                    ada tag &bull;{" "}
                    <strong className="text-amber-700">
                      {parsedData.filter((r) => !r[tagCol.key] || r[tagCol.key] === "Belum Ada").length}
                    </strong>{" "}
                    belum ada tag
                  </span>
                )}
              </div>

              <div className="overflow-x-auto max-h-56 rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      {columns.map((c) => (
                        <th key={c.key} className="py-2.5 px-3">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {parsedData.slice(0, 8).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                        {columns.map((c) => {
                          const val = row[c.key] || "";
                          if (c.isTagField) {
                            return (
                              <td key={c.key} className="py-2 px-3">
                                {val && val !== "Belum Ada" ? (
                                  <span className="inline-flex items-center space-x-1 font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    <Radio className="h-2.5 w-2.5 text-emerald-500" />
                                    <span className="truncate max-w-[120px]">{val}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    <AlertCircle className="h-2.5 w-2.5 text-amber-500" />
                                    <span>Belum Ada</span>
                                  </span>
                                )}
                              </td>
                            );
                          }
                          return (
                            <td key={c.key} className="py-2 px-3 truncate max-w-[140px]">
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 8 && (
                <p className="text-[10px] text-slate-400 text-right">
                  Menampilkan 8 baris pertama dari total {parsedData.length} baris
                </p>
              )}
            </div>
          )}

          {/* Import Result Notification */}
          {importResult && (
            <div
              className={`rounded-2xl border p-4 text-xs ${
                importResult.errorCount === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <div className="flex items-center space-x-2 font-bold">
                {importResult.errorCount === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                )}
                <span>
                  {importResult.errorCount === 0
                    ? `Berhasil mengimpor ${importResult.successCount} data ${entityName}!`
                    : `Selesai: ${importResult.successCount} berhasil, ${importResult.errorCount} gagal.`}
                </span>
              </div>
              {importResult.errorMessage && (
                <p className="mt-1 text-[11px] text-rose-700">{importResult.errorMessage}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <div className="text-xs text-slate-400">
            {parsedData.length > 0 ? `${parsedData.length} data siap diimpor` : "Silakan pilih file CSV"}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={parsedData.length === 0 || isProcessing}
              className="flex items-center space-x-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  <span>Mulai Impor ({parsedData.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

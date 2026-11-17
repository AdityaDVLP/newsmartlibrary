"use client";

import React, { useState } from "react";
import {
  Settings,
  Radio,
  Sliders,
  CheckCircle,
  Save,
  Server,
  Wifi,
  Volume2,
} from "lucide-react";
import { useLibrary } from "../../context/LibraryContext";

export default function PengaturanPage() {
  const { txPower, setTxPower, rfidActive, toggleRfid } = useLibrary();

  const [ipAddress, setIpAddress] = useState("192.168.1.150");
  const [port, setPort] = useState("5084");
  const [readerModel, setReaderModel] = useState("RC3-UHF-8PORT");
  const [strongThreshold, setStrongThreshold] = useState(-54);
  const [mediumThreshold, setMediumThreshold] = useState(-72);
  const [soundFeedback, setSoundFeedback] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-blue-600" />
            <h1 className="text-base font-extrabold uppercase text-slate-800 tracking-wide">
              PENGATURAN HARDWARE RFID & SISTEM
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Konfigurasi koneksi RFID Reader UHF RC3 Series, kalibrasi sinyal RSSI, dan parameter pembacaan gate.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 border border-emerald-200 animate-fade-in">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span>Pengaturan Berhasil Disimpan!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* RFID Reader Connection Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Server className="h-4 w-4 text-blue-600" />
            <h2 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">
              KONEKSI HARDWARE RFID READER
            </h2>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Model RFID Reader
            </label>
            <select
              value={readerModel}
              onChange={(e) => setReaderModel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-semibold"
            >
              <option value="RC3-UHF-8PORT">RC3 Series 8-Port Antenna UHF Reader</option>
              <option value="RC3-UHF-4PORT">RC3 Series 4-Port Fixed Reader</option>
              <option value="SIMULATOR-SOFT">RFID Software Simulator Mode</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                IP Address Reader
              </label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Port</label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold text-slate-700">Status Pembacaan RFID</span>
            <button
              type="button"
              onClick={toggleRfid}
              className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                rfidActive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              <Radio className="h-4 w-4" />
              <span>{rfidActive ? "RFID Aktif (Scanning)" : "RFID Paused"}</span>
            </button>
          </div>
        </div>

        {/* Transmission Power & RSSI Thresholds Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Wifi className="h-4 w-4 text-emerald-600" />
            <h2 className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">
              DAYA TRANSMISI & KALIBRASI RSSI
            </h2>
          </div>

          {/* Transmit Power Slider */}
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Transmit Power (TX Power)</span>
              <span className="font-mono text-blue-600">{txPower} dBm</span>
            </div>
            <input
              type="range"
              min="0"
              max="33"
              value={txPower}
              onChange={(e) => setTxPower(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>0 dBm (Min)</span>
              <span>20 dBm (Standard)</span>
              <span>33 dBm (Max Power)</span>
            </div>
          </div>

          {/* Strong Threshold */}
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Batas Sinyal Kuat (Green Zone)</span>
              <span className="font-mono text-emerald-600">&gt; {strongThreshold} dBm</span>
            </div>
            <input
              type="range"
              min="-70"
              max="-40"
              value={strongThreshold}
              onChange={(e) => setStrongThreshold(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Medium Threshold */}
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Batas Sinyal Sedang (Yellow Zone)</span>
              <span className="font-mono text-amber-600">{mediumThreshold} dBm s/d {strongThreshold} dBm</span>
            </div>
            <input
              type="range"
              min="-90"
              max="-60"
              value={mediumThreshold}
              onChange={(e) => setMediumThreshold(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Sound Feedback Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-2">
              <Volume2 className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700">Audio Beep pada Tag Detected</span>
            </div>
            <input
              type="checkbox"
              checked={soundFeedback}
              onChange={(e) => setSoundFeedback(e.target.checked)}
              className="h-4 w-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Submit Save Button */}
        <div className="lg:col-span-2 flex justify-end">
          <button
            type="submit"
            className="flex items-center space-x-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
          >
            <Save className="h-4 w-4" />
            <span>Simpan Perubahan Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  );
}

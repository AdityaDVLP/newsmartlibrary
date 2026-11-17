"use client";

import React, { useState } from "react";
import { Menu, User, Radio, Play, Pause, ChevronDown, Bell } from "lucide-react";
import { useLibrary } from "../context/LibraryContext";

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Header: React.FC<HeaderProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const { rfidActive, toggleRfid, connectionStatus, simulateVisitorScan, simulateBookScan } = useLibrary();
  const [showSimMenu, setShowSimMenu] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 shadow-xs">
        {/* Left section: Logo & Sidebar toggle */}
        <div className="flex items-center space-x-4">
          {/* Menu toggle button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus:outline-none"
            title="Toggle Sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-blue-900 leading-none uppercase">
                UPA PERPUSTAKAAN
              </h1>
              <p className="text-[10px] font-medium tracking-wider text-slate-500 uppercase mt-0.5">
                INSTITUT TEKNOLOGI KALIMANTAN
              </p>
            </div>
          </div>
        </div>

        {/* Right section: Controls, RFID Status, Admin Profile */}
        <div className="flex items-center space-x-3 md:space-x-5">
          {/* Simulation Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSimMenu(!showSimMenu)}
              className="flex items-center space-x-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all"
            >
              <Radio className="h-3.5 w-3.5 animate-pulse text-blue-600" />
              <span>Simulasi Scan</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {showSimMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white p-2 shadow-lg border border-slate-100 z-50 text-xs">
                <button
                  onClick={() => {
                    simulateVisitorScan();
                    setShowSimMenu(false);
                  }}
                  className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-left font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <User className="h-4 w-4 text-blue-500" />
                  <span>Simulasi Tap Anggota</span>
                </button>
                <button
                  onClick={() => {
                    simulateBookScan();
                    setShowSimMenu(false);
                  }}
                  className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-left font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Radio className="h-4 w-4 text-emerald-500" />
                  <span>Simulasi Scan Buku</span>
                </button>
              </div>
            )}
          </div>

          {/* RFID Global Toggle indicator */}
          <button
            onClick={toggleRfid}
            className={`flex items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${
              rfidActive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            }`}
          >
            {rfidActive ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>RFID Active</span>
              </>
            ) : (
              <>
                <Pause className="h-3 w-3 text-amber-600" />
                <span>RFID Paused</span>
              </>
            )}
          </button>

          {/* User Profile */}
          <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
            <div className="hidden text-right md:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                ADMIN PERPUSTAKAAN
              </div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                ADMIN
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
              <User className="h-5 w-5" />
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-2 md:px-6">
        <div className="flex items-center justify-end">
          <div className="relative">
            <button
              onClick={() => setShowSimMenu(!showSimMenu)}
              className="flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700 shadow-sm hover:bg-blue-50"
            >
              <span>Petunjuk</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {showSimMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg z-50">
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Panduan kerja
                </div>
                <button
                  onClick={() => setShowSimMenu(false)}
                  className="mt-1 flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span>Verifikasi nama, UID, dan status anggota sebelum melanjutkan proses.</span>
                </button>
                <button
                  onClick={() => setShowSimMenu(false)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Gunakan tombol kontak untuk komunikasi cepat dengan anggota atau pengunjung.</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserPlus,
  BookPlus,
  Settings,
  Box,
  BookCheck,
} from "lucide-react";

interface SidebarProps {
  sidebarOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen }) => {
  const pathname = usePathname();

  const menuItems = [
    {
      title: "DASHBOARD",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "PENDAFTARAN ANGGOTA",
      href: "/pendaftaran/anggota",
      icon: UserPlus,
    },
    {
      title: "PENDAFTARAN BUKU",
      href: "/pendaftaran/buku",
      icon: BookPlus,
    },
    {
      title: "PEMINJAMAN BUKU",
      href: "/peminjaman",
      icon: BookCheck,
    },
    {
      title: "PENGATURAN",
      href: "/pengaturan",
      icon: Settings,
    },
  ];

  return (
    <aside
      className={`fixed top-16 bottom-0 left-0 z-20 flex flex-col justify-between border-r border-slate-200 bg-white transition-all duration-300 max-md:shadow-xl ${
        sidebarOpen
          ? "w-64 max-md:-translate-x-full"
          : "w-16 max-md:w-64 max-md:translate-x-0"
      }`}
    >
      <div className="flex flex-col gap-1 p-3">
        {menuItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center rounded-xl px-3 py-3 text-xs font-bold transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              title={!sidebarOpen ? item.title : undefined}
            >
              <Icon
                className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-105 ${
                  isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700"
                }`}
              />
              {sidebarOpen && (
                <span className="ml-3 truncate tracking-wide">{item.title}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom section with Box icon container as shown in screenshot */}
      <div className="p-3">
        <div
          className={`flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-3 text-slate-500 transition-all ${
            sidebarOpen ? "px-3 justify-between" : "px-0"
          }`}
        >
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Box className="h-4 w-4" />
            </div>
            {sidebarOpen && (
              <div className="text-left">
                <div className="text-[11px] font-bold text-slate-700">RC3 Scanner</div>
                <div className="text-[9px] text-emerald-600 font-semibold">Online (20 dBm)</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { LibraryProvider } from "../context/LibraryContext";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  if (pathname === "/") {
    return <LibraryProvider>{children}</LibraryProvider>;
  }

  return (
    <LibraryProvider>
      <div className="min-h-screen bg-[#f4f6f9] text-slate-800 flex flex-col font-sans">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex flex-1 relative">
          <Sidebar sidebarOpen={sidebarOpen} />
          <main
            className={`ml-0 min-w-0 flex-1 p-4 transition-all duration-300 md:p-6 ${
              sidebarOpen ? "md:ml-64" : "md:ml-16"
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </LibraryProvider>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LibraryProvider } from "../context/LibraryContext";
import { supabase } from "../lib/supabase";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const pathname = usePathname();
  const hasStaffAccess = user?.app_metadata.library_role === "staff";

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setSigningIn(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Login gagal. Periksa email dan kata sandi.");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
  };

  const authNotice = authError && (
    <div role="alert" className="fixed right-4 top-4 z-[110] max-w-lg rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-800 shadow-lg">
      {authError}
      <button type="button" onClick={() => setAuthError("")} className="ml-3 font-semibold">
        Tutup
      </button>
    </div>
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Memeriksa sesi staf...
      </div>
    );
  }

  if (!supabase || !user || !hasStaffAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <form onSubmit={handleSignIn} className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-lg">
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900">Login Staf Perpustakaan</h1>
            <p className="mt-2 text-sm text-slate-600">
              Masuk dengan akun staf yang dibuat di Supabase Authentication.
            </p>
          </div>

          {!supabase && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              Konfigurasi Supabase belum tersedia. Periksa variabel NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
            </p>
          )}

          {user && !hasStaffAccess && (
            <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Akun ini belum diberi akses staf. Administrator harus mengatur App Metadata
              <code className="mx-1 rounded bg-amber-100 px-1">library_role: staff</code>
              di Supabase.
            </p>
          )}

          {authError && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {authError}
            </p>
          )}

          {!user ? (
            <>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Email staf
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                />
              </label>

              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Kata sandi
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                />
              </label>

              <button
                type="submit"
                disabled={!supabase || signingIn}
                className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingIn ? "Memproses..." : "Masuk"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Keluar dari akun
            </button>
          )}
          <p className="text-center text-xs text-slate-500">
            Pembuatan akun dilakukan oleh administrator di Supabase; pendaftaran publik tidak tersedia.
          </p>
        </form>
      </main>
    );
  }

  if (pathname === "/") {
    return (
      <LibraryProvider>
        {authNotice}
        {children}
      </LibraryProvider>
    );
  }

  return (
    <LibraryProvider>
      <div className="min-h-screen bg-[#f4f6f9] text-slate-800 flex flex-col font-sans">
        {authNotice}
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          userEmail={user.email ?? ""}
          onSignOut={() => void handleSignOut()}
        />
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

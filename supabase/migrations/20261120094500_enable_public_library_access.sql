-- ==============================================================================
-- Migrasi: Buka Akses Penuh ke Tabel Operasional Smart Library untuk Publik / Anon
-- File: supabase/migrations/20261120094500_enable_public_library_access.sql
-- ==============================================================================
-- Keterangan:
-- Setelah layar login staf dinonaktifkan (akses langsung dashboard tanpa auth),
-- koneksi web app dari browser berjalan di bawah role 'anon'.
-- Script ini memberikan hak akses SELECT, INSERT, UPDATE, DELETE ke role 'anon'
-- dan menonaktifkan RLS pada tabel operasional perpustakaan.

-- 1. Izin Skema & Tabel
grant usage on schema public to anon, authenticated, service_role;

grant all on table
  public.members,
  public.books,
  public.visitor_logs,
  public.book_logs,
  public.activities,
  public.rssi_history,
  public.device_status,
  public.book_loans
to anon, authenticated, service_role;

grant usage, select, update on all sequences in schema public to anon, authenticated, service_role;

-- 2. Nonaktifkan RLS pada tabel operasional dashboard perpustakaan
alter table public.members disable row level security;
alter table public.books disable row level security;
alter table public.visitor_logs disable row level security;
alter table public.book_logs disable row level security;
alter table public.activities disable row level security;
alter table public.rssi_history disable row level security;
alter table public.device_status disable row level security;
alter table public.book_loans disable row level security;

-- 3. Izinkan kolom rfid_tag bernilai NULL pada members dan books
alter table public.members alter column rfid_tag drop not null;
alter table public.books alter column rfid_tag drop not null;

-- 4. Hapus constraint unique lama jika mengunci null/unassigned, lalu perbarui index
alter table public.members drop constraint if exists members_rfid_tag_key;
alter table public.books drop constraint if exists books_rfid_tag_key;

drop index if exists public.members_rfid_tag_normalized_uidx;
create unique index if not exists members_rfid_tag_normalized_uidx
  on public.members (regexp_replace(upper(rfid_tag), '[^A-Z0-9]', '', 'g'))
  where rfid_tag is not null
    and rfid_tag <> ''
    and rfid_tag <> 'Belum Ada'
    and rfid_tag <> '-'
    and rfid_tag not like 'UNASSIGNED%';

-- 5. Foreign Key Cascading pada book_loans
alter table public.book_loans drop constraint if exists book_loans_member_id_fkey;
alter table public.book_loans
  add constraint book_loans_member_id_fkey
    foreign key (member_id)
    references public.members(id)
    on delete cascade;

alter table public.book_loans drop constraint if exists book_loans_book_id_fkey;
alter table public.book_loans
  add constraint book_loans_book_id_fkey
    foreign key (book_id)
    references public.books(id)
    on delete cascade;

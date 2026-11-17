create table if not exists public.visitor_logs (
  id text primary key,
  waktu text not null,
  nama text not null,
  nim text not null,
  prodi text not null,
  kategori text not null check (kategori in ('Mahasiswa', 'Dosen', 'Visitor')),
  status text not null check (status in ('Masuk', 'Keluar', 'Pinjam Buku')),
  rfid_tag text not null,
  email text,
  no_hp text
);

create index if not exists visitor_logs_waktu_idx
  on public.visitor_logs (waktu desc);

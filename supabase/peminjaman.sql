create table if not exists public.book_loans (
  id text primary key,
  member_id text not null,
  member_name text not null,
  member_nim text not null,
  book_id text not null,
  book_tag_id text,
  book_title text not null,
  book_isbn text not null,
  borrowed_at date not null default current_date,
  due_at date not null,
  returned_at date,
  status text not null check (status in ('Dipinjam', 'Dikembalikan')) default 'Dipinjam',
  check (due_at >= borrowed_at),
  check (returned_at is null or returned_at >= borrowed_at)
);

alter table public.book_loans
  add column if not exists book_tag_id text;

create unique index if not exists book_loans_active_tag_uidx
  on public.book_loans (regexp_replace(upper(book_tag_id), '[^A-Z0-9]', '', 'g'))
  where status = 'Dipinjam' and book_tag_id is not null;

create index if not exists book_loans_member_status_idx
  on public.book_loans (member_id, status);

create index if not exists book_loans_status_due_idx
  on public.book_loans (status, due_at);

alter table public.book_loans enable row level security;

drop policy if exists "Allow anon read book loans" on public.book_loans;
create policy "Allow anon read book loans"
  on public.book_loans
  for select
  to anon, authenticated
  using (true);

grant select on public.book_loans to anon, authenticated;

drop function if exists public.borrow_book(text, text, text, date);

create or replace function public.borrow_book(
  p_loan_id text,
  p_member_id text,
  p_book_id text,
  p_book_tag_id text,
  p_due_at date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_book public.books%rowtype;
  v_active_loans integer;
begin
  select * into v_member
  from public.members
  where id = p_member_id
  for update;

  if not found then
    raise exception 'Anggota tidak ditemukan.';
  end if;

  select count(*) into v_active_loans
  from public.book_loans
  where member_id = p_member_id and status = 'Dipinjam';

  if v_active_loans >= 1 then
    raise exception 'Anggota masih memiliki pinjaman aktif. Kembalikan buku tersebut sebelum meminjam judul lain.';
  end if;

  if exists (
    select 1 from public.book_loans
    where member_id = p_member_id
      and status = 'Dipinjam'
      and due_at < current_date
  ) then
    raise exception 'Anggota memiliki pinjaman yang sudah terlambat.';
  end if;

  if p_due_at <= current_date or p_due_at > current_date + 7 then
    raise exception 'Tanggal jatuh tempo harus antara 1 dan 7 hari ke depan.';
  end if;

  select * into v_book
  from public.books
  where id = p_book_id
  for update;

  if not found then
    raise exception 'Buku tidak ditemukan.';
  end if;

  if v_book.status = 'Dalam Perawatan' then
    raise exception 'Buku sedang dalam perawatan.';
  end if;

  if v_book.stok < 1 then
    raise exception 'Stok buku tidak tersedia.';
  end if;

  if exists (
    select 1 from public.book_loans
    where book_id = p_book_id
      and status = 'Dipinjam'
      and book_tag_id is null
  ) then
    raise exception 'Transaksi aktif lama belum memiliki ID tag EPC.';
  end if;

  if regexp_replace(upper(coalesce(p_book_tag_id, '')), '[^A-Z0-9]', '', 'g') = '' then
    raise exception 'ID tag EPC wajib dipilih.';
  end if;

  if regexp_replace(upper(coalesce(v_book.rfid_tag, '')), '[^A-Z0-9]', '', 'g') <>
     regexp_replace(upper(p_book_tag_id), '[^A-Z0-9]', '', 'g')
     and not exists (
       select 1
       from unnest(coalesce(v_book.epc_list, array[]::text[])) as epc(tag)
       where regexp_replace(upper(epc.tag), '[^A-Z0-9]', '', 'g') =
             regexp_replace(upper(p_book_tag_id), '[^A-Z0-9]', '', 'g')
     ) then
    raise exception 'ID tag EPC tidak terdaftar pada buku yang dipilih.';
  end if;

  if exists (
    select 1 from public.book_loans
    where status = 'Dipinjam'
      and book_tag_id is not null
      and regexp_replace(upper(book_tag_id), '[^A-Z0-9]', '', 'g') =
          regexp_replace(upper(p_book_tag_id), '[^A-Z0-9]', '', 'g')
  ) then
    raise exception 'ID tag EPC ini sudah tercatat pada pinjaman aktif.';
  end if;

  insert into public.book_loans (
    id, member_id, member_name, member_nim, book_tag_id,
    book_id, book_title, book_isbn, due_at
  ) values (
    p_loan_id, v_member.id, v_member.nama, v_member.nim, p_book_tag_id,
    v_book.id, v_book.judul, v_book.isbn, p_due_at
  );

  update public.books
  set stok = stok - 1,
      status = case when stok - 1 = 0 then 'Dipinjam' else 'Tersedia' end
  where id = p_book_id;

  return p_loan_id;
end;
$$;

create or replace function public.return_book(p_loan_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id text;
  v_book public.books%rowtype;
begin
  update public.book_loans
  set status = 'Dikembalikan', returned_at = current_date
  where id = p_loan_id and status = 'Dipinjam'
  returning book_id into v_book_id;

  if not found then
    raise exception 'Transaksi aktif tidak ditemukan atau buku sudah dikembalikan.';
  end if;

  select * into v_book
  from public.books
  where id = v_book_id
  for update;

  if not found then
    raise exception 'Data buku tidak ditemukan; hubungi administrator.';
  end if;

  update public.books
  set stok = stok + 1,
      status = case when status = 'Dalam Perawatan' then status else 'Tersedia' end
  where id = v_book_id;

  return p_loan_id;
end;
$$;

revoke all on function public.borrow_book(text, text, text, text, date) from public;
revoke all on function public.return_book(text) from public;
grant execute on function public.borrow_book(text, text, text, text, date) to anon, authenticated;
grant execute on function public.return_book(text) to anon, authenticated;
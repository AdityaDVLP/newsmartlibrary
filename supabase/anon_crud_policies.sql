grant select, insert, update, delete on public.members, public.books to anon;

alter table public.members enable row level security;
alter table public.books enable row level security;

drop policy if exists "Allow anon CRUD members" on public.members;
create policy "Allow anon CRUD members"
  on public.members
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "Allow anon CRUD books" on public.books;
create policy "Allow anon CRUD books"
  on public.books
  for all
  to anon
  using (true)
  with check (true);

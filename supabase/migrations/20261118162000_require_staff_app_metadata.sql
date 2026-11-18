create or replace function public.is_library_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'library_role' = 'staff', false)
$$;

revoke all on function public.is_library_staff() from public, anon;
grant execute on function public.is_library_staff() to authenticated;

drop policy "Staff can manage members" on public.members;
drop policy "Staff can manage books" on public.books;
drop policy "Staff can manage visitor logs" on public.visitor_logs;
drop policy "Staff can manage book logs" on public.book_logs;
drop policy "Staff can manage activities" on public.activities;
drop policy "Staff can manage RSSI history" on public.rssi_history;
drop policy "Staff can manage device status" on public.device_status;
drop policy "Staff can manage book loans" on public.book_loans;

create policy "Staff can manage members" on public.members
  for all to authenticated
  using ((select public.is_library_staff()))
  with check ((select public.is_library_staff()));
create policy "Staff can manage books" on public.books
  for all to authenticated
  using ((select public.is_library_staff()))
  with check ((select public.is_library_staff()));
create policy "Staff can manage visitor logs" on public.visitor_logs
  for all to authenticated
  using ((select public.is_library_staff()))
  with check ((select public.is_library_staff()));
create policy "Staff can manage book logs" on public.book_logs
  for all to authenticated
  using ((select public.is_library_staff()))
  with check ((select public.is_library_staff()));
create policy "Staff can manage activities" on public.activities
  for all to authenticated
  using ((select public.is_library_staff()))
  with check ((select public.is_library_staff()));
create policy "Staff can manage RSSI history" on public.rssi_history
  for all to authenticated
  using ((select public.is_library_staff()))
  with check ((select public.is_library_staff()));
create policy "Staff can manage device status" on public.device_status
  for all to authenticated
  using ((select public.is_library_staff()))
  with check ((select public.is_library_staff()));
create policy "Staff can manage book loans" on public.book_loans
  for all to authenticated
  using ((select public.is_library_staff()))
  with check ((select public.is_library_staff()));

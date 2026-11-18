create policy "No direct access to staff RFID badges"
  on public.staff_rfid_badges
  for all to anon, authenticated
  using (false)
  with check (false);

create policy "No direct access to kiosk rate limits"
  on public.rfid_kiosk_rate_limits
  for all to anon, authenticated
  using (false)
  with check (false);

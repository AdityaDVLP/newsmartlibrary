create table public.rfid_kiosk_rate_limits (
  request_key text primary key check (request_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts >= 0)
);

alter table public.rfid_kiosk_rate_limits enable row level security;
revoke all on table public.rfid_kiosk_rate_limits from public, anon, authenticated;
revoke all on table public.staff_rfid_badges from public, anon, authenticated;
grant select on table public.staff_rfid_badges to service_role;
grant select, insert, update, delete on table public.rfid_kiosk_rate_limits to service_role;

create or replace function public.register_member_from_kiosk(
  p_nim text,
  p_nama text,
  p_prodi text,
  p_status text,
  p_rfid_tag text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nim text := pg_catalog.btrim(coalesce(p_nim, ''));
  v_nama text := pg_catalog.btrim(coalesce(p_nama, ''));
  v_prodi text := pg_catalog.btrim(coalesce(p_prodi, ''));
  v_status text := pg_catalog.btrim(coalesce(p_status, ''));
  v_uid text := pg_catalog.regexp_replace(
    pg_catalog.upper(pg_catalog.btrim(coalesce(p_rfid_tag, ''))),
    '[^A-Z0-9]',
    '',
    'g'
  );
  v_time text;
begin
  if v_nim = '' or pg_catalog.char_length(v_nim) > 64 then
    raise exception 'NIM / ID wajib diisi dan maksimal 64 karakter.';
  end if;
  if v_nama = '' or pg_catalog.char_length(v_nama) > 150 then
    raise exception 'Nama wajib diisi dan maksimal 150 karakter.';
  end if;
  if v_prodi = '' or pg_catalog.char_length(v_prodi) > 120 then
    raise exception 'Program studi wajib diisi dan maksimal 120 karakter.';
  end if;
  if v_status not in ('Mahasiswa', 'Dosen', 'Visitor') then
    raise exception 'Status anggota tidak valid.';
  end if;
  if v_uid !~ '^[A-F0-9]{4,32}$' then
    raise exception 'UID RFID tidak valid.';
  end if;

  insert into public.members (
    id, nim, nama, prodi, email, no_hp, rfid_tag, status
  ) values (
    'M_' || pg_catalog.gen_random_uuid()::text,
    v_nim,
    v_nama,
    v_prodi,
    v_nim || '@student.itk.ac.id',
    '-',
    v_uid,
    v_status
  );

  v_time := pg_catalog.to_char(
    current_timestamp at time zone 'Asia/Makassar',
    'HH24:MI:SS'
  );

  insert into public.activities (id, waktu, deskripsi, tipe, icon_type)
  values (
    'ACT_' || pg_catalog.gen_random_uuid()::text,
    pg_catalog.left(v_time, 5),
    'Anggota baru terdaftar: ' || v_nama || ' (' || v_nim || ')',
    'member',
    'user'
  );
exception
  when unique_violation then
    raise exception 'NIM atau UID RFID sudah terdaftar.';
end;
$$;

create or replace function public.consume_rfid_kiosk_rate_limit(
  p_request_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  if p_request_key !~ '^[a-f0-9]{64}$'
     or p_max_attempts < 1
     or p_max_attempts > 100
     or p_window_seconds < 1
     or p_window_seconds > 86400 then
    raise exception 'Parameter rate limit tidak valid.';
  end if;

  insert into public.rfid_kiosk_rate_limits as current_limit (
    request_key, window_started_at, attempts
  ) values (
    p_request_key, current_timestamp, 1
  )
  on conflict (request_key) do update
  set window_started_at = case
        when current_limit.window_started_at <= current_timestamp - (p_window_seconds * interval '1 second')
          then current_timestamp
        else current_limit.window_started_at
      end,
      attempts = case
        when current_limit.window_started_at <= current_timestamp - (p_window_seconds * interval '1 second')
          then 1
        else current_limit.attempts + 1
      end
  returning attempts into v_attempts;

  return v_attempts <= p_max_attempts;
end;
$$;

revoke all on function public.verify_staff_rfid(text, text) from public, anon, authenticated;
revoke all on function public.checkin_visitor_by_rfid(text) from public, anon, authenticated;
revoke all on function public.register_member_from_kiosk(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.consume_rfid_kiosk_rate_limit(text, integer, integer) from public, anon, authenticated;

grant execute on function public.verify_staff_rfid(text, text) to service_role;
grant execute on function public.checkin_visitor_by_rfid(text) to service_role;
grant execute on function public.register_member_from_kiosk(text, text, text, text, text) to service_role;
grant execute on function public.consume_rfid_kiosk_rate_limit(text, integer, integer) to service_role;

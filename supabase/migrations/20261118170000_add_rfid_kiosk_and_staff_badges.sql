create table public.staff_rfid_badges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rfid_uid text not null unique check (rfid_uid ~ '^[A-F0-9]{4,32}$'),
  created_at timestamptz not null default now()
);

alter table public.staff_rfid_badges enable row level security;
revoke all on table public.staff_rfid_badges from public, anon, authenticated;

create unique index members_rfid_tag_normalized_uidx
  on public.members (regexp_replace(upper(rfid_tag), '[^A-Z0-9]', '', 'g'));

create unique index members_nim_normalized_uidx
  on public.members (lower(btrim(nim)));

create or replace function public.verify_staff_rfid(p_email text, p_rfid_tag text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_rfid_badges as badge
    join auth.users as staff on staff.id = badge.user_id
    where pg_catalog.lower(staff.email) = pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')))
      and badge.rfid_uid = pg_catalog.regexp_replace(
        pg_catalog.upper(pg_catalog.btrim(coalesce(p_rfid_tag, ''))),
        '[^A-Z0-9]',
        '',
        'g'
      )
      and staff.raw_app_meta_data ->> 'library_role' = 'staff'
  )
$$;

create or replace function public.checkin_visitor_by_rfid(p_rfid_tag text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members%rowtype;
  v_uid text;
  v_time text;
begin
  v_uid := pg_catalog.regexp_replace(
    pg_catalog.upper(pg_catalog.btrim(coalesce(p_rfid_tag, ''))),
    '[^A-Z0-9]',
    '',
    'g'
  );

  if pg_catalog.char_length(v_uid) < 4 or pg_catalog.char_length(v_uid) > 32 then
    raise exception 'UID RFID tidak valid.';
  end if;

  select member.*
  into v_member
  from public.members as member
  where pg_catalog.regexp_replace(
    pg_catalog.upper(member.rfid_tag),
    '[^A-Z0-9]',
    '',
    'g'
  ) = v_uid
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('registered', false);
  end if;

  v_time := pg_catalog.to_char(
    current_timestamp at time zone 'Asia/Makassar',
    'HH24:MI:SS'
  );

  insert into public.visitor_logs (
    id, waktu, nama, nim, prodi, kategori, status, rfid_tag, email, no_hp
  ) values (
    'V_' || pg_catalog.gen_random_uuid()::text,
    v_time,
    v_member.nama,
    v_member.nim,
    v_member.prodi,
    v_member.status,
    'Masuk',
    v_member.rfid_tag,
    v_member.email,
    v_member.no_hp
  );

  insert into public.activities (id, waktu, deskripsi, tipe, icon_type)
  values (
    'ACT_' || pg_catalog.gen_random_uuid()::text,
    pg_catalog.left(v_time, 5),
    v_member.nama || ' (' || v_member.nim || ') tap masuk perpustakaan',
    'visitor',
    'user'
  );

  return pg_catalog.jsonb_build_object(
    'registered', true,
    'nama', v_member.nama,
    'rfid_tag', v_member.rfid_tag
  );
end;
$$;

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
  if pg_catalog.char_length(v_uid) < 4 or pg_catalog.char_length(v_uid) > 32 then
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
end;
$$;

revoke all on function public.verify_staff_rfid(text, text) from public, anon, authenticated;
revoke all on function public.checkin_visitor_by_rfid(text) from public, anon, authenticated;
revoke all on function public.register_member_from_kiosk(text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.verify_staff_rfid(text, text) to anon, authenticated;
grant execute on function public.checkin_visitor_by_rfid(text) to anon, authenticated;
grant execute on function public.register_member_from_kiosk(text, text, text, text, text) to anon, authenticated;

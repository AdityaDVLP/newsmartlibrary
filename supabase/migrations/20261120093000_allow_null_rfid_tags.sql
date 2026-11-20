-- Migrasi: Mengizinkan rfid_tag bernilai NULL pada tabel members dan books
-- Hal ini memungkinkan impor data lama tanpa tag RFID / EPC, di mana PostgreSQL mengizinkan banyak baris dengan NULL pada UNIQUE constraint.

alter table public.members
  alter column rfid_tag drop not null;

alter table public.books
  alter column rfid_tag drop not null;

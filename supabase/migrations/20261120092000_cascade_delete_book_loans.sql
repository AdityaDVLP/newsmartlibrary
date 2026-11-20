-- Migrasi: Mengubah foreign key constraint pada book_loans agar mendukung ON DELETE CASCADE
-- Memungkinkan penghapusan anggota dan buku tanpa terkena error constraint 23503.

-- 1. Foreign key member_id -> members(id)
alter table public.book_loans
  drop constraint if exists book_loans_member_id_fkey;

alter table public.book_loans
  add constraint book_loans_member_id_fkey
    foreign key (member_id)
    references public.members(id)
    on delete cascade;

-- 2. Foreign key book_id -> books(id)
alter table public.book_loans
  drop constraint if exists book_loans_book_id_fkey;

alter table public.book_loans
  add constraint book_loans_book_id_fkey
    foreign key (book_id)
    references public.books(id)
    on delete cascade;

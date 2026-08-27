-- Store the external photo filename (from the IMG hard drive) on each media record.
alter table public.media
  add column if not exists photo_filename text;

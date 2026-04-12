-- supabase/migrations/008_source_row.sql

-- ============================================================
-- SOURCE ROW (tracks which spreadsheet line a record came from)
-- ============================================================
alter table public.media add column source_row integer;

-- Index for lookups by row number
create index idx_media_source_row on public.media(source_row) where source_row is not null;

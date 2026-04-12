-- supabase/migrations/006_genres_table.sql

-- ============================================================
-- GENRES TABLE (normalized, with descriptions)
-- ============================================================
create table public.genres (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  parent_id   uuid references public.genres(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint genres_name_unique unique (name)
);

alter table public.genres enable row level security;

create policy "Genres viewable by authenticated users"
  on public.genres for select
  to authenticated
  using (true);

create policy "Admins can insert genres"
  on public.genres for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update genres"
  on public.genres for update
  to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete genres"
  on public.genres for delete
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Seed genres from existing media.genres arrays
insert into public.genres (name)
select distinct unnest(genres) from public.media
where array_length(genres, 1) > 0
on conflict (name) do nothing;

-- Index for fast lookups
create index idx_genres_name on public.genres(name);
create index idx_genres_parent on public.genres(parent_id) where parent_id is not null;

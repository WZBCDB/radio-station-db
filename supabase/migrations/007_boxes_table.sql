-- supabase/migrations/007_boxes_table.sql

-- ============================================================
-- BOXES TABLE (dynamic, replaces hardcoded A-X)
-- ============================================================
create table public.boxes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color1_name text not null,
  color1_hex  text not null,
  color2_name text not null,
  color2_hex  text not null,
  color3_name text not null,
  color3_hex  text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint boxes_name_unique unique (name)
);

alter table public.boxes enable row level security;

create policy "Boxes viewable by authenticated users"
  on public.boxes for select
  to authenticated
  using (true);

create policy "Admins can insert boxes"
  on public.boxes for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update boxes"
  on public.boxes for update
  to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete boxes"
  on public.boxes for delete
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Seed with existing A-X boxes
insert into public.boxes (name, color1_name, color1_hex, color2_name, color2_hex, color3_name, color3_hex, sort_order) values
  ('A', 'Red', '#FF0000', 'Orange', '#FF8000', 'Yellow', '#FFD700', 1),
  ('B', 'Green', '#00A651', 'Blue', '#0000FF', 'Indigo', '#4B0082', 2),
  ('C', 'Purple', '#800080', 'Pink', '#FF69B4', 'Yellow', '#FFD700', 3),
  ('D', 'Red', '#FF0000', 'Blue', '#0000FF', 'Orange', '#FF8000', 4),
  ('E', 'Blue', '#0000FF', 'Green', '#00A651', 'Yellow', '#FFD700', 5),
  ('F', 'Indigo', '#4B0082', 'Purple', '#800080', 'Pink', '#FF69B4', 6),
  ('G', 'Orange', '#FF8000', 'Red', '#FF0000', 'Purple', '#800080', 7),
  ('H', 'Yellow', '#FFD700', 'Green', '#00A651', 'Blue', '#0000FF', 8),
  ('I', 'Pink', '#FF69B4', 'Red', '#FF0000', 'Indigo', '#4B0082', 9),
  ('J', 'Green', '#00A651', 'Orange', '#FF8000', 'Purple', '#800080', 10),
  ('K', 'Blue', '#0000FF', 'Pink', '#FF69B4', 'Red', '#FF0000', 11),
  ('L', 'Indigo', '#4B0082', 'Yellow', '#FFD700', 'Green', '#00A651', 12),
  ('M', 'Purple', '#800080', 'Blue', '#0000FF', 'Orange', '#FF8000', 13),
  ('N', 'Red', '#FF0000', 'Yellow', '#FFD700', 'Pink', '#FF69B4', 14),
  ('O', 'Orange', '#FF8000', 'Green', '#00A651', 'Indigo', '#4B0082', 15),
  ('P', 'Yellow', '#FFD700', 'Purple', '#800080', 'Red', '#FF0000', 16),
  ('Q', 'Pink', '#FF69B4', 'Blue', '#0000FF', 'Green', '#00A651', 17),
  ('R', 'Green', '#00A651', 'Indigo', '#4B0082', 'Orange', '#FF8000', 18),
  ('S', 'Blue', '#0000FF', 'Yellow', '#FFD700', 'Purple', '#800080', 19),
  ('T', 'Indigo', '#4B0082', 'Red', '#FF0000', 'Pink', '#FF69B4', 20),
  ('U', 'Purple', '#800080', 'Green', '#00A651', 'Yellow', '#FFD700', 21),
  ('V', 'Red', '#FF0000', 'Pink', '#FF69B4', 'Blue', '#0000FF', 22),
  ('W', 'Orange', '#FF8000', 'Indigo', '#4B0082', 'Green', '#00A651', 23),
  ('X', 'Yellow', '#FFD700', 'Blue', '#0000FF', 'Red', '#FF0000', 24);

-- Relax the media.location constraint to allow any box name (not just A-X)
alter table public.media drop constraint if exists media_location_check;
alter table public.media add constraint media_location_check
  check (location is null or length(location) between 1 and 10);

-- Index
create index idx_boxes_name on public.boxes(name);
create index idx_boxes_sort on public.boxes(sort_order);

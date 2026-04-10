-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role        text not null default 'member' check (role in ('admin', 'member')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone authenticated can read profiles (needed to show "added by")
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update only their own display_name (not role)
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- Admins can update any profile role
create policy "Admins can update any profile role"
  on public.profiles for update
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (true);

-- Admins can delete profiles
create policy "Admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- MEDIA
-- ============================================================
create table public.media (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  media_type  text not null check (media_type in ('vinyl', '45', 'cd')),
  title       text not null,
  artist      text not null,
  label       text,
  year        smallint check (year is null or (year >= 1900 and year <= 2099)),
  genres      text[] not null default '{}',
  location    text check (location is null or location ~ '^[A-X]$'),
  condition   text check (condition is null or condition in ('mint','near-mint','excellent','good','fair','poor')),
  notes       text,
  view_count  integer not null default 0,
  date_added  timestamptz not null default now()
);

alter table public.media enable row level security;

-- All authenticated users can view all media (shared collection)
create policy "Media viewable by authenticated users"
  on public.media for select
  to authenticated
  using (true);

-- All authenticated users can insert media
create policy "Authenticated users can insert media"
  on public.media for insert
  to authenticated
  with check (created_by = auth.uid());

-- Owner or admin can update media
create policy "Owner or admin can update media"
  on public.media for update
  to authenticated
  using (
    created_by = auth.uid()
    OR exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    created_by = auth.uid()
    OR exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Only admins can delete media
create policy "Only admins can delete media"
  on public.media for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- INCREMENT VIEW COUNT (avoids race conditions)
-- ============================================================
create or replace function public.increment_view_count(row_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.media set view_count = view_count + 1 where id = row_id;
end;
$$;

-- ============================================================
-- MEDIA PHOTOS
-- ============================================================
create table public.media_photos (
  id            uuid primary key default gen_random_uuid(),
  media_id      uuid not null references public.media(id) on delete cascade,
  photo_type    text not null default 'cover' check (photo_type in ('cover', 'condition', 'tag')),
  storage_path  text not null,
  description   text not null default '',
  uploaded_at   timestamptz not null default now()
);

alter table public.media_photos enable row level security;

create policy "Photos viewable by authenticated users"
  on public.media_photos for select
  to authenticated
  using (true);

create policy "Authenticated users can insert photos"
  on public.media_photos for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update photos"
  on public.media_photos for update
  to authenticated
  using (true);

create policy "Only admins can delete photos"
  on public.media_photos for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media-photos', 'media-photos', true)
on conflict do nothing;

-- Authenticated users can upload to the bucket
create policy "Authenticated users can upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media-photos');

-- Anyone can view photos (public bucket for display)
create policy "Public photo access"
  on storage.objects for select
  to public
  using (bucket_id = 'media-photos');

-- Only admins can delete storage objects
create policy "Only admins can delete storage objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media-photos'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_media_created_by on public.media(created_by);
create index idx_media_media_type on public.media(media_type);
create index idx_media_date_added on public.media(date_added desc);
create index idx_media_title_artist on public.media using gin (
  to_tsvector('english', title || ' ' || artist)
);
create index idx_media_photos_media_id on public.media_photos(media_id);
create index idx_media_location on public.media(location) where location is not null;

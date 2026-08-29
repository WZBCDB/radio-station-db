-- Only administrators may change existing records or their attached photo metadata.
drop policy if exists "Owner or admin can update media" on public.media;

create policy "Only admins can update media"
  on public.media for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Authenticated users can update photos" on public.media_photos;

create policy "Only admins can update photos"
  on public.media_photos for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Authenticated users can insert photos" on public.media_photos;

create policy "Users can attach photos to their own records"
  on public.media_photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.media
      where id = media_id
        and (
          created_by = auth.uid()
          or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
          )
        )
    )
  );
-- Fix: genres and boxes UPDATE policies need a USING clause.
-- Without it, rows are invisible for updates and .update() silently affects 0 rows.

-- Genres
drop policy "Admins can update genres" on public.genres;

create policy "Admins can update genres"
  on public.genres for update
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Boxes
drop policy "Admins can update boxes" on public.boxes;

create policy "Admins can update boxes"
  on public.boxes for update
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Fix: Restrict media UPDATE to owner or admin (was open to all authenticated users)
drop policy "Authenticated users can update media" on public.media;

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

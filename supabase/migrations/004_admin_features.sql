-- Add view count to media
alter table public.media add column view_count integer not null default 0;

-- Function to atomically increment view count (avoids race conditions)
create or replace function public.increment_view_count(row_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.media set view_count = view_count + 1 where id = row_id;
end;
$$;

-- Allow admins to update any profile's role
create policy "Admins can update any profile role"
  on public.profiles for update
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (true);

-- Allow admins to delete profiles
create policy "Admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

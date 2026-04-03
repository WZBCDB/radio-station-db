# Admin Dashboard Design Spec

**Goal:** Add an admin dashboard to the WZBC Media Database with user management, station-wide stats, and bulk operations on media.

---

## Access & Routing

- New route tree: `/admin` and `/admin/bulk`
- Protected by middleware: non-admins hitting `/admin/*` get redirected to `/dashboard`
- A gear/shield icon appears in the existing `DashboardHeader` only when `profile.role === "admin"`, linking to `/admin`
- Admin layout includes a back-to-dashboard link and navigation between admin pages

### Middleware Update

Add `/admin/:path*` to the existing middleware matcher. After resolving the Supabase session, fetch the user's profile and check `role === "admin"`. If not admin, redirect to `/dashboard`.

---

## New Environment Variable

- `SUPABASE_SERVICE_ROLE_KEY` -- server-only, never prefixed with `NEXT_PUBLIC_`. Used by API routes to query `auth.users` for emails and to update user roles. Add to `.env.local.example`.

---

## Schema Changes

### Migration: `004_admin_features.sql`

```sql
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
```

Note: The existing "Users can update own profile" policy has a `with check` that prevents role self-escalation. The new admin policy is additive -- admins can update any profile including role. The `with check (true)` is intentional since we trust admin-level access.

---

## File Structure

```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx          -- Admin shell: header, nav, admin-only guard
│   │   ├── page.tsx            -- Main admin: user management + stats
│   │   └── bulk/
│   │       └── page.tsx        -- Bulk operations page
│   └── api/
│       └── admin/
│           └── users/
│               ├── route.ts              -- GET: list all users
│               └── [id]/
│                   ├── route.ts          -- DELETE: remove user + cascade
│                   └── role/
│                       └── route.ts      -- PATCH: change user role
├── components/
│   └── admin/
│       ├── user-table.tsx      -- User list with role toggle and delete
│       ├── stats-panel.tsx     -- Station-wide stats display
│       ├── bulk-grid.tsx       -- Media grid with checkboxes for selection
│       ├── bulk-toolbar.tsx    -- Bulk action buttons (delete, edit, export, import)
│       ├── bulk-edit-modal.tsx -- Modal for choosing field + new value
│       └── import-modal.tsx    -- Spreadsheet upload, column mapping, preview
```

---

## Page 1: `/admin` -- User Management + Stats

### User Management Panel

**Data source:** `GET /api/admin/users` -- server-side API route that:
1. Uses `SUPABASE_SERVICE_ROLE_KEY` to create an admin Supabase client
2. Queries `auth.users` for emails and metadata
3. Joins with `profiles` for display_name, role, created_at
4. Counts each user's media items via a subquery on `media.created_by`
5. Returns combined array

**UI:**
- Glass-panel table with columns: Display Name, Email, Role (badge), Joined, Items Added
- Search input to filter by name or email
- Role filter dropdown (All / Admin / Member)
- Each row has:
  - **Role toggle button**: "Promote to Admin" or "Demote to Member" depending on current role. Calls `PATCH /api/admin/users/[id]/role` with `{ role: "admin" | "member" }`. Shows confirmation dialog before executing.
  - **Delete button**: Red, with confirmation dialog that warns "This will permanently delete this user and all their media records." Calls `DELETE /api/admin/users/[id]` which deletes the profile (media cascades via FK), removes their storage files, and deletes the auth.users entry via the service role client.
- Cannot demote or delete yourself (buttons disabled with tooltip)

### Station Stats Panel

Six stat cards in a grid, all using the glass panel style:

1. **Top Contributors** -- ranked list of users by media count (top 10). Query: `select created_by, count(*) from media group by created_by order by count desc limit 10`, joined with profiles for display_name.

2. **Most Common Genres** -- ranked list of genres by frequency. Query: `select unnest(genres) as genre, count(*) from media group by genre order by count desc limit 15`.

3. **Condition Breakdown** -- counts per condition value. Query: `select condition, count(*) from media where condition is not null group by condition`.

4. **Incomplete Records** -- count + list of media items missing photos. Query: `select m.* from media m left join media_photos mp on m.id = mp.media_id where mp.id is null`.

5. **Storage Usage** -- total photo count and total number of media with photos. Query: `select count(*) from media_photos` for count. Actual file sizes aren't cheaply queryable via Supabase Storage API, so show photo count only.

6. **Most Viewed** -- top 10 media by `view_count`. Query: `select * from media where view_count > 0 order by view_count desc limit 10`.

---

## Page 2: `/admin/bulk` -- Bulk Operations

### Bulk Selection Grid

- Reuses the existing media card layout but adds a checkbox overlay on each card
- "Select All" / "Deselect All" toggle at the top
- Selected count displayed in the toolbar
- Search/filter bar (same as dashboard) to narrow before selecting

### Bulk Toolbar

Sticky toolbar at the top with action buttons, only active when items are selected:

**Bulk Delete:**
- Confirm dialog: "Delete {n} items permanently? This cannot be undone."
- Deletes media_photos records, removes storage files, deletes media records
- Runs in batches of 50 to avoid timeout

**Bulk Edit:**
- Opens a modal with:
  - Field selector dropdown: Location (box), Condition, Add Genre, Remove Genre
  - Value input appropriate to the field (box dropdown, condition dropdown, genre text input)
  - Preview: "This will update {field} to {value} on {n} items"
  - Confirm button
- Runs updates in batches of 50

**Bulk Export:**
- Format selector: CSV or JSON
- Exports all selected items (or all items if none selected)
- Uses SheetJS (`xlsx` npm package) to generate the file client-side
- Includes all fields: title, artist, media_type, label, year, genres (comma-separated), location, condition, notes, date_added
- Triggers a browser download

**Bulk Import:**
- Opens a modal with:
  - File upload accepting `.csv`, `.xlsx`, `.xls`, `.ods`
  - Uses SheetJS to parse the file client-side into JSON rows
  - Column mapping step: auto-maps columns by header name, allows manual remapping via dropdowns. Target fields: media_type, title, artist, label, year, genres, location, condition, notes
  - Preview table showing first 10 rows with mapped values
  - Validation: highlights rows with missing required fields (media_type, title, artist) in red
  - "Import {n} valid rows" button (skips invalid rows)
  - Inserts in batches of 50 with progress indicator
  - Summary after completion: "{n} imported, {m} skipped"

---

## View Count Tracking

When a user opens the detail modal (clicks a media card), the client calls:
```typescript
supabase.rpc("increment_view_count", { row_id: item.id });
```

This is fire-and-forget (no await needed, no error handling required -- it's analytics, not critical path). The RPC function runs as `security definer` so it bypasses RLS.

---

## Styling

All admin pages follow the existing liquid glass design system:
- `.glass` panels for stats cards and table container
- `.glass-bright` for modals and the form sidebar
- BC maroon background, gold accents for headings and interactive elements
- White/opacity text for labels and secondary content
- Same `bg-white/90` treatment for form inputs

---

## Dependencies

- `xlsx` (SheetJS) -- client-side spreadsheet parsing and CSV/XLSX generation. Install as a regular dependency (not dev).

---

## Security Considerations

- `SUPABASE_SERVICE_ROLE_KEY` is only used in server-side API routes (`src/app/api/admin/`), never imported in client components
- All admin API routes verify the requesting user is an admin before executing
- Role change and user deletion go through server-side routes (not client-side RLS) because they require the service role key
- Admins cannot demote or delete themselves (enforced in UI and API)
- Bulk import validates data types before inserting (year must be numeric 1900-2099, media_type must be vinyl/45/cd, etc.)

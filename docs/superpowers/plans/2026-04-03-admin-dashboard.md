# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin dashboard to the WZBC Media Database with user management (view/promote/demote/delete users), station-wide stats (top contributors, genres, conditions, incomplete records, storage, most viewed), and bulk operations (delete, edit, export, import from any spreadsheet format).

**Architecture:** New `/admin` route tree protected by middleware. Server-side API routes use a `SUPABASE_SERVICE_ROLE_KEY` to access `auth.users` and manage roles. Bulk import/export uses SheetJS (`xlsx`) for client-side spreadsheet parsing. View count tracking via a Postgres RPC function.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase, SheetJS (`xlsx`)

---

## File Structure

```
New files:
  supabase/migrations/004_admin_features.sql
  src/lib/supabase/admin.ts                          -- Service role client (server-only)
  src/app/admin/layout.tsx                            -- Admin shell with nav + guard
  src/app/admin/page.tsx                              -- User management + stats page
  src/app/admin/bulk/page.tsx                         -- Bulk operations page
  src/app/api/admin/users/route.ts                    -- GET: list users with emails
  src/app/api/admin/users/[id]/route.ts               -- DELETE: remove user
  src/app/api/admin/users/[id]/role/route.ts          -- PATCH: change role
  src/components/admin/user-table.tsx                  -- User list with actions
  src/components/admin/stats-panel.tsx                 -- Six stat cards
  src/components/admin/bulk-grid.tsx                   -- Selectable media grid
  src/components/admin/bulk-toolbar.tsx                -- Bulk action buttons
  src/components/admin/bulk-edit-modal.tsx             -- Field + value picker modal
  src/components/admin/import-modal.tsx                -- Spreadsheet upload + mapping

Modified files:
  .env.local.example                                  -- Add SUPABASE_SERVICE_ROLE_KEY
  middleware.ts                                        -- Add /admin/* protection
  src/app/dashboard/layout.tsx                         -- Add admin gear icon to header
  src/components/detail-modal.tsx                      -- Add view count increment
```

---

## Task 1: Schema Migration + Service Role Client + Dependencies

**Files:**
- Create: `supabase/migrations/004_admin_features.sql`
- Create: `src/lib/supabase/admin.ts`
- Modify: `.env.local.example`

- [ ] **Step 1: Install SheetJS**

```bash
npm install xlsx
```

- [ ] **Step 2: Create the migration SQL**

Create `supabase/migrations/004_admin_features.sql`:

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

- [ ] **Step 3: Create service role Supabase client**

Create `src/lib/supabase/admin.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 4: Update `.env.local.example`**

Append to `.env.local.example`:

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/004_admin_features.sql src/lib/supabase/admin.ts .env.local.example package.json package-lock.json
git commit -m "feat: add admin schema migration, service role client, and SheetJS dependency"
```

---

## Task 2: Middleware Update + Admin Layout + Header Icon

**Files:**
- Modify: `middleware.ts`
- Create: `src/app/admin/layout.tsx`
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Update middleware to protect `/admin` routes**

Replace `middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Redirect unauthenticated users away from protected routes
  if ((path.startsWith("/dashboard") || path.startsWith("/admin")) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect non-admins away from admin routes
  if (path.startsWith("/admin") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated users away from auth pages
  if ((path === "/login" || path === "/register") && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Redirect root to appropriate page
  if (path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/", "/login", "/register", "/dashboard/:path*", "/admin/:path*"],
};
```

- [ ] **Step 2: Create admin layout**

Create `src/app/admin/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Profile } from "@/lib/types";

async function getAdminProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data || data.role !== "admin") return null;
  return data;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getAdminProfile();
  if (!profile) redirect("/dashboard");

  return (
    <div className="min-h-screen p-5">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center text-white mb-7 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold drop-shadow-md">
              WZBC Admin
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Station management for {profile.display_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-white/70 hover:text-white text-sm font-semibold transition"
            >
              Users & Stats
            </Link>
            <Link
              href="/admin/bulk"
              className="text-white/70 hover:text-white text-sm font-semibold transition"
            >
              Bulk Operations
            </Link>
            <Link
              href="/dashboard"
              className="bg-bc-gold/20 text-white border-2 border-bc-gold px-4 py-2 rounded-md font-semibold text-sm hover:bg-bc-gold/30 transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add admin gear icon to dashboard header**

In `src/app/dashboard/layout.tsx`, add a Link import at the top and an admin icon between the user info and logout button in `DashboardHeader`:

Replace the entire `DashboardHeader` function:

```tsx
function DashboardHeader({ profile }: { profile: Profile }) {
  return (
    <header className="flex justify-between items-center text-white mb-7 flex-wrap gap-4">
      <h1 className="text-3xl font-bold drop-shadow-md">
        WZBC Media Database
      </h1>
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <div className="font-bold text-sm">{profile.display_name}</div>
          <div className="text-xs opacity-90">
            {profile.role === "admin" ? "Admin" : "Member"}
          </div>
        </div>
        {profile.role === "admin" && (
          <Link
            href="/admin"
            title="Admin Dashboard"
            className="text-white/70 hover:text-white transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.07c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
            </svg>
          </Link>
        )}
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="bg-bc-gold/20 text-white border-2 border-bc-gold px-4 py-2 rounded-md font-semibold text-sm hover:bg-bc-gold/30 transition"
          >
            Logout
          </button>
        </form>
      </div>
    </header>
  );
}
```

Add the Link import at the top of `src/app/dashboard/layout.tsx`:

```typescript
import Link from "next/link";
```

- [ ] **Step 4: Commit**

```bash
git add middleware.ts src/app/admin/layout.tsx src/app/dashboard/layout.tsx
git commit -m "feat: add admin middleware protection, admin layout, and gear icon in dashboard header"
```

---

## Task 3: Admin API Routes (Users List, Role Change, Delete)

**Files:**
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[id]/role/route.ts`
- Create: `src/app/api/admin/users/[id]/route.ts`

- [ ] **Step 1: Create helper to verify admin status in API routes**

This pattern is reused in all three routes. We'll inline it since it's short.

- [ ] **Step 2: Create GET /api/admin/users**

Create `src/app/api/admin/users/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  // Verify requester is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Use service role client to list auth.users
  const admin = createAdminClient();
  const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Get profiles with media counts
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, role, created_at");
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  // Get media counts per user
  const { data: mediaCounts } = await supabase
    .from("media")
    .select("created_by");

  const countMap: Record<string, number> = {};
  (mediaCounts ?? []).forEach((row) => {
    countMap[row.created_by] = (countMap[row.created_by] ?? 0) + 1;
  });

  // Merge auth.users emails with profiles
  const emailMap: Record<string, string> = {};
  (authUsers?.users ?? []).forEach((u) => {
    emailMap[u.id] = u.email ?? "";
  });

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    email: emailMap[p.id] ?? "",
    role: p.role,
    created_at: p.created_at,
    media_count: countMap[p.id] ?? 0,
  }));

  return NextResponse.json(users);
}
```

- [ ] **Step 3: Create PATCH /api/admin/users/[id]/role**

Create `src/app/api/admin/users/[id]/role/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify requester is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cannot change own role
  if (id === user.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const body = await request.json();
  const newRole = body.role;
  if (newRole !== "admin" && newRole !== "member") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Create DELETE /api/admin/users/[id]**

Create `src/app/api/admin/users/[id]/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify requester is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cannot delete yourself
  if (id === user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get all media by this user to clean up storage
  const { data: userMedia } = await supabase
    .from("media")
    .select("id")
    .eq("created_by", id);

  if (userMedia && userMedia.length > 0) {
    const mediaIds = userMedia.map((m) => m.id);

    // Get all photo storage paths
    const { data: photos } = await supabase
      .from("media_photos")
      .select("storage_path")
      .in("media_id", mediaIds);

    // Remove storage files
    if (photos && photos.length > 0) {
      const paths = photos.map((p) => p.storage_path);
      await admin.storage.from("media-photos").remove(paths);
    }
  }

  // Delete profile (media + media_photos cascade via FK)
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Delete auth.users entry
  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/
git commit -m "feat: add admin API routes for user list, role change, and user deletion"
```

---

## Task 4: User Management Table Component

**Files:**
- Create: `src/components/admin/user-table.tsx`

- [ ] **Step 1: Create user table component**

Create `src/components/admin/user-table.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: string;
  display_name: string;
  email: string;
  role: "admin" | "member";
  created_at: string;
  media_count: number;
}

export default function UserTable({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "admin" | "member">("");
  const router = useRouter();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleRoleChange(userId: string, newRole: "admin" | "member") {
    const user = users.find((u) => u.id === userId);
    const action = newRole === "admin" ? "promote" : "demote";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${user?.display_name} to ${newRole}?`)) return;

    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      await fetchUsers();
      router.refresh();
    } else {
      const data = await res.json();
      alert("Failed: " + data.error);
    }
  }

  async function handleDelete(userId: string) {
    const user = users.find((u) => u.id === userId);
    if (!confirm(`Permanently delete ${user?.display_name} and all their media records? This cannot be undone.`)) return;

    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      await fetchUsers();
      router.refresh();
    } else {
      const data = await res.json();
      alert("Failed: " + data.error);
    }
  }

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="glass-bright rounded-xl p-6">
      <h2 className="text-bc-gold text-xl font-bold mb-4">User Management</h2>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-bc-gold"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as "" | "admin" | "member")}
          className="p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-white/50">Loading users...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20 text-white/60">
                <th className="text-left py-3 px-2 font-semibold">Name</th>
                <th className="text-left py-3 px-2 font-semibold">Email</th>
                <th className="text-left py-3 px-2 font-semibold">Role</th>
                <th className="text-left py-3 px-2 font-semibold">Joined</th>
                <th className="text-right py-3 px-2 font-semibold">Items</th>
                <th className="text-right py-3 px-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/10 text-white/80">
                  <td className="py-3 px-2 font-medium">{u.display_name}</td>
                  <td className="py-3 px-2 text-white/60">{u.email}</td>
                  <td className="py-3 px-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                        u.role === "admin"
                          ? "bg-bc-gold/30 text-bc-gold-light"
                          : "bg-white/15 text-white/70"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-white/60">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2 text-right">{u.media_count}</td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          handleRoleChange(
                            u.id,
                            u.role === "admin" ? "member" : "admin"
                          )
                        }
                        disabled={u.id === currentUserId}
                        title={u.id === currentUserId ? "Cannot change your own role" : ""}
                        className="px-3 py-1 text-xs rounded font-semibold bg-bc-gold/20 text-bc-gold-light hover:bg-bc-gold/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {u.role === "admin" ? "Demote" : "Promote"}
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={u.id === currentUserId}
                        title={u.id === currentUserId ? "Cannot delete yourself" : ""}
                        className="px-3 py-1 text-xs rounded font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-white/50">No users match your search.</div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/user-table.tsx
git commit -m "feat: add user management table component with role toggle and delete"
```

---

## Task 5: Stats Panel Component

**Files:**
- Create: `src/components/admin/stats-panel.tsx`

- [ ] **Step 1: Create stats panel**

Create `src/components/admin/stats-panel.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";

interface ContributorStat {
  display_name: string;
  count: number;
}

interface GenreStat {
  genre: string;
  count: number;
}

interface ConditionStat {
  condition: string;
  count: number;
}

interface IncompleteItem {
  id: string;
  title: string;
  artist: string;
}

interface ViewedItem {
  id: string;
  title: string;
  artist: string;
  view_count: number;
}

async function getStats() {
  const supabase = await createClient();

  // Top contributors
  const { data: mediaRows } = await supabase.from("media").select("created_by");
  const contributorMap: Record<string, number> = {};
  (mediaRows ?? []).forEach((r) => {
    contributorMap[r.created_by] = (contributorMap[r.created_by] ?? 0) + 1;
  });
  const topContributorIds = Object.entries(contributorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name");
  const profileMap: Record<string, string> = {};
  (profiles ?? []).forEach((p) => {
    profileMap[p.id] = p.display_name;
  });
  const topContributors: ContributorStat[] = topContributorIds.map(([id, count]) => ({
    display_name: profileMap[id] ?? "Unknown",
    count,
  }));

  // Most common genres
  const { data: genreRows } = await supabase.from("media").select("genres");
  const genreMap: Record<string, number> = {};
  (genreRows ?? []).forEach((r) => {
    (r.genres ?? []).forEach((g: string) => {
      genreMap[g] = (genreMap[g] ?? 0) + 1;
    });
  });
  const topGenres: GenreStat[] = Object.entries(genreMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([genre, count]) => ({ genre, count }));

  // Condition breakdown
  const { data: condRows } = await supabase
    .from("media")
    .select("condition")
    .not("condition", "is", null);
  const condMap: Record<string, number> = {};
  (condRows ?? []).forEach((r) => {
    if (r.condition) condMap[r.condition] = (condMap[r.condition] ?? 0) + 1;
  });
  const conditions: ConditionStat[] = Object.entries(condMap)
    .sort((a, b) => b[1] - a[1])
    .map(([condition, count]) => ({ condition, count }));

  // Incomplete records (no photos)
  const { data: allMedia } = await supabase.from("media").select("id, title, artist");
  const { data: allPhotos } = await supabase.from("media_photos").select("media_id");
  const photoMediaIds = new Set((allPhotos ?? []).map((p) => p.media_id));
  const incomplete: IncompleteItem[] = (allMedia ?? [])
    .filter((m) => !photoMediaIds.has(m.id))
    .slice(0, 20);

  // Storage usage
  const photoCount = (allPhotos ?? []).length;
  const mediaWithPhotos = photoMediaIds.size;

  // Most viewed
  const { data: viewed } = await supabase
    .from("media")
    .select("id, title, artist, view_count")
    .gt("view_count", 0)
    .order("view_count", { ascending: false })
    .limit(10);
  const mostViewed: ViewedItem[] = (viewed ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    artist: v.artist,
    view_count: v.view_count,
  }));

  return { topContributors, topGenres, conditions, incomplete, photoCount, mediaWithPhotos, mostViewed };
}

export default async function StatsPanel() {
  const stats = await getStats();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Top Contributors */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-bc-gold font-bold text-sm uppercase tracking-wide mb-3">Top Contributors</h3>
        {stats.topContributors.length === 0 ? (
          <p className="text-white/50 text-sm">No data yet</p>
        ) : (
          <ol className="space-y-1.5">
            {stats.topContributors.map((c, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span className="text-white/80">{i + 1}. {c.display_name}</span>
                <span className="text-bc-gold-light font-bold">{c.count}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Most Common Genres */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-bc-gold font-bold text-sm uppercase tracking-wide mb-3">Top Genres</h3>
        {stats.topGenres.length === 0 ? (
          <p className="text-white/50 text-sm">No data yet</p>
        ) : (
          <div className="space-y-1.5">
            {stats.topGenres.map((g) => (
              <div key={g.genre} className="flex justify-between text-sm">
                <span className="text-white/80">{g.genre}</span>
                <span className="text-bc-gold-light font-bold">{g.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Condition Breakdown */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-bc-gold font-bold text-sm uppercase tracking-wide mb-3">Condition Breakdown</h3>
        {stats.conditions.length === 0 ? (
          <p className="text-white/50 text-sm">No data yet</p>
        ) : (
          <div className="space-y-1.5">
            {stats.conditions.map((c) => (
              <div key={c.condition} className="flex justify-between text-sm">
                <span className="text-white/80 capitalize">{c.condition}</span>
                <span className="text-bc-gold-light font-bold">{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incomplete Records */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-bc-gold font-bold text-sm uppercase tracking-wide mb-3">
          Missing Photos ({stats.incomplete.length}{stats.incomplete.length === 20 ? "+" : ""})
        </h3>
        {stats.incomplete.length === 0 ? (
          <p className="text-white/50 text-sm">All items have photos</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {stats.incomplete.map((m) => (
              <div key={m.id} className="text-sm text-white/80">
                <span className="font-medium">{m.title}</span>
                <span className="text-white/50"> — {m.artist}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storage Usage */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-bc-gold font-bold text-sm uppercase tracking-wide mb-3">Storage Usage</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/80">Total Photos</span>
            <span className="text-bc-gold-light font-bold">{stats.photoCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/80">Items with Photos</span>
            <span className="text-bc-gold-light font-bold">{stats.mediaWithPhotos}</span>
          </div>
        </div>
      </div>

      {/* Most Viewed */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-bc-gold font-bold text-sm uppercase tracking-wide mb-3">Most Viewed</h3>
        {stats.mostViewed.length === 0 ? (
          <p className="text-white/50 text-sm">No views recorded yet</p>
        ) : (
          <ol className="space-y-1.5">
            {stats.mostViewed.map((v, i) => (
              <li key={v.id} className="flex justify-between text-sm">
                <span className="text-white/80 truncate mr-2">
                  {i + 1}. {v.title} — {v.artist}
                </span>
                <span className="text-bc-gold-light font-bold whitespace-nowrap">{v.view_count} views</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/stats-panel.tsx
git commit -m "feat: add station stats panel with contributors, genres, conditions, storage, and views"
```

---

## Task 6: Admin Main Page + View Count Tracking

**Files:**
- Create: `src/app/admin/page.tsx`
- Modify: `src/components/detail-modal.tsx`

- [ ] **Step 1: Create admin main page**

Create `src/app/admin/page.tsx`:

```tsx
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import UserTable from "@/components/admin/user-table";
import StatsPanel from "@/components/admin/stats-panel";

export const dynamic = "force-dynamic";

async function getCurrentUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user!.id;
}

export default async function AdminPage() {
  const currentUserId = await getCurrentUserId();

  return (
    <div className="space-y-7">
      <UserTable currentUserId={currentUserId} />

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass rounded-xl p-5 animate-pulse h-48" />
            ))}
          </div>
        }
      >
        <StatsPanel />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: Add view count increment to detail modal**

In `src/components/detail-modal.tsx`, add the Supabase client import and fire-and-forget RPC call when the modal renders.

Add these imports at the top:

```typescript
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
```

Add this inside `DetailModal` before the return statement:

```typescript
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("increment_view_count", { row_id: item.id });
  }, [item.id]);
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx src/components/detail-modal.tsx
git commit -m "feat: add admin main page and view count tracking on detail modal"
```

---

## Task 7: Bulk Grid + Toolbar Components

**Files:**
- Create: `src/components/admin/bulk-grid.tsx`
- Create: `src/components/admin/bulk-toolbar.tsx`

- [ ] **Step 1: Create bulk grid with selectable cards**

Create `src/components/admin/bulk-grid.tsx`:

```tsx
"use client";

import type { Media } from "@/lib/types";
import BoxDots from "@/components/box-dots";

const TYPE_LABELS: Record<string, string> = {
  vinyl: "Vinyl",
  "45": "45 RPM",
  cd: "CD",
};

interface BulkGridProps {
  media: Media[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export default function BulkGrid({ media, selected, onToggle }: BulkGridProps) {
  if (media.length === 0) {
    return (
      <div className="text-center py-14 text-white/50">
        No items match your filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {media.map((item) => {
        const isSelected = selected.has(item.id);
        const cover = item.photos?.find((p) => p.photo_type === "cover");

        return (
          <div
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`glass rounded-xl overflow-hidden cursor-pointer transition ${
              isSelected
                ? "ring-2 ring-bc-gold shadow-lg"
                : "hover:-translate-y-0.5"
            }`}
          >
            <div className="relative">
              {cover ? (
                <img
                  src={cover.url}
                  alt={item.title}
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-bc-maroon to-bc-maroon-dark flex items-center justify-center text-4xl">
                  🎵
                </div>
              )}
              <div
                className={`absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center transition ${
                  isSelected
                    ? "bg-bc-gold border-bc-gold text-white"
                    : "bg-black/30 border-white/50"
                }`}
              >
                {isSelected && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div className="p-3">
              <span className="inline-block bg-bc-gold text-white px-2 py-0.5 rounded-full text-xs font-bold uppercase mb-1">
                {TYPE_LABELS[item.media_type] ?? item.media_type}
              </span>
              <div className="font-bold text-white text-sm leading-tight">{item.title}</div>
              <div className="text-white/70 text-xs">{item.artist}</div>
              {item.location && (
                <div className="mt-1">
                  <BoxDots letter={item.location} size="sm" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create bulk toolbar**

Create `src/components/admin/bulk-toolbar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Media } from "@/lib/types";
import * as XLSX from "xlsx";

interface BulkToolbarProps {
  media: Media[];
  selected: Set<string>;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onOpenEdit: () => void;
  onOpenImport: () => void;
}

export default function BulkToolbar({
  media,
  selected,
  onSelectAll,
  onDeselectAll,
  onOpenEdit,
  onOpenImport,
}: BulkToolbarProps) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} items permanently? This cannot be undone.`)) return;
    setDeleting(true);

    const ids = Array.from(selected);
    const batchSize = 50;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);

      // Get photos for storage cleanup
      const { data: photos } = await supabase
        .from("media_photos")
        .select("storage_path")
        .in("media_id", batch);

      if (photos && photos.length > 0) {
        const paths = photos.map((p) => p.storage_path);
        await supabase.storage.from("media-photos").remove(paths);
      }

      // Delete photo records
      await supabase.from("media_photos").delete().in("media_id", batch);

      // Delete media records
      await supabase.from("media").delete().in("id", batch);
    }

    setDeleting(false);
    onDeselectAll();
    router.refresh();
  }

  function handleExport(format: "csv" | "json") {
    const items = selected.size > 0
      ? media.filter((m) => selected.has(m.id))
      : media;

    const rows = items.map((m) => ({
      media_type: m.media_type,
      title: m.title,
      artist: m.artist,
      label: m.label ?? "",
      year: m.year ?? "",
      genres: m.genres.join(", "),
      location: m.location ?? "",
      condition: m.condition ?? "",
      notes: m.notes ?? "",
      date_added: m.date_added,
    }));

    if (format === "json") {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wzbc-media-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Media");
      XLSX.writeFile(wb, "wzbc-media-export.csv");
    }
  }

  return (
    <div className="glass-bright rounded-xl p-4 mb-4 flex items-center gap-3 flex-wrap sticky top-0 z-20">
      <button
        onClick={selected.size === media.length ? onDeselectAll : onSelectAll}
        className="px-3 py-2 text-xs rounded font-semibold bg-white/15 text-white/80 hover:bg-white/25 transition"
      >
        {selected.size === media.length ? "Deselect All" : "Select All"}
      </button>

      <span className="text-white/60 text-sm">
        {selected.size} of {media.length} selected
      </span>

      <div className="flex-1" />

      <button
        onClick={handleBulkDelete}
        disabled={selected.size === 0 || deleting}
        className="px-3 py-2 text-xs rounded font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {deleting ? "Deleting..." : "Delete Selected"}
      </button>

      <button
        onClick={onOpenEdit}
        disabled={selected.size === 0}
        className="px-3 py-2 text-xs rounded font-semibold bg-bc-gold/20 text-bc-gold-light hover:bg-bc-gold/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Edit Selected
      </button>

      <button
        onClick={() => handleExport("csv")}
        className="px-3 py-2 text-xs rounded font-semibold bg-white/15 text-white/80 hover:bg-white/25 transition"
      >
        Export CSV
      </button>

      <button
        onClick={() => handleExport("json")}
        className="px-3 py-2 text-xs rounded font-semibold bg-white/15 text-white/80 hover:bg-white/25 transition"
      >
        Export JSON
      </button>

      <button
        onClick={onOpenImport}
        className="px-3 py-2 text-xs rounded font-semibold bg-bc-gold/20 text-bc-gold-light hover:bg-bc-gold/30 transition"
      >
        Import
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/bulk-grid.tsx src/components/admin/bulk-toolbar.tsx
git commit -m "feat: add bulk selection grid and toolbar with delete/export/action buttons"
```

---

## Task 8: Bulk Edit Modal

**Files:**
- Create: `src/components/admin/bulk-edit-modal.tsx`

- [ ] **Step 1: Create bulk edit modal**

Create `src/components/admin/bulk-edit-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Condition } from "@/lib/types";
import { BOXES } from "@/lib/box-colors";

type EditField = "location" | "condition" | "add_genre" | "remove_genre";

interface BulkEditModalProps {
  selectedIds: string[];
  onClose: () => void;
}

export default function BulkEditModal({ selectedIds, onClose }: BulkEditModalProps) {
  const [field, setField] = useState<EditField>("location");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleApply() {
    if (!value.trim() && field !== "location") return;
    setSaving(true);

    const batchSize = 50;

    for (let i = 0; i < selectedIds.length; i += batchSize) {
      const batch = selectedIds.slice(i, i + batchSize);

      if (field === "location") {
        await supabase
          .from("media")
          .update({ location: value || null })
          .in("id", batch);
      } else if (field === "condition") {
        await supabase
          .from("media")
          .update({ condition: value || null })
          .in("id", batch);
      } else if (field === "add_genre") {
        // Fetch current genres, append, update
        const { data: items } = await supabase
          .from("media")
          .select("id, genres")
          .in("id", batch);
        for (const item of items ?? []) {
          const genres: string[] = item.genres ?? [];
          if (!genres.includes(value.trim())) {
            await supabase
              .from("media")
              .update({ genres: [...genres, value.trim()] })
              .eq("id", item.id);
          }
        }
      } else if (field === "remove_genre") {
        const { data: items } = await supabase
          .from("media")
          .select("id, genres")
          .in("id", batch);
        for (const item of items ?? []) {
          const genres: string[] = (item.genres ?? []).filter(
            (g: string) => g.toLowerCase() !== value.trim().toLowerCase()
          );
          await supabase
            .from("media")
            .update({ genres })
            .eq("id", item.id);
        }
      }
    }

    setSaving(false);
    router.refresh();
    onClose();
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="glass-bright p-7 rounded-xl w-full max-w-md">
        <h3 className="text-white text-lg font-bold mb-4">Bulk Edit {selectedIds.length} Items</h3>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">Field</label>
          <select
            value={field}
            onChange={(e) => {
              setField(e.target.value as EditField);
              setValue("");
            }}
            className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
          >
            <option value="location">Box Location</option>
            <option value="condition">Condition</option>
            <option value="add_genre">Add Genre</option>
            <option value="remove_genre">Remove Genre</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">New Value</label>
          {field === "location" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
            >
              <option value="">No box assigned</option>
              {BOXES.map((b) => (
                <option key={b.letter} value={b.letter}>
                  Box {b.letter} — {b.colors.map((c) => c.name).join(", ")}
                </option>
              ))}
            </select>
          ) : field === "condition" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
            >
              <option value="">No condition</option>
              <option value="mint">Mint (Sealed)</option>
              <option value="near-mint">Near Mint</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={field === "add_genre" ? "Genre to add..." : "Genre to remove..."}
              className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
            />
          )}
        </div>

        <p className="text-white/60 text-sm mb-4">
          This will update <strong>{field.replace("_", " ")}</strong> to{" "}
          <strong>{value || "(empty)"}</strong> on {selectedIds.length} items.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/15 text-white/80 rounded-md font-semibold text-sm hover:bg-white/25 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={saving}
            className="flex-1 py-2.5 bg-bc-gold text-white rounded-md font-bold text-sm hover:bg-bc-gold-light transition disabled:opacity-50"
          >
            {saving ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/bulk-edit-modal.tsx
git commit -m "feat: add bulk edit modal for location, condition, and genre changes"
```

---

## Task 9: Import Modal (Spreadsheet Upload + Column Mapping)

**Files:**
- Create: `src/components/admin/import-modal.tsx`

- [ ] **Step 1: Create import modal**

Create `src/components/admin/import-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

const TARGET_FIELDS = [
  "media_type",
  "title",
  "artist",
  "label",
  "year",
  "genres",
  "location",
  "condition",
  "notes",
] as const;

type TargetField = (typeof TARGET_FIELDS)[number];

const REQUIRED_FIELDS: TargetField[] = ["media_type", "title", "artist"];

const VALID_MEDIA_TYPES = ["vinyl", "45", "cd"];
const VALID_CONDITIONS = ["mint", "near-mint", "excellent", "good", "fair", "poor"];

interface ImportModalProps {
  onClose: () => void;
}

type ColumnMapping = Record<string, TargetField | "">;

export default function ImportModal({ onClose }: ImportModalProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (json.length === 0) return;

      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);
      setRows(json);

      // Auto-map columns by name
      const autoMap: ColumnMapping = {};
      hdrs.forEach((h) => {
        const lower = h.toLowerCase().replace(/[^a-z]/g, "");
        const match = TARGET_FIELDS.find(
          (f) => f.replace("_", "") === lower || f === lower || lower.includes(f.replace("_", ""))
        );
        autoMap[h] = match ?? "";
      });
      setMapping(autoMap);
    };
    reader.readAsArrayBuffer(file);
  }

  function mapRow(row: Record<string, string>): Record<string, unknown> | null {
    const mapped: Record<string, unknown> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      const val = row[header]?.toString().trim() ?? "";
      if (field === "year") {
        const num = parseInt(val);
        mapped.year = !isNaN(num) && num >= 1900 && num <= 2099 ? num : null;
      } else if (field === "genres") {
        mapped.genres = val
          ? val.split(/[,;]/).map((g) => g.trim()).filter(Boolean)
          : [];
      } else if (field === "media_type") {
        mapped.media_type = VALID_MEDIA_TYPES.includes(val.toLowerCase())
          ? val.toLowerCase()
          : val;
      } else if (field === "condition") {
        mapped.condition = VALID_CONDITIONS.includes(val.toLowerCase())
          ? val.toLowerCase()
          : null;
      } else {
        mapped[field] = val || null;
      }
    }
    return mapped;
  }

  function isValid(mapped: Record<string, unknown>): boolean {
    if (!mapped.media_type || !VALID_MEDIA_TYPES.includes(mapped.media_type as string)) return false;
    if (!mapped.title || (mapped.title as string).trim() === "") return false;
    if (!mapped.artist || (mapped.artist as string).trim() === "") return false;
    return true;
  }

  async function handleImport() {
    setImporting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    let imported = 0;
    let skipped = 0;
    const batchSize = 50;
    const validRows: Record<string, unknown>[] = [];

    for (const row of rows) {
      const mapped = mapRow(row);
      if (mapped && isValid(mapped)) {
        validRows.push({
          ...mapped,
          created_by: user.id,
          genres: mapped.genres ?? [],
        });
      } else {
        skipped++;
      }
    }

    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize);
      const { error } = await supabase.from("media").insert(batch);
      if (error) {
        console.error("Batch import error:", error);
        skipped += batch.length;
      } else {
        imported += batch.length;
      }
    }

    setResult({ imported, skipped });
    setImporting(false);
    router.refresh();
  }

  const previewRows = rows.slice(0, 10);
  const mappedPreview = previewRows.map(mapRow);
  const validCount = rows.filter((r) => {
    const m = mapRow(r);
    return m && isValid(m);
  }).length;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-bright p-7 rounded-xl w-full max-w-4xl max-h-[85vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-white text-lg font-bold">Import Media</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">
            &times;
          </button>
        </div>

        {result ? (
          <div className="text-center py-8">
            <p className="text-white text-lg font-bold mb-2">Import Complete</p>
            <p className="text-white/80">
              {result.imported} imported, {result.skipped} skipped
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 bg-bc-gold text-white rounded-md font-bold text-sm hover:bg-bc-gold-light transition"
            >
              Done
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div>
            <p className="text-white/60 text-sm mb-3">
              Upload a CSV, XLSX, XLS, or ODS file.
            </p>
            <label className="block p-8 bg-white/10 border-2 border-dashed border-bc-gold/50 rounded-md text-center cursor-pointer text-sm text-bc-gold font-medium hover:bg-white/20 transition">
              Click to choose file
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.ods"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
          </div>
        ) : (
          <>
            {/* Column mapping */}
            <div className="mb-5">
              <h4 className="text-white/80 text-sm font-semibold mb-2">Column Mapping</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="text-white/60 text-xs truncate w-24">{h}</span>
                    <select
                      value={mapping[h] ?? ""}
                      onChange={(e) =>
                        setMapping({ ...mapping, [h]: e.target.value as TargetField | "" })
                      }
                      className="flex-1 p-1.5 bg-white/90 border border-white/30 rounded text-xs text-gray-900"
                    >
                      <option value="">— skip —</option>
                      {TARGET_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div className="mb-4 overflow-x-auto">
              <h4 className="text-white/80 text-sm font-semibold mb-2">
                Preview (first {previewRows.length} of {rows.length} rows)
              </h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/20 text-white/60">
                    <th className="py-2 px-1 text-left">#</th>
                    {TARGET_FIELDS.filter((f) =>
                      Object.values(mapping).includes(f)
                    ).map((f) => (
                      <th key={f} className="py-2 px-1 text-left">{f}</th>
                    ))}
                    <th className="py-2 px-1 text-left">Valid?</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedPreview.map((m, i) => {
                    const valid = m && isValid(m);
                    return (
                      <tr
                        key={i}
                        className={`border-b border-white/10 ${
                          valid ? "text-white/80" : "text-red-300 bg-red-500/10"
                        }`}
                      >
                        <td className="py-1.5 px-1">{i + 1}</td>
                        {TARGET_FIELDS.filter((f) =>
                          Object.values(mapping).includes(f)
                        ).map((f) => (
                          <td key={f} className="py-1.5 px-1 max-w-[120px] truncate">
                            {m ? String(m[f] ?? "") : ""}
                          </td>
                        ))}
                        <td className="py-1.5 px-1">{valid ? "Yes" : "No"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-white/15 text-white/80 rounded-md font-semibold text-sm hover:bg-white/25 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="flex-1 py-2.5 bg-bc-gold text-white rounded-md font-bold text-sm hover:bg-bc-gold-light transition disabled:opacity-50"
              >
                {importing
                  ? "Importing..."
                  : `Import ${validCount} valid rows`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/import-modal.tsx
git commit -m "feat: add spreadsheet import modal with column mapping, validation, and batch insert"
```

---

## Task 10: Bulk Operations Page

**Files:**
- Create: `src/app/admin/bulk/page.tsx`

- [ ] **Step 1: Create bulk operations page**

Create `src/app/admin/bulk/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import type { Media } from "@/lib/types";
import BulkClient from "./bulk-client";

export const dynamic = "force-dynamic";

async function getAllMedia(): Promise<Media[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .select("*, photos:media_photos(*)")
    .order("date_added", { ascending: false });

  if (error) {
    console.error("Error fetching media:", error);
    return [];
  }

  const s = await createClient();
  return (data ?? []).map((item) => ({
    ...item,
    photos: (item.photos ?? []).map(
      (p: { storage_path: string; [key: string]: unknown }) => ({
        ...p,
        url: s.storage.from("media-photos").getPublicUrl(p.storage_path).data.publicUrl,
      })
    ),
  }));
}

export default async function BulkPage() {
  const media = await getAllMedia();
  return <BulkClient media={media} />;
}
```

- [ ] **Step 2: Create the client wrapper**

Create `src/app/admin/bulk/bulk-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Media } from "@/lib/types";
import BulkGrid from "@/components/admin/bulk-grid";
import BulkToolbar from "@/components/admin/bulk-toolbar";
import BulkEditModal from "@/components/admin/bulk-edit-modal";
import ImportModal from "@/components/admin/import-modal";

export default function BulkClient({ media }: { media: Media[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);

  function toggleItem(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(media.map((m) => m.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  return (
    <>
      <BulkToolbar
        media={media}
        selected={selected}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onOpenEdit={() => setShowEdit(true)}
        onOpenImport={() => setShowImport(true)}
      />

      <BulkGrid
        media={media}
        selected={selected}
        onToggle={toggleItem}
      />

      {showEdit && (
        <BulkEditModal
          selectedIds={Array.from(selected)}
          onClose={() => {
            setShowEdit(false);
            deselectAll();
          }}
        />
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/bulk/
git commit -m "feat: add bulk operations page with selection grid, edit, export, and import"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: exits 0, all routes compile.

- [ ] **Step 3: Verify route list**

The build output should include these new routes:
```
├ ƒ /admin
├ ƒ /admin/bulk
├ ƒ /api/admin/users
├ ƒ /api/admin/users/[id]
├ ƒ /api/admin/users/[id]/role
```

- [ ] **Step 4: Fix any issues found, then commit**

```bash
git add -A
git commit -m "chore: fix any build issues from admin dashboard implementation"
```

Only create this commit if there were actual fixes needed. Skip if build was clean.

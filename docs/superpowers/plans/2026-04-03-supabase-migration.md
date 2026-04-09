# Radio Station DB: Supabase + Next.js Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the college radio station media database from Express/Mongoose/Cloudinary to Next.js (App Router, TSX) + Supabase (Postgres, Auth, Storage), with role-based access (admin/member) and security hardening for public hosting.

**Architecture:** Next.js 14 App Router with a single dashboard SPA page that mirrors the original UI. Supabase handles auth (email/password), Postgres with Row Level Security for data, and Storage for photo uploads. A `profiles` table with a `role` column gates delete to admins. Next.js middleware protects all `/dashboard` routes. Security headers, input validation, and RLS policies enforce defense-in-depth.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (Auth + Postgres + Storage), deployed to Vercel free tier.

---

## File Structure

```
radio-station-db/
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
├── package.json
├── middleware.ts                    -- Auth route protection
├── supabase/
│   └── migrations/
│       └── 001_schema.sql          -- Full schema + RLS + triggers
├── src/
│   ├── app/
│   │   ├── layout.tsx              -- Root layout, global styles
│   │   ├── page.tsx                -- Redirect to /dashboard or /login
│   │   ├── login/
│   │   │   └── page.tsx            -- Login form
│   │   ├── register/
│   │   │   └── page.tsx            -- Register form
│   │   └── dashboard/
│   │       ├── layout.tsx          -- Protected shell (header, nav, logout)
│   │       └── page.tsx            -- Main SPA: stats, form, grid, modal
│   ├── components/
│   │   ├── auth-form.tsx           -- Shared login/register form component
│   │   ├── stats-bar.tsx           -- Collection stats display
│   │   ├── media-form.tsx          -- Add/edit media with photo upload
│   │   ├── media-grid.tsx          -- Card grid with search/filter
│   │   ├── media-card.tsx          -- Individual media card
│   │   ├── detail-modal.tsx        -- Item detail overlay
│   │   └── delete-button.tsx       -- Admin-only delete with confirmation
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts           -- Browser Supabase client
│       │   └── server.ts           -- Server-side Supabase client
│       └── types.ts                -- Shared TypeScript types
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `.env.local.example`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Initialize Next.js project**

From the repo root (after removing old files or in a new branch), run:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

If prompted about overwriting, accept. This scaffolds the project with App Router and Tailwind.

- [ ] **Step 2: Install Supabase dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: Create `.env.local.example`**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 4: Create Supabase browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 5: Create Supabase server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component -- ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 6: Create shared types**

Create `src/lib/types.ts`:

```typescript
export type MediaType = "vinyl" | "45" | "cd";

export type Condition =
  | "mint"
  | "near-mint"
  | "excellent"
  | "good"
  | "fair"
  | "poor";

export type PhotoType = "cover" | "condition" | "tag";

export type Role = "admin" | "member";

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  created_at: string;
}

export interface MediaPhoto {
  id: string;
  media_id: string;
  photo_type: PhotoType;
  storage_path: string;
  url: string;
  description: string;
  uploaded_at: string;
}

export interface Media {
  id: string;
  created_by: string;
  media_type: MediaType;
  title: string;
  artist: string;
  label: string | null;
  year: number | null;
  genres: string[];
  location: string | null;
  condition: Condition | null;
  notes: string | null;
  date_added: string;
  photos: MediaPhoto[];
  profile?: Pick<Profile, "display_name">;
}
```

- [ ] **Step 7: Commit scaffolding**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Tailwind + Supabase client setup"
```

---

## Task 2: Supabase Schema + RLS Policies

**Files:**
- Create: `supabase/migrations/001_schema.sql`

This is the most critical security task. RLS policies are the primary defense since the Supabase anon key is public.

- [ ] **Step 1: Write the full migration SQL**

Create `supabase/migrations/001_schema.sql`:

```sql
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
  location    text,
  condition   text check (condition is null or condition in ('mint','near-mint','excellent','good','fair','poor')),
  notes       text,
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

-- All authenticated users can update media
create policy "Authenticated users can update media"
  on public.media for update
  to authenticated
  using (true)
  with check (true);

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
```

- [ ] **Step 2: Apply the migration**

Go to your Supabase project dashboard > SQL Editor, paste the contents of `001_schema.sql`, and run it. Alternatively, if using Supabase CLI:

```bash
npx supabase db push
```

- [ ] **Step 3: Promote first admin**

After registering your first user through the app (built in Task 4), promote them to admin via SQL Editor:

```sql
update public.profiles set role = 'admin' where display_name = 'YourName';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema with RLS policies and role-based access"
```

---

## Task 3: Auth Middleware

**Files:**
- Create: `middleware.ts` (project root, not inside `src/`)

- [ ] **Step 1: Create Next.js middleware for route protection**

Create `middleware.ts`:

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

  // Redirect unauthenticated users away from dashboard
  if (path.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
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

  // Security headers
  supabaseResponse.headers.set("X-Frame-Options", "DENY");
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  supabaseResponse.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return supabaseResponse;
}

export const config = {
  matcher: ["/", "/login", "/register", "/dashboard/:path*"],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware with route protection and security headers"
```

---

## Task 4: Auth Pages (Login + Register)

**Files:**
- Create: `src/components/auth-form.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radio Station Media DB",
  description: "College radio station media catalog",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create shared auth form component**

Create `src/components/auth-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AuthFormProps {
  mode: "login" | "register";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password needs at least 6 characters");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-5">
      <div className="bg-white rounded-xl p-10 shadow-2xl w-full max-w-md">
        <h1 className="text-indigo-500 text-3xl font-bold text-center mb-7">
          Radio Station DB
        </h1>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 border-l-4 border-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="mb-4">
              <label className="block mb-1.5 text-sm font-semibold text-gray-700">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full p-2.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block mb-1.5 text-sm font-semibold text-gray-700">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
              className="w-full p-2.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1.5 text-sm font-semibold text-gray-700">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full p-2.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>

          {mode === "register" && (
            <div className="mb-4">
              <label className="block mb-1.5 text-sm font-semibold text-gray-700">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full p-2.5 border-2 border-gray-200 rounded-md focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-indigo-500 text-white rounded-md font-semibold hover:bg-indigo-600 transition disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "register"
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        <p className="text-center mt-5 text-sm text-gray-500">
          {mode === "register" ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-indigo-500 font-semibold">
                Sign In
              </Link>
            </>
          ) : (
            <>
              Need an account?{" "}
              <Link href="/register" className="text-indigo-500 font-semibold">
                Register
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create login page**

Create `src/app/login/page.tsx`:

```tsx
import AuthForm from "@/components/auth-form";

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
```

- [ ] **Step 4: Create register page**

Create `src/app/register/page.tsx`:

```tsx
import AuthForm from "@/components/auth-form";

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
```

- [ ] **Step 5: Update root page to redirect**

Replace `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/login");
}
```

- [ ] **Step 6: Verify auth flow manually**

```bash
npm run dev
```

1. Visit `http://localhost:3000` -- should redirect to `/login`
2. Click "Register" link -- should show register form
3. Register a new account -- should redirect to `/dashboard` (404 is fine, we build it next)
4. Visit `/login` while logged in -- should redirect to `/dashboard`

- [ ] **Step 7: Commit**

```bash
git add src/ middleware.ts
git commit -m "feat: add auth pages with Supabase login and registration"
```

---

## Task 5: Dashboard Layout + Stats

**Files:**
- Create: `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`, `src/components/stats-bar.tsx`

- [ ] **Step 1: Create dashboard layout with header and logout**

Create `src/app/dashboard/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="min-h-screen p-5">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader profile={profile} />
        {children}
      </div>
    </div>
  );
}

function DashboardHeader({ profile }: { profile: Profile }) {
  return (
    <header className="flex justify-between items-center text-white mb-7 flex-wrap gap-4">
      <h1 className="text-3xl font-bold drop-shadow-md">
        Radio Station Media Database
      </h1>
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <div className="font-bold text-sm">{profile.display_name}</div>
          <div className="text-xs opacity-90">
            {profile.role === "admin" ? "Admin" : "Member"}
          </div>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="bg-white/20 text-white border-2 border-white px-4 py-2 rounded-md font-semibold text-sm hover:bg-white/30 transition"
          >
            Logout
          </button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create logout API route**

Create `src/app/api/auth/logout/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 3: Create stats bar component**

Create `src/components/stats-bar.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";

interface Stats {
  total: number;
  vinyl: number;
  fortyfive: number;
  cd: number;
}

async function getStats(): Promise<Stats> {
  const supabase = await createClient();

  const { count: total } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true });

  const { count: vinyl } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("media_type", "vinyl");

  const { count: fortyfive } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("media_type", "45");

  const { count: cd } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("media_type", "cd");

  return {
    total: total ?? 0,
    vinyl: vinyl ?? 0,
    fortyfive: fortyfive ?? 0,
    cd: cd ?? 0,
  };
}

export default async function StatsBar() {
  const stats = await getStats();

  const items = [
    { label: "Total Items", value: stats.total },
    { label: "Vinyl Records", value: stats.vinyl },
    { label: "45 RPM", value: stats.fortyfive },
    { label: "CDs", value: stats.cd },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-7">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white p-5 rounded-xl text-center shadow-md"
        >
          <div className="text-4xl font-bold text-indigo-500">{item.value}</div>
          <div className="text-gray-500 text-sm mt-1 font-medium">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create initial dashboard page**

Create `src/app/dashboard/page.tsx`:

```tsx
import { Suspense } from "react";
import StatsBar from "@/components/stats-bar";

export default function DashboardPage() {
  return (
    <>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-7">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/50 p-5 rounded-xl text-center shadow-md animate-pulse h-24"
              />
            ))}
          </div>
        }
      >
        <StatsBar />
      </Suspense>
      {/* Media grid and form will be added in Tasks 6-7 */}
    </>
  );
}
```

- [ ] **Step 5: Verify dashboard loads**

```bash
npm run dev
```

1. Visit `http://localhost:3000/dashboard` while logged in
2. Should see header with display name, role badge, logout button
3. Should see 4 stat cards (all showing 0)
4. Logout should redirect to `/login`

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: add dashboard layout with header, logout, and stats bar"
```

---

## Task 6: Media Grid + Search/Filter

**Files:**
- Create: `src/components/media-grid.tsx`, `src/components/media-card.tsx`, `src/components/search-filters.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Create search/filter component**

Create `src/components/search-filters.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export default function SearchFilters({
  allGenres,
}: {
  allGenres: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/dashboard?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="bg-white rounded-xl p-4 mb-6 shadow-md">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="Search title or artist..."
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => updateParam("q", e.target.value)}
          className="p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
        />
        <select
          defaultValue={searchParams.get("type") ?? ""}
          onChange={(e) => updateParam("type", e.target.value)}
          className="p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Types</option>
          <option value="vinyl">Vinyl</option>
          <option value="45">45 RPM</option>
          <option value="cd">CD</option>
        </select>
        <select
          defaultValue={searchParams.get("genre") ?? ""}
          onChange={(e) => updateParam("genre", e.target.value)}
          className="p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Genres</option>
          {allGenres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create media card component**

Create `src/components/media-card.tsx`:

```tsx
"use client";

import type { Media } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  vinyl: "Vinyl",
  "45": "45 RPM",
  cd: "CD",
};

interface MediaCardProps {
  item: Media;
  isAdmin: boolean;
  onView: (item: Media) => void;
  onEdit: (item: Media) => void;
  onDelete: (id: string) => void;
}

export default function MediaCard({
  item,
  isAdmin,
  onView,
  onEdit,
  onDelete,
}: MediaCardProps) {
  const cover = item.photos?.find((p) => p.photo_type === "cover");

  return (
    <div
      onClick={() => onView(item)}
      className="bg-white rounded-xl overflow-hidden shadow-md hover:-translate-y-1 hover:shadow-xl transition cursor-pointer"
    >
      {cover ? (
        <img
          src={cover.url}
          alt={item.title}
          className="w-full h-56 object-cover"
        />
      ) : (
        <div className="w-full h-56 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-5xl">
          🎵
        </div>
      )}
      <div className="p-4">
        <span className="inline-block bg-purple-600 text-white px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide mb-2">
          {TYPE_LABELS[item.media_type] ?? item.media_type}
        </span>
        <div className="font-bold text-gray-800 leading-tight mb-1">
          {item.title}
        </div>
        <div className="text-gray-500 text-sm mb-1">{item.artist}</div>
        {item.label && (
          <div className="text-gray-400 text-xs mb-2">{item.label}</div>
        )}
        {item.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.genres.map((g) => (
              <span
                key={g}
                className="bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full text-xs font-semibold"
              >
                {g}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            className="flex-1 py-2 text-xs bg-indigo-500 text-white rounded font-semibold hover:bg-indigo-600 transition"
          >
            Edit
          </button>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="flex-1 py-2 text-xs bg-red-500 text-white rounded font-semibold hover:bg-red-600 transition"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create media grid component**

Create `src/components/media-grid.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Media, Role } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import MediaCard from "@/components/media-card";
import DetailModal from "@/components/detail-modal";

interface MediaGridProps {
  media: Media[];
  role: Role;
  onEdit: (item: Media) => void;
}

export default function MediaGrid({ media, role, onEdit }: MediaGridProps) {
  const [viewing, setViewing] = useState<Media | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const isAdmin = role === "admin";

  async function handleDelete(id: string) {
    if (!confirm("Delete this item permanently?")) return;

    // Delete associated photos from storage first
    const item = media.find((m) => m.id === id);
    if (item?.photos?.length) {
      const paths = item.photos.map((p) => p.storage_path);
      await supabase.storage.from("media-photos").remove(paths);
    }

    // Delete associated photo records
    await supabase.from("media_photos").delete().eq("media_id", id);

    // Delete the media record
    const { error } = await supabase.from("media").delete().eq("id", id);
    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    router.refresh();
  }

  if (media.length === 0) {
    return (
      <div className="text-center py-14 text-gray-400">
        No items match your search.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {media.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            isAdmin={isAdmin}
            onView={setViewing}
            onEdit={onEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>
      {viewing && (
        <DetailModal item={viewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
}
```

- [ ] **Step 4: Create detail modal (placeholder -- full version in Task 8)**

Create `src/components/detail-modal.tsx`:

```tsx
"use client";

import type { Media } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  vinyl: "Vinyl Record",
  "45": "45 RPM",
  cd: "CD",
};

interface DetailModalProps {
  item: Media;
  onClose: () => void;
}

export default function DetailModal({ item, onClose }: DetailModalProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white p-7 rounded-xl max-w-2xl w-full max-h-[82vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex justify-between items-center mb-5">
          <span className="text-xl font-bold text-gray-800">Item Details</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="mb-2 text-sm">
          <strong>Type:</strong> {TYPE_LABELS[item.media_type] ?? item.media_type}
        </p>
        <p className="mb-2 text-sm">
          <strong>Title:</strong> {item.title}
        </p>
        <p className="mb-2 text-sm">
          <strong>Artist:</strong> {item.artist}
        </p>
        {item.label && (
          <p className="mb-2 text-sm">
            <strong>Label:</strong> {item.label}
          </p>
        )}
        {item.year && (
          <p className="mb-2 text-sm">
            <strong>Year:</strong> {item.year}
          </p>
        )}
        {item.condition && (
          <p className="mb-2 text-sm">
            <strong>Condition:</strong> {item.condition}
          </p>
        )}
        {item.genres.length > 0 && (
          <p className="mb-2 text-sm">
            <strong>Genres:</strong> {item.genres.join(", ")}
          </p>
        )}
        {item.location && (
          <div className="bg-gray-100 p-3 border-l-4 border-indigo-500 rounded my-3 text-sm">
            <strong>Location:</strong> {item.location}
          </div>
        )}
        {item.notes && (
          <p className="mb-2 text-sm">
            <strong>Notes:</strong> {item.notes}
          </p>
        )}

        {item.photos?.length > 0 && (
          <>
            <h3 className="text-base font-bold text-gray-700 mt-5 mb-3">
              Photos
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {item.photos.map((p) => (
                <div key={p.id} className="relative rounded-lg overflow-hidden">
                  <img
                    src={p.url}
                    alt={p.photo_type}
                    className="w-full h-36 object-cover"
                  />
                  <div className="absolute bottom-0 w-full bg-black/70 text-white text-center text-xs py-1 uppercase font-semibold">
                    {p.photo_type}
                    {p.description ? ` — ${p.description}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-gray-400 text-xs mt-5 pt-3 border-t border-gray-200">
          Added {new Date(item.date_added).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire up dashboard page with grid and filters**

Replace `src/app/dashboard/page.tsx`:

```tsx
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import StatsBar from "@/components/stats-bar";
import SearchFilters from "@/components/search-filters";
import DashboardClient from "@/components/dashboard-client";
import type { Media, Profile } from "@/lib/types";

interface DashboardProps {
  searchParams: Promise<{ q?: string; type?: string; genre?: string }>;
}

async function getMedia(filters: {
  q?: string;
  type?: string;
  genre?: string;
}): Promise<Media[]> {
  const supabase = await createClient();
  let query = supabase
    .from("media")
    .select("*, photos:media_photos(*), profile:profiles!created_by(display_name)")
    .order("date_added", { ascending: false });

  if (filters.type) {
    query = query.eq("media_type", filters.type);
  }
  if (filters.genre) {
    query = query.contains("genres", [filters.genre]);
  }
  if (filters.q) {
    query = query.or(
      `title.ilike.%${filters.q}%,artist.ilike.%${filters.q}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching media:", error);
    return [];
  }

  // Resolve photo URLs from storage
  const s = await createClient();
  return (data ?? []).map((item) => ({
    ...item,
    photos: (item.photos ?? []).map(
      (p: { storage_path: string; [key: string]: unknown }) => ({
        ...p,
        url: s.storage.from("media-photos").getPublicUrl(p.storage_path).data
          .publicUrl,
      })
    ),
  }));
}

async function getAllGenres(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("media").select("genres");
  const genreSet = new Set<string>();
  (data ?? []).forEach((row) =>
    (row.genres ?? []).forEach((g: string) => genreSet.add(g))
  );
  return [...genreSet].sort();
}

async function getProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();
  return data!;
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const filters = await searchParams;
  const [media, allGenres, profile] = await Promise.all([
    getMedia(filters),
    getAllGenres(),
    getProfile(),
  ]);

  return (
    <>
      <Suspense
        fallback={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-7">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/50 p-5 rounded-xl text-center shadow-md animate-pulse h-24"
              />
            ))}
          </div>
        }
      >
        <StatsBar />
      </Suspense>

      <SearchFilters allGenres={allGenres} />

      <DashboardClient media={media} role={profile.role} />
    </>
  );
}
```

- [ ] **Step 6: Create dashboard client wrapper**

Create `src/components/dashboard-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Media, Role } from "@/lib/types";
import MediaGrid from "@/components/media-grid";
import MediaForm from "@/components/media-form";

interface DashboardClientProps {
  media: Media[];
  role: Role;
}

export default function DashboardClient({
  media,
  role,
}: DashboardClientProps) {
  const [editing, setEditing] = useState<Media | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-7">
      <div className="bg-white rounded-xl p-7 shadow-xl h-fit lg:sticky lg:top-5 lg:max-h-[88vh] lg:overflow-y-auto">
        <MediaForm
          editing={editing}
          onDone={() => setEditing(null)}
        />
      </div>
      <MediaGrid media={media} role={role} onEdit={setEditing} />
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "feat: add media grid, search filters, detail modal, and dashboard wiring"
```

---

## Task 7: Media Form + Photo Upload

**Files:**
- Create: `src/components/media-form.tsx`, `src/components/photo-upload.tsx`

- [ ] **Step 1: Create photo upload component**

Create `src/components/photo-upload.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { PhotoType } from "@/lib/types";

export interface PendingPhoto {
  file: File;
  type: PhotoType;
  description: string;
  preview: string;
}

interface PhotoUploadProps {
  photos: PendingPhoto[];
  onChange: (photos: PendingPhoto[]) => void;
}

export default function PhotoUpload({ photos, onChange }: PhotoUploadProps) {
  const [slots, setSlots] = useState<
    { type: PhotoType; description: string }[]
  >([{ type: "cover", description: "" }]);

  function addSlot() {
    setSlots([...slots, { type: "cover", description: "" }]);
  }

  function removeSlot(index: number) {
    setSlots(slots.filter((_, i) => i !== index));
  }

  function handleFile(slotIndex: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    const slot = slots[slotIndex];
    const newPhotos = [...photos];
    Array.from(files).forEach((file) => {
      const preview = URL.createObjectURL(file);
      newPhotos.push({
        file,
        type: slot.type,
        description: slot.description,
        preview,
      });
    });
    onChange(newPhotos);
  }

  function removePhoto(index: number) {
    const updated = [...photos];
    URL.revokeObjectURL(updated[index].preview);
    updated.splice(index, 1);
    onChange(updated);
  }

  return (
    <div className="border-2 border-dashed border-indigo-500 rounded-lg p-4 my-4 bg-indigo-50/30">
      <h4 className="font-semibold text-sm text-gray-700 mb-1">Photos</h4>
      <p className="text-xs text-gray-500 mb-3">
        Upload cover art, condition photos, and library tag images.
      </p>

      {slots.map((slot, idx) => (
        <div
          key={idx}
          className="mb-4 pb-4 border-b border-gray-200 last:border-b-0 last:mb-0 last:pb-0"
        >
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select
              value={slot.type}
              onChange={(e) => {
                const updated = [...slots];
                updated[idx].type = e.target.value as PhotoType;
                setSlots(updated);
              }}
              className="p-2 border border-gray-300 rounded text-sm"
            >
              <option value="cover">Cover Art</option>
              <option value="condition">Condition</option>
              <option value="tag">Library Tag</option>
            </select>
            <input
              type="text"
              placeholder="Optional description"
              value={slot.description}
              onChange={(e) => {
                const updated = [...slots];
                updated[idx].description = e.target.value;
                setSlots(updated);
              }}
              className="p-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <label className="block p-3 bg-white border-2 border-dashed border-indigo-500 rounded-md text-center cursor-pointer text-sm text-indigo-500 font-medium hover:bg-indigo-50 transition">
            Click to choose photo
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFile(idx, e.target.files)}
            />
          </label>
          {idx > 0 && (
            <button
              type="button"
              onClick={() => removeSlot(idx)}
              className="w-full mt-2 bg-gray-100 text-gray-600 py-1.5 rounded text-xs hover:bg-gray-200"
            >
              Remove Slot
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addSlot}
        className="w-full mt-3 bg-gray-100 text-gray-600 py-2.5 rounded-md font-semibold text-sm hover:bg-gray-200"
      >
        + Add Another Photo Slot
      </button>

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {photos.map((p, idx) => (
            <div key={idx} className="relative">
              <img
                src={p.preview}
                alt="preview"
                className="w-full h-[72px] object-cover rounded border-2 border-gray-200"
              />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create media form component**

Create `src/components/media-form.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Media, MediaType, Condition } from "@/lib/types";
import PhotoUpload, { type PendingPhoto } from "@/components/photo-upload";

interface MediaFormProps {
  editing: Media | null;
  onDone: () => void;
}

export default function MediaForm({ editing, onDone }: MediaFormProps) {
  const [mediaType, setMediaType] = useState<MediaType | "">("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [label, setLabel] = useState("");
  const [year, setYear] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [genreInput, setGenreInput] = useState("");
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState<Condition | "">("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Populate form when editing
  useEffect(() => {
    if (editing) {
      setMediaType(editing.media_type);
      setTitle(editing.title);
      setArtist(editing.artist);
      setLabel(editing.label ?? "");
      setYear(editing.year?.toString() ?? "");
      setGenres(editing.genres);
      setLocation(editing.location ?? "");
      setCondition(editing.condition ?? "");
      setNotes(editing.notes ?? "");
      setPhotos([]);
    }
  }, [editing]);

  function clearForm() {
    setMediaType("");
    setTitle("");
    setArtist("");
    setLabel("");
    setYear("");
    setGenres([]);
    setGenreInput("");
    setLocation("");
    setCondition("");
    setNotes("");
    setPhotos([]);
    onDone();
  }

  function addGenre(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = genreInput.trim();
    if (val && !genres.includes(val)) {
      setGenres([...genres, val]);
    }
    setGenreInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mediaType || !title.trim() || !artist.trim()) {
      alert("Please fill in Type, Title, and Artist.");
      return;
    }
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const mediaData = {
        media_type: mediaType,
        title: title.trim(),
        artist: artist.trim(),
        label: label.trim() || null,
        year: year ? parseInt(year) : null,
        genres,
        location: location.trim() || null,
        condition: condition || null,
        notes: notes.trim() || null,
        created_by: user.id,
      };

      let mediaId: string;

      if (editing) {
        // Don't overwrite created_by on edit
        const { created_by: _, ...updateData } = mediaData;
        const { error } = await supabase
          .from("media")
          .update(updateData)
          .eq("id", editing.id);
        if (error) throw error;
        mediaId = editing.id;
      } else {
        const { data, error } = await supabase
          .from("media")
          .insert(mediaData)
          .select("id")
          .single();
        if (error) throw error;
        mediaId = data.id;
      }

      // Upload new photos
      for (const photo of photos) {
        const ext = photo.file.name.split(".").pop() ?? "jpg";
        const path = `${mediaId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("media-photos")
          .upload(path, photo.file, {
            contentType: photo.file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error("Photo upload failed:", uploadError.message);
          continue;
        }

        await supabase.from("media_photos").insert({
          media_id: mediaId,
          photo_type: photo.type,
          storage_path: path,
          description: photo.description,
        });
      }

      clearForm();
      router.refresh();
    } catch (err) {
      alert(
        "Save failed: " + (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h2 className="text-indigo-500 text-xl font-bold mb-5">
        {editing ? "Edit Item" : "Add New Item"}
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Media Type *
          </label>
          <select
            required
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as MediaType)}
            className="w-full p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select type...</option>
            <option value="vinyl">Vinyl Record</option>
            <option value="45">45 RPM Single</option>
            <option value="cd">CD</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Title *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Album / single title"
            className="w-full p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Artist *
          </label>
          <input
            type="text"
            required
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist or band name"
            className="w-full p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Record Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Atlantic, Blue Note"
            className="w-full p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Release Year
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 1975"
            min="1900"
            max="2099"
            className="w-full p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Genres{" "}
            <span className="font-normal text-xs">(type & press Enter)</span>
          </label>
          <input
            type="text"
            value={genreInput}
            onChange={(e) => setGenreInput(e.target.value)}
            onKeyDown={addGenre}
            placeholder="e.g. Jazz, Soul, Rock..."
            className="w-full p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
          />
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {genres.map((g) => (
                <span
                  key={g}
                  className="bg-indigo-500 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1"
                >
                  {g}
                  <span
                    className="cursor-pointer font-bold opacity-80 hover:opacity-100"
                    onClick={() => setGenres(genres.filter((x) => x !== g))}
                  >
                    &times;
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Library Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Shelf B-4, Bin 12"
            className="w-full p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Condition
          </label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
            className="w-full p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select condition...</option>
            <option value="mint">Mint (Sealed)</option>
            <option value="near-mint">Near Mint</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Notes / Comments
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Scratches? Missing sleeve? Any observations..."
            className="w-full p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 min-h-[78px] resize-y"
          />
        </div>

        <PhotoUpload photos={photos} onChange={setPhotos} />

        <div className="grid grid-cols-2 gap-2.5 mt-6">
          <button
            type="button"
            onClick={clearForm}
            className="bg-gray-100 text-gray-600 py-3 rounded-md font-semibold text-sm hover:bg-gray-200 transition"
          >
            Clear Form
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-500 text-white py-3 rounded-md font-bold text-sm hover:bg-indigo-600 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Item"}
          </button>
        </div>
      </form>
    </>
  );
}
```

- [ ] **Step 3: Verify full flow manually**

```bash
npm run dev
```

1. Register an account, promote to admin via Supabase SQL editor
2. Add a media item with a photo -- should appear in grid
3. Edit the item -- form should populate, save should update
4. Click a card -- detail modal should open with all fields
5. Delete as admin -- item should disappear
6. Register a second (non-admin) account -- delete button should not appear

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: add media form with photo upload and full CRUD"
```

---

## Task 8: Security Hardening

**Files:**
- Modify: `next.config.ts`, `middleware.ts`

Since this app is publicly hosted, these measures supplement the RLS policies from Task 2.

- [ ] **Step 1: Add security headers in next.config.ts**

Replace `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://*.supabase.co`,
            `img-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://*.supabase.co blob: data:`,
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "frame-ancestors 'none'",
          ].join("; "),
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ],
    },
  ],
};

export default nextConfig;
```

- [ ] **Step 2: Remove duplicate security headers from middleware**

In `middleware.ts`, remove the four `supabaseResponse.headers.set(...)` lines from the end of the function (they're now in `next.config.ts` which covers all routes more reliably):

```typescript
  // Remove these lines -- now handled by next.config.ts:
  // supabaseResponse.headers.set("X-Frame-Options", "DENY");
  // supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  // supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // supabaseResponse.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return supabaseResponse;
```

- [ ] **Step 3: Configure Supabase project settings**

In the Supabase dashboard, apply these settings:

1. **Auth > Settings > Email Auth**: Enable email confirmations for production
2. **Auth > Settings > Rate Limits**: Keep defaults (they limit auth attempts per hour)
3. **Auth > URL Configuration**: Set Site URL to your production domain, add `localhost:3000` to redirect allow list for dev
4. **Storage > media-photos bucket**: Set max file size to 5MB in bucket settings

- [ ] **Step 4: Update `.env.local.example`**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Note: Only these two env vars are needed. The anon key is safe to expose -- RLS policies are the security boundary, not the key. Never expose the `service_role` key.

- [ ] **Step 5: Verify security**

```bash
npm run build && npm start
```

1. Open browser devtools > Network tab -- verify security headers appear on responses
2. Try accessing `/dashboard` in an incognito window -- should redirect to `/login`
3. Try a Supabase query with only the anon key (no auth) -- RLS should block access to `media` table
4. As a non-admin user, verify delete buttons are hidden AND that a manual Supabase delete call is rejected by RLS

- [ ] **Step 6: Commit**

```bash
git add next.config.ts middleware.ts .env.local.example
git commit -m "feat: add security headers, CSP, and hardening notes"
```

---

## Task 9: Cleanup + Deploy Prep

**Files:**
- Delete: `server.js`, `public/index.html`
- Modify: `package.json`, `.gitignore`, `CLAUDE.md`

- [ ] **Step 1: Remove old files**

```bash
rm server.js
rm -rf public/index.html
```

If `public/` is empty after this, remove it too (Next.js will use its own `public/` under default setup).

- [ ] **Step 2: Update .gitignore**

Ensure `.gitignore` includes:

```
node_modules/
.env
.env.local
.env*.local
*.log
.DS_Store
.next/
out/
```

- [ ] **Step 3: Update CLAUDE.md to reflect new architecture**

Replace the contents of `CLAUDE.md` with documentation reflecting the new Next.js + Supabase stack, data model, file structure, and development commands.

- [ ] **Step 4: Deploy to Vercel**

```bash
npm i -g vercel
vercel
```

When prompted, link to a new project. Set the environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel dashboard under Settings > Environment Variables.

Update the Supabase Auth > URL Configuration "Site URL" to your new `*.vercel.app` domain.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: remove legacy files, update config for Vercel deployment"
```

---

## Security Summary

| Layer | Protection |
|-------|-----------|
| **Database (RLS)** | All tables have row-level security. Delete restricted to admin role. Insert enforces `created_by = auth.uid()`. |
| **Auth** | Supabase Auth handles password hashing, session tokens, rate limiting. No hand-rolled JWT. |
| **Transport** | HSTS header forces HTTPS. Vercel provides TLS by default. |
| **Headers** | CSP, X-Frame-Options (DENY), X-Content-Type-Options, Referrer-Policy, Permissions-Policy. |
| **Middleware** | Unauthenticated users cannot access `/dashboard` routes. |
| **Storage** | Upload restricted to authenticated users. Delete restricted to admins. Public read for display. 5MB file limit. |
| **Client** | Anon key is safe to expose -- RLS is the security boundary. Service role key never exposed. |

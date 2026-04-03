# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product Overview

College radio station media database -- a web app for cataloguing physical media (vinyl records, 45 RPM singles, CDs) owned by a radio station. Each station registers an account and can add, edit, search, and browse their media collection with photos, condition ratings, genre tags, and physical library locations (e.g. "Shelf B-4"). Supports role-based access: admins can delete items, members can add and edit.

## Architecture

**Next.js 14 App Router + Supabase.** The frontend is server-rendered TSX with client components where needed. Supabase handles auth (email/password), Postgres with Row Level Security for data, and Storage for photo uploads.

- **Frontend (`src/app/`, `src/components/`):** Next.js App Router with TypeScript and Tailwind CSS. Dashboard is a single SPA-style page with server components for data fetching and client components for interactivity.
- **Auth:** Supabase Auth with `@supabase/ssr`. Middleware (`middleware.ts`) protects `/dashboard` routes and redirects unauthenticated users to `/login`.
- **Database:** Supabase Postgres with RLS policies. Schema defined in `supabase/migrations/001_schema.sql`.
- **Storage:** Supabase Storage bucket `media-photos` for cover art, condition photos, and library tag images.

### Data Models (Supabase Postgres)

- **profiles:** id (uuid, refs auth.users), display_name, role (`admin`|`member`), created_at. Auto-created on signup via trigger.
- **media:** id (uuid), created_by (ref profiles), media_type (`vinyl`|`45`|`cd`), title, artist, label, year, genres[], location, condition, notes, date_added
- **media_photos:** id (uuid), media_id (ref media), photo_type (`cover`|`condition`|`tag`), storage_path, description, uploaded_at

### Key Files

| File | Purpose |
|------|---------|
| `middleware.ts` | Auth route protection, redirects |
| `src/lib/types.ts` | Shared TypeScript types |
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server-side Supabase client |
| `src/app/dashboard/page.tsx` | Main dashboard with stats, search, grid |
| `src/components/dashboard-client.tsx` | Client wrapper for media form + grid |
| `src/components/media-form.tsx` | Add/edit media with photo upload |
| `src/components/media-grid.tsx` | Card grid with delete (admin only) |
| `next.config.ts` | Security headers and CSP |
| `supabase/migrations/001_schema.sql` | Full schema with RLS policies |

### External Services

- **Supabase** -- Auth, Postgres database, and Storage (photo uploads)
- **Vercel** -- Hosting (free tier)

## Development

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase URL and anon key
npm run dev                         # Next.js dev server (hot-reload)
npm run build                       # Production build
```

Dev server runs on `http://localhost:3000`. No test suite exists. ESLint configured via Next.js defaults.

## Environment Variables

See `.env.local.example` -- requires: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

The anon key is safe to expose -- RLS policies are the security boundary. Never expose the `service_role` key.

## Security

RLS policies enforce all access control at the database level. Delete operations restricted to admin role. Security headers (CSP, HSTS, X-Frame-Options) configured in `next.config.ts`. Middleware protects dashboard routes from unauthenticated access.

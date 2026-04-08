# WZBC Media Database

A web application for college radio stations to catalogue their physical media collections -- vinyl records, 45 RPM singles, and CDs. Each station registers an account and can add, edit, search, and browse their collection with cover photos, condition ratings, genre tags, and physical box locations.

## Features

- **Media cataloguing** -- Add vinyl records, 45s, and CDs with title, artist, label, year, genre, condition rating, and notes
- **Photo uploads** -- Attach cover art, condition photos, and library tag images to each record
- **Box location system** -- Track physical storage locations (boxes A-X), each identified by 3 colored dots for quick visual identification
- **Search and filters** -- Full-text search across titles and artists, filter by media type, genre, and location
- **Bulk operations** -- Import media from CSV spreadsheets, export collection data, bulk edit and delete
- **Role-based access** -- Admins can delete items and manage users; members can add and edit
- **Admin dashboard** -- User management and station administration tools

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Server Components)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Auth & Database:** [Supabase](https://supabase.com/) (Postgres + Auth + Storage)
- **Hosting:** Vercel (or any Node.js host)

## Prerequisites

- [Node.js](https://nodejs.org/) 18.17 or later
- A [Supabase](https://supabase.com/) account (free tier works)
- npm (comes with Node.js)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/WZBCDB/radio-station-db.git
cd radio-station-db
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Supabase project

1. Go to [supabase.com](https://supabase.com/) and create a new project
2. Note your **Project URL** and **anon (public) key** from Settings > API
3. Note your **service_role key** (needed for admin features only -- keep this secret)

### 4. Set up the database schema

In your Supabase project dashboard:

1. Go to **SQL Editor**
2. Open and run the contents of `supabase/migrations/001_schema.sql`

This creates:
- `profiles` table (extends Supabase auth users with display name and role)
- `media` table (the main collection records)
- `media_photos` table (photo attachments for media items)
- `media-photos` storage bucket (for uploaded images)
- Row Level Security (RLS) policies for all tables
- Auto-create profile trigger on user signup
- Full-text search indexes

### 5. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

| Variable | Description | Public? |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes (safe to expose) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes (RLS is the security boundary) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | **No -- never expose this** |

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Create your first account

1. Navigate to `/register` and create an account
2. The first user's profile is created automatically via a database trigger with the `member` role

To make yourself an admin, run this in the Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE display_name = 'Your Name';
```

## Project Structure

```
radio-station-db/
├── src/
│   ├── app/
│   │   ├── admin/          # Admin dashboard pages
│   │   ├── api/            # API routes
│   │   ├── dashboard/      # Main dashboard (search, grid, add/edit)
│   │   ├── login/          # Login page
│   │   ├── register/       # Registration page
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Landing page
│   ├── components/
│   │   ├── admin/          # Admin-specific components
│   │   ├── auth-form.tsx   # Login/register form
│   │   ├── box-dots.tsx    # Colored dot indicators for box locations
│   │   ├── dashboard-client.tsx  # Client wrapper for dashboard
│   │   ├── detail-modal.tsx      # Media detail view modal
│   │   ├── media-card.tsx        # Individual media card
│   │   ├── media-form.tsx        # Add/edit media form with photo upload
│   │   ├── media-grid.tsx        # Card grid display
│   │   ├── photo-upload.tsx      # Photo upload component
│   │   ├── search-filters.tsx    # Search and filter controls
│   │   └── stats-bar.tsx         # Collection statistics
│   └── lib/
│       ├── box-colors.ts         # Box location color mappings
│       ├── supabase/
│       │   ├── client.ts         # Browser Supabase client
│       │   └── server.ts         # Server-side Supabase client
│       └── types.ts              # Shared TypeScript types
├── supabase/
│   └── migrations/
│       └── 001_schema.sql        # Full database schema with RLS policies
├── middleware.ts                  # Auth route protection
├── next.config.ts                # Security headers and CSP
└── box-colors.md                 # Physical box color reference
```

## Box Location System

Media items are stored in physical boxes labeled A through X. Each box is identified by a unique combination of 3 colored dots for quick visual lookup:

| Box | Colors | Box | Colors |
|-----|--------|-----|--------|
| A | Red, Orange, Yellow | N | Red, Yellow, Pink |
| B | Green, Blue, Indigo | O | Orange, Green, Indigo |
| C | Purple, Pink, Yellow | P | Yellow, Purple, Red |
| D | Red, Blue, Orange | Q | Pink, Blue, Green |
| E | Blue, Green, Yellow | R | Green, Indigo, Orange |
| F | Indigo, Purple, Pink | S | Blue, Yellow, Purple |
| G | Orange, Red, Purple | T | Indigo, Red, Pink |
| H | Yellow, Green, Blue | U | Purple, Green, Yellow |
| I | Pink, Red, Indigo | V | Red, Pink, Blue |
| J | Green, Orange, Purple | W | Orange, Indigo, Green |
| K | Blue, Pink, Red | X | Yellow, Blue, Red |
| L | Indigo, Yellow, Green | | |
| M | Purple, Blue, Orange | | |

## CSV Import

The bulk import feature accepts CSV files with the following columns:

| CSV Column | Maps To | Notes |
|------------|---------|-------|
| Album | `title` | Required |
| Artist | `artist` | Required |
| Label | `label` | Optional |
| Year | `year` | 4-digit year, optional |
| Genre | `genres` | Comma-separated, optional |
| Condition | `condition` | mint, near-mint, excellent, good, fair, poor |
| Notes | `notes` | Optional |

Media type and box location are set during import for the entire batch.

## Security

- **Row Level Security (RLS)** enforces all access control at the database level
- **Delete operations** restricted to admin role only
- **Security headers** configured in `next.config.ts`: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Auth middleware** protects `/dashboard` routes from unauthenticated access
- The `anon` key is safe to expose in the client -- RLS policies are the security boundary
- The `service_role` key must never be exposed to the client

## Available Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Create production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Deployment

### Vercel (recommended)

1. Push your repo to GitHub
2. Import the project in [Vercel](https://vercel.com/)
3. Add the three environment variables in the Vercel project settings
4. Deploy

### Other platforms

Any platform that supports Node.js 18+ can run this app:

```bash
npm run build
npm run start
```

Set the environment variables on your hosting platform before building.

## License

This project is open source. See the repository for license details.

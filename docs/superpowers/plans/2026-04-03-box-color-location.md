# Box + Color Dot Location System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text library location field with a structured box-letter system (A–X), where each box is visually identified by 3 colored dots per `box-colors.md`.

**Architecture:** The box letter (A–X) is the only value stored in the database `location` column. The 3-dot color mapping is a static constant derived from `box-colors.md` — purely presentational, never stored. A shared `BoxDots` component renders the colored circles everywhere a box is displayed: form dropdown, media cards, detail modal, and search filters.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase Postgres

**Note:** This project has no test framework configured. TDD steps are omitted. Verify changes manually in the dev server.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/box-colors.ts` | Create | Static mapping of box letters to color names/hex codes |
| `src/components/box-dots.tsx` | Create | Reusable component: renders 3 colored dot circles for a box letter |
| `src/components/media-form.tsx` | Modify | Replace free-text location input with box-letter `<select>` showing dots |
| `src/components/detail-modal.tsx` | Modify | Show box letter + colored dots instead of plain text |
| `src/components/media-card.tsx` | Modify | Show box letter + dots on card |
| `src/components/search-filters.tsx` | Modify | Add box-letter filter dropdown with dots |
| `src/app/dashboard/page.tsx` | Modify | Wire `box` search param into Supabase query |
| `supabase/migrations/003_box_location.sql` | Create | Add CHECK constraint limiting `location` to A–X |
| `CLAUDE.md` | Modify | Update product description to reflect box system |

---

### Task 1: Box Color Data Constant

**Files:**
- Create: `src/lib/box-colors.ts`

- [ ] **Step 1: Create the box-colors data file**

```ts
export interface BoxColor {
  name: string;
  hex: string;
}

export interface BoxDefinition {
  letter: string;
  colors: [BoxColor, BoxColor, BoxColor];
}

const COLOR_MAP: Record<string, string> = {
  Red: "#FF0000",
  Orange: "#FF8000",
  Yellow: "#FFD700",
  Green: "#00A651",
  Blue: "#0000FF",
  Indigo: "#4B0082",
  Purple: "#800080",
  Pink: "#FF69B4",
};

function c(name: string): BoxColor {
  return { name, hex: COLOR_MAP[name] };
}

export const BOXES: BoxDefinition[] = [
  { letter: "A", colors: [c("Red"), c("Orange"), c("Yellow")] },
  { letter: "B", colors: [c("Green"), c("Blue"), c("Indigo")] },
  { letter: "C", colors: [c("Purple"), c("Pink"), c("Yellow")] },
  { letter: "D", colors: [c("Red"), c("Blue"), c("Orange")] },
  { letter: "E", colors: [c("Blue"), c("Green"), c("Yellow")] },
  { letter: "F", colors: [c("Indigo"), c("Purple"), c("Pink")] },
  { letter: "G", colors: [c("Orange"), c("Red"), c("Purple")] },
  { letter: "H", colors: [c("Yellow"), c("Green"), c("Blue")] },
  { letter: "I", colors: [c("Pink"), c("Red"), c("Indigo")] },
  { letter: "J", colors: [c("Green"), c("Orange"), c("Purple")] },
  { letter: "K", colors: [c("Blue"), c("Pink"), c("Red")] },
  { letter: "L", colors: [c("Indigo"), c("Yellow"), c("Green")] },
  { letter: "M", colors: [c("Purple"), c("Blue"), c("Orange")] },
  { letter: "N", colors: [c("Red"), c("Yellow"), c("Pink")] },
  { letter: "O", colors: [c("Orange"), c("Green"), c("Indigo")] },
  { letter: "P", colors: [c("Yellow"), c("Purple"), c("Red")] },
  { letter: "Q", colors: [c("Pink"), c("Blue"), c("Green")] },
  { letter: "R", colors: [c("Green"), c("Indigo"), c("Orange")] },
  { letter: "S", colors: [c("Blue"), c("Yellow"), c("Purple")] },
  { letter: "T", colors: [c("Indigo"), c("Red"), c("Pink")] },
  { letter: "U", colors: [c("Purple"), c("Green"), c("Yellow")] },
  { letter: "V", colors: [c("Red"), c("Pink"), c("Blue")] },
  { letter: "W", colors: [c("Orange"), c("Indigo"), c("Green")] },
  { letter: "X", colors: [c("Yellow"), c("Blue"), c("Red")] },
];

export const BOX_BY_LETTER: Record<string, BoxDefinition> = Object.fromEntries(
  BOXES.map((b) => [b.letter, b])
);

export const BOX_LETTERS = BOXES.map((b) => b.letter);
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `box-colors.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/box-colors.ts
git commit -m "feat: add box-color data constant (A-X with 3-dot color mapping)"
```

---

### Task 2: BoxDots Reusable Component

**Files:**
- Create: `src/components/box-dots.tsx`

- [ ] **Step 1: Create the BoxDots component**

This component renders a box letter with its 3 colored dot circles. It accepts a `letter` prop and an optional `size` for dot diameter.

```tsx
import { BOX_BY_LETTER } from "@/lib/box-colors";

interface BoxDotsProps {
  letter: string;
  size?: "sm" | "md";
}

export default function BoxDots({ letter, size = "md" }: BoxDotsProps) {
  const box = BOX_BY_LETTER[letter];
  if (!box) return null;

  const dotSize = size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-bold text-white">{letter}</span>
      {box.colors.map((c, i) => (
        <span
          key={i}
          className={`${dotSize} rounded-full inline-block border border-white/30`}
          style={{ backgroundColor: c.hex }}
          title={c.name}
        />
      ))}
    </span>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/box-dots.tsx
git commit -m "feat: add BoxDots component for rendering colored dot indicators"
```

---

### Task 3: Replace Location Input in Media Form

**Files:**
- Modify: `src/components/media-form.tsx:271-282` (the location input section)

- [ ] **Step 1: Add imports at top of media-form.tsx**

Add after the existing imports:

```tsx
import { BOXES } from "@/lib/box-colors";
import BoxDots from "@/components/box-dots";
```

- [ ] **Step 2: Replace the location input field**

Replace the existing location `<div className="mb-4">` block (lines 271–282) — the one with placeholder "e.g. Shelf B-4, Bin 12" — with a `<select>` dropdown:

```tsx
        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">
            Box Location
          </label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
          >
            <option value="">No box assigned</option>
            {BOXES.map((b) => (
              <option key={b.letter} value={b.letter}>
                Box {b.letter} — {b.colors.map((c) => c.name).join(", ")}
              </option>
            ))}
          </select>
          {location && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-white/60">Preview:</span>
              <BoxDots letter={location} />
            </div>
          )}
        </div>
```

- [ ] **Step 3: Verify it compiles and renders**

Run: `npm run dev`
Navigate to the dashboard, open the add form, and confirm the location field is now a dropdown showing boxes A–X with color names. Selecting a box should show the colored dots preview below.

- [ ] **Step 4: Commit**

```bash
git add src/components/media-form.tsx
git commit -m "feat: replace free-text location with box-letter dropdown"
```

---

### Task 4: Show Box Dots in Detail Modal

**Files:**
- Modify: `src/components/detail-modal.tsx:65-69`

- [ ] **Step 1: Add import at top of detail-modal.tsx**

```tsx
import BoxDots from "@/components/box-dots";
```

- [ ] **Step 2: Replace the location display block**

Replace the existing location block (lines 65–69):

```tsx
        {item.location && (
          <div className="bg-white/10 p-3 border-l-4 border-bc-gold rounded my-3 text-sm text-white/80">
            <strong>Location:</strong> {item.location}
          </div>
        )}
```

With:

```tsx
        {item.location && (
          <div className="bg-white/10 p-3 border-l-4 border-bc-gold rounded my-3 text-sm text-white/80 flex items-center gap-2">
            <strong>Box:</strong> <BoxDots letter={item.location} />
          </div>
        )}
```

- [ ] **Step 3: Verify in browser**

Open a media item detail modal that has a box assigned. Confirm the box letter and 3 colored dots render correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/detail-modal.tsx
git commit -m "feat: show box letter with colored dots in detail modal"
```

---

### Task 5: Show Box Dots on Media Cards

**Files:**
- Modify: `src/components/media-card.tsx:51-54`

- [ ] **Step 1: Add import at top of media-card.tsx**

```tsx
import BoxDots from "@/components/box-dots";
```

- [ ] **Step 2: Add box dots display after the artist line**

After line 51 (`<div className="text-white/70 text-sm mb-1">{item.artist}</div>`), add:

```tsx
        {item.location && (
          <div className="mb-1">
            <BoxDots letter={item.location} size="sm" />
          </div>
        )}
```

- [ ] **Step 3: Verify in browser**

Cards with a box assigned should show the letter + 3 small colored dots below the artist name.

- [ ] **Step 4: Commit**

```bash
git add src/components/media-card.tsx
git commit -m "feat: show box dots on media cards"
```

---

### Task 6: Add Box Filter to Search

**Files:**
- Modify: `src/components/search-filters.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add imports to search-filters.tsx**

```tsx
import { BOXES } from "@/lib/box-colors";
```

- [ ] **Step 2: Add box filter dropdown to the grid in search-filters.tsx**

Change the grid from `sm:grid-cols-3` to `sm:grid-cols-4`, then add a fourth `<select>` after the genre select:

```tsx
        <select
          defaultValue={searchParams.get("box") ?? ""}
          onChange={(e) => updateParam("box", e.target.value)}
          className="p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
        >
          <option value="">All Boxes</option>
          {BOXES.map((b) => (
            <option key={b.letter} value={b.letter}>
              Box {b.letter} — {b.colors.map((c) => c.name).join(", ")}
            </option>
          ))}
        </select>
```

- [ ] **Step 3: Wire the `box` filter in dashboard page.tsx**

In `src/app/dashboard/page.tsx`, update the `DashboardProps` interface:

```ts
interface DashboardProps {
  searchParams: Promise<{ q?: string; type?: string; genre?: string; box?: string }>;
}
```

In the `getMedia` function, add a filter after the existing `filters.q` block:

```ts
  if (filters.box) {
    query = query.eq("location", filters.box);
  }
```

- [ ] **Step 4: Verify in browser**

Search filters should now have a 4th dropdown for box. Selecting a box letter should filter the grid to only items in that box.

- [ ] **Step 5: Commit**

```bash
git add src/components/search-filters.tsx src/app/dashboard/page.tsx
git commit -m "feat: add box-letter filter to search"
```

---

### Task 7: Database Migration

**Files:**
- Create: `supabase/migrations/003_box_location.sql`

- [ ] **Step 1: Create the migration**

This adds a CHECK constraint to limit `location` to single uppercase letters A–X (or NULL). Existing free-text values that don't match will need to be cleared first.

```sql
-- Clear any existing free-text location values that aren't valid box letters
UPDATE public.media
SET location = NULL
WHERE location IS NOT NULL
  AND location !~ '^[A-X]$';

-- Add check constraint for box letter values
ALTER TABLE public.media
ADD CONSTRAINT media_location_box_letter
CHECK (location IS NULL OR location ~ '^[A-X]$');

-- Index for filtering by box
CREATE INDEX idx_media_location ON public.media(location)
WHERE location IS NOT NULL;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/003_box_location.sql
git commit -m "feat: add DB constraint limiting location to box letters A-X"
```

**Important:** This migration must be run on Supabase before deploying the new UI. Run it via the Supabase SQL editor or `supabase db push`. Any existing free-text location data that doesn't match A–X will be set to NULL.

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the product overview and data model docs**

In the Product Overview section, replace the phrase `physical library locations (e.g. "Shelf B-4")` with `physical box locations (labeled A–X, each identified by 3 colored dots)`.

In the Data Models section, update the `media` table description — change `location` to: `location (box letter A–X, each box identified by 3 colored dots per box-colors.md)`.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect box location system"
```

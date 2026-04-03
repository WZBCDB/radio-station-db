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

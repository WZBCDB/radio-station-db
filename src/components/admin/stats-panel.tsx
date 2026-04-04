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

import { createClient } from "@/lib/supabase/server";

interface Stats {
  total: number;
  vinyl: number;
  fortyfive: number;
  cd: number;
}

async function getStats(): Promise<Stats> {
  const supabase = await createClient();

  const { count: total, error: totalErr } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true });
  if (totalErr) console.error("Error fetching total count:", totalErr);

  const { count: vinyl, error: vinylErr } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("media_type", "vinyl");
  if (vinylErr) console.error("Error fetching vinyl count:", vinylErr);

  const { count: fortyfive, error: fortyFiveErr } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("media_type", "45");
  if (fortyFiveErr) console.error("Error fetching 45 count:", fortyFiveErr);

  const { count: cd, error: cdErr } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("media_type", "cd");
  if (cdErr) console.error("Error fetching CD count:", cdErr);

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

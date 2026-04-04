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

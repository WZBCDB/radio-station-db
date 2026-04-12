"use client";

import { useState } from "react";
import type { Media, Role, Box } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import MediaCard from "@/components/media-card";
import DetailModal from "@/components/detail-modal";

interface MediaGridProps {
  media: Media[];
  role: Role;
  onEdit: (item: Media) => void;
  boxes: Box[];
}

export default function MediaGrid({ media, role, onEdit, boxes }: MediaGridProps) {
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
      const { error: storageErr } = await supabase.storage.from("media-photos").remove(paths);
      if (storageErr) console.error("Error removing storage photos:", storageErr);
    }

    // Delete associated photo records
    const { error: photosErr } = await supabase.from("media_photos").delete().eq("media_id", id);
    if (photosErr) console.error("Error deleting photo records:", photosErr);

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
      <div className="text-center py-14 text-white/50">
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
            boxes={boxes}
          />
        ))}
      </div>
      {viewing && (
        <DetailModal item={viewing} onClose={() => setViewing(null)} boxes={boxes} />
      )}
    </>
  );
}

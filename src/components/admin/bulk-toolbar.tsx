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

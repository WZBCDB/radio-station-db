"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Condition, Box } from "@/lib/types";
import { boxToColors } from "@/lib/box-colors";

type EditField = "location" | "condition" | "add_genre" | "remove_genre";

interface BulkEditModalProps {
  selectedIds: string[];
  onClose: () => void;
  boxes: Box[];
}

export default function BulkEditModal({ selectedIds, onClose, boxes }: BulkEditModalProps) {
  const [field, setField] = useState<EditField>("location");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleApply() {
    if (!value.trim() && field !== "location") return;
    setSaving(true);

    const batchSize = 50;

    for (let i = 0; i < selectedIds.length; i += batchSize) {
      const batch = selectedIds.slice(i, i + batchSize);

      if (field === "location") {
        await supabase
          .from("media")
          .update({ location: value || null })
          .in("id", batch);
      } else if (field === "condition") {
        await supabase
          .from("media")
          .update({ condition: value || null })
          .in("id", batch);
      } else if (field === "add_genre") {
        // Fetch current genres, append, update
        const { data: items } = await supabase
          .from("media")
          .select("id, genres")
          .in("id", batch);
        for (const item of items ?? []) {
          const genres: string[] = item.genres ?? [];
          if (!genres.includes(value.trim())) {
            await supabase
              .from("media")
              .update({ genres: [...genres, value.trim()] })
              .eq("id", item.id);
          }
        }
      } else if (field === "remove_genre") {
        const { data: items } = await supabase
          .from("media")
          .select("id, genres")
          .in("id", batch);
        for (const item of items ?? []) {
          const genres: string[] = (item.genres ?? []).filter(
            (g: string) => g.toLowerCase() !== value.trim().toLowerCase()
          );
          await supabase
            .from("media")
            .update({ genres })
            .eq("id", item.id);
        }
      }
    }

    setSaving(false);
    router.refresh();
    onClose();
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="glass-bright p-7 rounded-xl w-full max-w-md">
        <h3 className="text-white text-lg font-bold mb-4">Bulk Edit {selectedIds.length} Items</h3>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">Field</label>
          <select
            value={field}
            onChange={(e) => {
              setField(e.target.value as EditField);
              setValue("");
            }}
            className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
          >
            <option value="location">Box Location</option>
            <option value="condition">Condition</option>
            <option value="add_genre">Add Genre</option>
            <option value="remove_genre">Remove Genre</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">New Value</label>
          {field === "location" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
            >
              <option value="">No box assigned</option>
              {boxes.map((b) => {
                const colors = boxToColors(b);
                return (
                  <option key={b.name} value={b.name}>
                    Box {b.name} — {colors.map((c) => c.name).join(", ")}
                  </option>
                );
              })}
            </select>
          ) : field === "condition" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
            >
              <option value="">No condition</option>
              <option value="mint">Mint (Sealed)</option>
              <option value="near-mint">Near Mint</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={field === "add_genre" ? "Genre to add..." : "Genre to remove..."}
              className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
            />
          )}
        </div>

        <p className="text-white/60 text-sm mb-4">
          This will update <strong>{field.replace("_", " ")}</strong> to{" "}
          <strong>{value || "(empty)"}</strong> on {selectedIds.length} items.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/15 text-white/80 rounded-md font-semibold text-sm hover:bg-white/25 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={saving}
            className="flex-1 py-2.5 bg-bc-gold text-white rounded-md font-bold text-sm hover:bg-bc-gold-light transition disabled:opacity-50"
          >
            {saving ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

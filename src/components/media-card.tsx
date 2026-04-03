"use client";

import type { Media } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  vinyl: "Vinyl",
  "45": "45 RPM",
  cd: "CD",
};

interface MediaCardProps {
  item: Media;
  isAdmin: boolean;
  onView: (item: Media) => void;
  onEdit: (item: Media) => void;
  onDelete: (id: string) => void;
}

export default function MediaCard({
  item,
  isAdmin,
  onView,
  onEdit,
  onDelete,
}: MediaCardProps) {
  const cover = item.photos?.find((p) => p.photo_type === "cover");

  return (
    <div
      onClick={() => onView(item)}
      className="glass rounded-xl overflow-hidden hover:-translate-y-1 hover:shadow-xl transition cursor-pointer"
    >
      {cover ? (
        <img
          src={cover.url}
          alt={item.title}
          className="w-full h-56 object-cover"
        />
      ) : (
        <div className="w-full h-56 bg-gradient-to-br from-bc-maroon to-bc-maroon-dark flex items-center justify-center text-5xl">
          🎵
        </div>
      )}
      <div className="p-4">
        <span className="inline-block bg-bc-gold text-white px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide mb-2">
          {TYPE_LABELS[item.media_type] ?? item.media_type}
        </span>
        <div className="font-bold text-white leading-tight mb-1">
          {item.title}
        </div>
        <div className="text-white/70 text-sm mb-1">{item.artist}</div>
        {item.label && (
          <div className="text-white/50 text-xs mb-2">{item.label}</div>
        )}
        {item.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.genres.map((g) => (
              <span
                key={g}
                className="bg-white/15 text-bc-gold-light px-2 py-0.5 rounded-full text-xs font-semibold"
              >
                {g}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            className="flex-1 py-2 text-xs bg-bc-maroon text-white rounded font-semibold hover:bg-bc-maroon-dark transition"
          >
            Edit
          </button>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="flex-1 py-2 text-xs bg-red-500 text-white rounded font-semibold hover:bg-red-600 transition"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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
      className="bg-white rounded-xl overflow-hidden shadow-md hover:-translate-y-1 hover:shadow-xl transition cursor-pointer"
    >
      {cover ? (
        <img
          src={cover.url}
          alt={item.title}
          className="w-full h-56 object-cover"
        />
      ) : (
        <div className="w-full h-56 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-5xl">
          🎵
        </div>
      )}
      <div className="p-4">
        <span className="inline-block bg-purple-600 text-white px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide mb-2">
          {TYPE_LABELS[item.media_type] ?? item.media_type}
        </span>
        <div className="font-bold text-gray-800 leading-tight mb-1">
          {item.title}
        </div>
        <div className="text-gray-500 text-sm mb-1">{item.artist}</div>
        {item.label && (
          <div className="text-gray-400 text-xs mb-2">{item.label}</div>
        )}
        {item.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.genres.map((g) => (
              <span
                key={g}
                className="bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full text-xs font-semibold"
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
            className="flex-1 py-2 text-xs bg-indigo-500 text-white rounded font-semibold hover:bg-indigo-600 transition"
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

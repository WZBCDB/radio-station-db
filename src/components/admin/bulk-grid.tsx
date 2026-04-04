"use client";

import type { Media } from "@/lib/types";
import BoxDots from "@/components/box-dots";

const TYPE_LABELS: Record<string, string> = {
  vinyl: "Vinyl",
  "45": "45 RPM",
  cd: "CD",
};

interface BulkGridProps {
  media: Media[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export default function BulkGrid({ media, selected, onToggle }: BulkGridProps) {
  if (media.length === 0) {
    return (
      <div className="text-center py-14 text-white/50">
        No items match your filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {media.map((item) => {
        const isSelected = selected.has(item.id);
        const cover = item.photos?.find((p) => p.photo_type === "cover");

        return (
          <div
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`glass rounded-xl overflow-hidden cursor-pointer transition ${
              isSelected
                ? "ring-2 ring-bc-gold shadow-lg"
                : "hover:-translate-y-0.5"
            }`}
          >
            <div className="relative">
              {cover ? (
                <img
                  src={cover.url}
                  alt={item.title}
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-bc-maroon to-bc-maroon-dark flex items-center justify-center text-4xl">
                  🎵
                </div>
              )}
              <div
                className={`absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center transition ${
                  isSelected
                    ? "bg-bc-gold border-bc-gold text-white"
                    : "bg-black/30 border-white/50"
                }`}
              >
                {isSelected && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div className="p-3">
              <span className="inline-block bg-bc-gold text-white px-2 py-0.5 rounded-full text-xs font-bold uppercase mb-1">
                {TYPE_LABELS[item.media_type] ?? item.media_type}
              </span>
              <div className="font-bold text-white text-sm leading-tight">{item.title}</div>
              <div className="text-white/70 text-xs">{item.artist}</div>
              {item.location && (
                <div className="mt-1">
                  <BoxDots letter={item.location} size="sm" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

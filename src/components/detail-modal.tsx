"use client";

import type { Media } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  vinyl: "Vinyl Record",
  "45": "45 RPM",
  cd: "CD",
};

interface DetailModalProps {
  item: Media;
  onClose: () => void;
}

export default function DetailModal({ item, onClose }: DetailModalProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white p-7 rounded-xl max-w-2xl w-full max-h-[82vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex justify-between items-center mb-5">
          <span className="text-xl font-bold text-gray-800">Item Details</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="mb-2 text-sm">
          <strong>Type:</strong> {TYPE_LABELS[item.media_type] ?? item.media_type}
        </p>
        <p className="mb-2 text-sm">
          <strong>Title:</strong> {item.title}
        </p>
        <p className="mb-2 text-sm">
          <strong>Artist:</strong> {item.artist}
        </p>
        {item.label && (
          <p className="mb-2 text-sm">
            <strong>Label:</strong> {item.label}
          </p>
        )}
        {item.year && (
          <p className="mb-2 text-sm">
            <strong>Year:</strong> {item.year}
          </p>
        )}
        {item.condition && (
          <p className="mb-2 text-sm">
            <strong>Condition:</strong> {item.condition}
          </p>
        )}
        {item.genres.length > 0 && (
          <p className="mb-2 text-sm">
            <strong>Genres:</strong> {item.genres.join(", ")}
          </p>
        )}
        {item.location && (
          <div className="bg-gray-100 p-3 border-l-4 border-indigo-500 rounded my-3 text-sm">
            <strong>Location:</strong> {item.location}
          </div>
        )}
        {item.notes && (
          <p className="mb-2 text-sm">
            <strong>Notes:</strong> {item.notes}
          </p>
        )}

        {item.photos?.length > 0 && (
          <>
            <h3 className="text-base font-bold text-gray-700 mt-5 mb-3">
              Photos
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {item.photos.map((p) => (
                <div key={p.id} className="relative rounded-lg overflow-hidden">
                  <img
                    src={p.url}
                    alt={p.photo_type}
                    className="w-full h-36 object-cover"
                  />
                  <div className="absolute bottom-0 w-full bg-black/70 text-white text-center text-xs py-1 uppercase font-semibold">
                    {p.photo_type}
                    {p.description ? ` — ${p.description}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-gray-400 text-xs mt-5 pt-3 border-t border-gray-200">
          Added {new Date(item.date_added).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

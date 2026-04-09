"use client";

import { useState } from "react";
import type { PhotoType } from "@/lib/types";

export interface PendingPhoto {
  file: File;
  type: PhotoType;
  description: string;
  preview: string;
}

interface PhotoUploadProps {
  photos: PendingPhoto[];
  onChange: (photos: PendingPhoto[]) => void;
}

export default function PhotoUpload({ photos, onChange }: PhotoUploadProps) {
  const [slots, setSlots] = useState<
    { type: PhotoType; description: string }[]
  >([{ type: "cover", description: "" }]);

  function addSlot() {
    setSlots([...slots, { type: "cover", description: "" }]);
  }

  function removeSlot(index: number) {
    setSlots(slots.filter((_, i) => i !== index));
  }

  function handleFile(slotIndex: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    const slot = slots[slotIndex];
    const newPhotos = [...photos];
    Array.from(files).forEach((file) => {
      const preview = URL.createObjectURL(file);
      newPhotos.push({
        file,
        type: slot.type,
        description: slot.description,
        preview,
      });
    });
    onChange(newPhotos);
  }

  function removePhoto(index: number) {
    const updated = [...photos];
    URL.revokeObjectURL(updated[index].preview);
    updated.splice(index, 1);
    onChange(updated);
  }

  return (
    <div className="border-2 border-dashed border-bc-gold/50 rounded-lg p-4 my-4 bg-white/5">
      <h4 className="font-semibold text-sm text-white/80 mb-1">Photos</h4>
      <p className="text-xs text-white/50 mb-3">
        Upload cover art, condition photos, and library tag images.
      </p>

      {slots.map((slot, idx) => (
        <div
          key={idx}
          className="mb-4 pb-4 border-b border-gray-200 last:border-b-0 last:mb-0 last:pb-0"
        >
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select
              value={slot.type}
              onChange={(e) => {
                const updated = [...slots];
                updated[idx].type = e.target.value as PhotoType;
                setSlots(updated);
              }}
              className="p-2 bg-white/90 border border-white/30 rounded text-sm text-gray-900"
            >
              <option value="cover">Cover Art</option>
              <option value="condition">Condition</option>
              <option value="tag">Library Tag</option>
            </select>
            <input
              type="text"
              placeholder="Optional description"
              value={slot.description}
              onChange={(e) => {
                const updated = [...slots];
                updated[idx].description = e.target.value;
                setSlots(updated);
              }}
              className="p-2 bg-white/90 border border-white/30 rounded text-sm text-gray-900"
            />
          </div>
          <label className="block p-3 bg-white/10 border-2 border-dashed border-bc-gold/50 rounded-md text-center cursor-pointer text-sm text-bc-gold font-medium hover:bg-white/20 transition">
            Click to choose photo
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFile(idx, e.target.files)}
            />
          </label>
          {idx > 0 && (
            <button
              type="button"
              onClick={() => removeSlot(idx)}
              className="w-full mt-2 bg-white/10 text-white/60 py-1.5 rounded text-xs hover:bg-white/20"
            >
              Remove Slot
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addSlot}
        className="w-full mt-3 bg-white/10 text-white/70 py-2.5 rounded-md font-semibold text-sm hover:bg-white/20"
      >
        + Add Another Photo Slot
      </button>

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {photos.map((p, idx) => (
            <div key={idx} className="relative">
              <img
                src={p.preview}
                alt="preview"
                className="w-full h-[72px] object-cover rounded border-2 border-white/30"
              />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

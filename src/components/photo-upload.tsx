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
    <div className="border-2 border-dashed border-indigo-500 rounded-lg p-4 my-4 bg-indigo-50/30">
      <h4 className="font-semibold text-sm text-gray-700 mb-1">Photos</h4>
      <p className="text-xs text-gray-500 mb-3">
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
              className="p-2 border border-gray-300 rounded text-sm"
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
              className="p-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <label className="block p-3 bg-white border-2 border-dashed border-indigo-500 rounded-md text-center cursor-pointer text-sm text-indigo-500 font-medium hover:bg-indigo-50 transition">
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
              className="w-full mt-2 bg-gray-100 text-gray-600 py-1.5 rounded text-xs hover:bg-gray-200"
            >
              Remove Slot
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addSlot}
        className="w-full mt-3 bg-gray-100 text-gray-600 py-2.5 rounded-md font-semibold text-sm hover:bg-gray-200"
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
                className="w-full h-[72px] object-cover rounded border-2 border-gray-200"
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

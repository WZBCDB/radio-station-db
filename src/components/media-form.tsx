"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Media, MediaType, Condition } from "@/lib/types";
import PhotoUpload, { type PendingPhoto } from "@/components/photo-upload";
import { BOXES } from "@/lib/box-colors";
import BoxDots from "@/components/box-dots";
import GenreInput from "@/components/genre-input";
import GenreTag from "@/components/genre-tag";

interface MediaFormProps {
  editing: Media | null;
  onDone: () => void;
}

export default function MediaForm({ editing, onDone }: MediaFormProps) {
  const [mediaType, setMediaType] = useState<MediaType | "">("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [label, setLabel] = useState("");
  const [year, setYear] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState<Condition | "">("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Populate form when editing
  useEffect(() => {
    if (editing) {
      setMediaType(editing.media_type);
      setTitle(editing.title);
      setArtist(editing.artist);
      setLabel(editing.label ?? "");
      setYear(editing.year?.toString() ?? "");
      setGenres(editing.genres);
      setLocation(editing.location ?? "");
      setCondition(editing.condition ?? "");
      setNotes(editing.notes ?? "");
      setPhotos([]);
    }
  }, [editing]);

  function clearForm() {
    setMediaType("");
    setTitle("");
    setArtist("");
    setLabel("");
    setYear("");
    setGenres([]);
    setLocation("");
    setCondition("");
    setNotes("");
    setPhotos([]);
    onDone();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mediaType || !title.trim() || !artist.trim()) {
      alert("Please fill in Type, Title, and Artist.");
      return;
    }
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const mediaData = {
        media_type: mediaType,
        title: title.trim(),
        artist: artist.trim(),
        label: label.trim() || null,
        year: year ? parseInt(year) : null,
        genres,
        location: location.trim() || null,
        condition: condition || null,
        notes: notes.trim() || null,
        created_by: user.id,
      };

      let mediaId: string;

      if (editing) {
        // Don't overwrite created_by on edit
        const { created_by: _, ...updateData } = mediaData;
        const { error } = await supabase
          .from("media")
          .update(updateData)
          .eq("id", editing.id);
        if (error) throw error;
        mediaId = editing.id;
      } else {
        const { data, error } = await supabase
          .from("media")
          .insert(mediaData)
          .select("id")
          .single();
        if (error) throw error;
        mediaId = data.id;
      }

      // Upload new photos
      for (const photo of photos) {
        const ext = photo.file.name.split(".").pop() ?? "jpg";
        const path = `${mediaId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("media-photos")
          .upload(path, photo.file, {
            contentType: photo.file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error("Photo upload failed:", uploadError.message);
          continue;
        }

        const { error: insertError } = await supabase.from("media_photos").insert({
          media_id: mediaId,
          photo_type: photo.type,
          storage_path: path,
          description: photo.description,
        });
        if (insertError) {
          console.error("Failed to save photo record:", insertError.message);
        }
      }

      clearForm();
      router.refresh();
    } catch (err) {
      alert(
        "Save failed: " + (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h2 className="text-bc-gold text-xl font-bold mb-5">
        {editing ? "Edit Item" : "Add New Item"}
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">
            Media Type *
          </label>
          <select
            required
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as MediaType)}
            className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
          >
            <option value="">Select type...</option>
            <option value="vinyl">Vinyl Record</option>
            <option value="45">45 RPM Single</option>
            <option value="cd">CD</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">
            Title *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Album / single title"
            className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">
            Artist *
          </label>
          <input
            type="text"
            required
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist or band name"
            className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">
            Record Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Atlantic, Blue Note"
            className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">
            Release Year
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="e.g. 1975"
            min="1900"
            max="2099"
            className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">
            Genres{" "}
            <span className="font-normal text-xs">(type & press Enter, comma-separated ok)</span>
          </label>
          <GenreInput selected={genres} onChange={setGenres} />
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {genres.map((g) => (
                <GenreTag
                  key={g}
                  name={g}
                  removable
                  onRemove={() => setGenres(genres.filter((x) => x !== g))}
                  className="bg-bc-gold text-white"
                />
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">
            Box Location
          </label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
          >
            <option value="">No box assigned</option>
            {BOXES.map((b) => (
              <option key={b.letter} value={b.letter}>
                Box {b.letter} — {b.colors.map((c) => c.name).join(", ")}
              </option>
            ))}
          </select>
          {location && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-white/60">Preview:</span>
              <BoxDots letter={location} />
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">
            Condition
          </label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
            className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
          >
            <option value="">Select condition...</option>
            <option value="mint">Mint (Sealed)</option>
            <option value="near-mint">Near Mint</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-white/80">
            Notes / Comments
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Scratches? Missing sleeve? Any observations..."
            className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold min-h-[78px] resize-y"
          />
        </div>

        <PhotoUpload photos={photos} onChange={setPhotos} />

        <div className="grid grid-cols-2 gap-2.5 mt-6">
          <button
            type="button"
            onClick={clearForm}
            className="bg-white/15 text-white/80 py-3 rounded-md font-semibold text-sm hover:bg-white/25 transition"
          >
            Clear Form
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-bc-gold text-white py-3 rounded-md font-bold text-sm hover:bg-bc-gold-light transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Item"}
          </button>
        </div>
      </form>
    </>
  );
}

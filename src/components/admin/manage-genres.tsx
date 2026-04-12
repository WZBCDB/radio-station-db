"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Genre } from "@/lib/types";

interface ManageGenresProps {
  onClose: () => void;
}

export default function ManageGenres({ onClose }: ManageGenresProps) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadGenres();
  }, []);

  async function loadGenres() {
    const { data } = await supabase
      .from("genres")
      .select("*")
      .order("name");
    setGenres(data ?? []);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("genres").insert({
      name: newName.trim(),
      description: newDesc.trim(),
    });
    if (error) {
      alert(error.message.includes("unique")
        ? "That genre already exists."
        : error.message);
    } else {
      setNewName("");
      setNewDesc("");
      await loadGenres();
    }
    setSaving(false);
  }

  async function handleSaveEdit(id: string, oldName: string) {
    const trimmedName = editName.trim();
    const trimmedDesc = editDesc.trim();
    if (!trimmedName) return;
    setSaving(true);

    try {
      // Update the genre record — .select().single() confirms it actually persisted
      const { data: updated, error } = await supabase
        .from("genres")
        .update({ name: trimmedName, description: trimmedDesc })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        alert(error.message.includes("unique")
          ? "A genre with that name already exists."
          : "Save failed: " + error.message);
        return;
      }

      if (!updated) {
        alert("Save failed — you may not have permission to edit genres.");
        return;
      }

      // If the name changed, update all media records that reference the old name
      if (trimmedName !== oldName) {
        const { data: affected } = await supabase
          .from("media")
          .select("id, genres")
          .contains("genres", [oldName]);

        if (affected?.length) {
          for (const row of affected) {
            const updatedGenres = row.genres.map((g: string) =>
              g === oldName ? trimmedName : g
            );
            await supabase
              .from("media")
              .update({ genres: updatedGenres })
              .eq("id", row.id);
          }
        }
      }

      setEditingId(null);
      await loadGenres();
    } catch (err) {
      alert("Save failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this genre? It won't remove it from existing media.")) return;
    await supabase.from("genres").delete().eq("id", id);
    await loadGenres();
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="glass-bright p-7 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-white text-lg font-bold">Manage Genres</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Add new genre */}
        <div className="glass rounded-lg p-4 mb-5">
          <h4 className="text-white/80 text-sm font-semibold mb-3">Add New Genre</h4>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Genre name"
              className="flex-1 p-2 bg-white/90 border border-white/30 rounded text-sm text-gray-900"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !newName.trim()}
              className="px-4 py-2 bg-bc-gold text-white rounded text-sm font-bold hover:bg-bc-gold-light transition disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (what is this genre?)"
            className="w-full p-2 bg-white/90 border border-white/30 rounded text-sm text-gray-900"
          />
        </div>

        {/* Genre list */}
        <div className="space-y-2">
          {genres.map((g) => (
            <div key={g.id} className="glass rounded-lg p-3 flex items-start gap-3">
              <div className="flex-1">
                <div className="text-white font-semibold text-sm">{g.name}</div>
                {editingId === g.id ? (
                  <div className="mt-1 space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Genre name"
                        className="flex-1 p-1.5 bg-white/90 border border-white/30 rounded text-xs text-gray-900 font-semibold"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description (optional)"
                        className="flex-1 p-1.5 bg-white/90 border border-white/30 rounded text-xs text-gray-900"
                      />
                      <button
                        onClick={() => handleSaveEdit(g.id, g.name)}
                        disabled={saving || !editName.trim()}
                        className="px-3 py-1 bg-bc-gold text-white rounded text-xs font-bold disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 bg-white/15 text-white/80 rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-white/50 text-xs mt-0.5">
                    {g.description || "No description"}
                    <button
                      onClick={() => {
                        setEditingId(g.id);
                        setEditName(g.name);
                        setEditDesc(g.description);
                      }}
                      className="ml-2 text-bc-gold hover:text-bc-gold-light underline"
                    >
                      edit
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDelete(g.id)}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                Delete
              </button>
            </div>
          ))}
          {genres.length === 0 && (
            <p className="text-white/40 text-sm text-center py-4">No genres yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

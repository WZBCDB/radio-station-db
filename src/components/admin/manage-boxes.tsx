"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Box } from "@/lib/types";
import BoxDots from "@/components/box-dots";
import { boxToColors } from "@/lib/box-colors";

const PALETTE = [
  { name: "Red", hex: "#FF0000" },
  { name: "Orange", hex: "#FF8000" },
  { name: "Yellow", hex: "#FFD700" },
  { name: "Green", hex: "#00A651" },
  { name: "Blue", hex: "#0000FF" },
  { name: "Indigo", hex: "#4B0082" },
  { name: "Purple", hex: "#800080" },
  { name: "Pink", hex: "#FF69B4" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#000000" },
  { name: "Brown", hex: "#8B4513" },
  { name: "Gray", hex: "#808080" },
];

interface ManageBoxesProps {
  onClose: () => void;
}

export default function ManageBoxes({ onClose }: ManageBoxesProps) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [newName, setNewName] = useState("");
  const [newColors, setNewColors] = useState<[number, number, number]>([0, 1, 2]);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadBoxes();
  }, []);

  async function loadBoxes() {
    const { data } = await supabase
      .from("boxes")
      .select("*")
      .order("sort_order");
    setBoxes(data ?? []);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    const c = newColors.map((i) => PALETTE[i]);
    const nextOrder = boxes.length > 0 ? Math.max(...boxes.map((b) => b.sort_order)) + 1 : 1;
    const { error } = await supabase.from("boxes").insert({
      name: newName.trim().toUpperCase(),
      color1_name: c[0].name,
      color1_hex: c[0].hex,
      color2_name: c[1].name,
      color2_hex: c[1].hex,
      color3_name: c[2].name,
      color3_hex: c[2].hex,
      sort_order: nextOrder,
    });
    if (error) {
      alert(error.message.includes("unique")
        ? "A box with that name already exists."
        : error.message);
    } else {
      setNewName("");
      await loadBoxes();
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete box ${name}? Media in this box will keep the location value but it won't resolve to colors.`)) return;
    await supabase.from("boxes").delete().eq("id", id);
    await loadBoxes();
    router.refresh();
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="glass-bright p-7 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-white text-lg font-bold">Manage Boxes</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Add new box */}
        <div className="glass rounded-lg p-4 mb-5">
          <h4 className="text-white/80 text-sm font-semibold mb-3">Add New Box</h4>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Box name (e.g. Y, Z, AA)"
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
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((dotIdx) => (
              <div key={dotIdx}>
                <label className="block text-white/60 text-xs mb-1">
                  Dot {dotIdx + 1}
                </label>
                <select
                  value={newColors[dotIdx]}
                  onChange={(e) => {
                    const updated = [...newColors] as [number, number, number];
                    updated[dotIdx] = parseInt(e.target.value);
                    setNewColors(updated);
                  }}
                  className="w-full p-2 bg-white/90 border border-white/30 rounded text-sm text-gray-900"
                >
                  {PALETTE.map((c, i) => (
                    <option key={c.name} value={i}>{c.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {newName && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-white/60 text-xs">Preview:</span>
              <BoxDots
                letter={newName.trim().toUpperCase()}
                colors={newColors.map((i) => PALETTE[i])}
              />
            </div>
          )}
        </div>

        {/* Box list */}
        <div className="space-y-2">
          {boxes.map((b) => (
            <div key={b.id} className="glass rounded-lg p-3 flex items-center justify-between">
              <BoxDots letter={b.name} colors={boxToColors(b)} />
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-xs">
                  {boxToColors(b).map((c) => c.name).join(", ")}
                </span>
                <button
                  onClick={() => handleDelete(b.id, b.name)}
                  className="text-red-400 hover:text-red-300 text-xs ml-2"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

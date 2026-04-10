"use client";

import { useState } from "react";
import type { Media, Box } from "@/lib/types";
import BulkGrid from "@/components/admin/bulk-grid";
import BulkToolbar from "@/components/admin/bulk-toolbar";
import BulkEditModal from "@/components/admin/bulk-edit-modal";
import ImportModal from "@/components/admin/import-modal";
import ManageGenres from "@/components/admin/manage-genres";
import ManageBoxes from "@/components/admin/manage-boxes";

export default function BulkClient({ media, boxes }: { media: Media[]; boxes: Box[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showManageGenres, setShowManageGenres] = useState(false);
  const [showManageBoxes, setShowManageBoxes] = useState(false);

  function toggleItem(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(media.map((m) => m.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  return (
    <>
      <BulkToolbar
        media={media}
        selected={selected}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onOpenEdit={() => setShowEdit(true)}
        onOpenImport={() => setShowImport(true)}
      />

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowManageGenres(true)}
          className="px-3 py-1.5 bg-white/15 text-white/80 rounded text-xs font-semibold hover:bg-white/25 transition"
        >
          Manage Genres
        </button>
        <button
          onClick={() => setShowManageBoxes(true)}
          className="px-3 py-1.5 bg-white/15 text-white/80 rounded text-xs font-semibold hover:bg-white/25 transition"
        >
          Manage Boxes
        </button>
      </div>

      <BulkGrid
        media={media}
        selected={selected}
        onToggle={toggleItem}
      />

      {showEdit && (
        <BulkEditModal
          selectedIds={Array.from(selected)}
          onClose={() => {
            setShowEdit(false);
            deselectAll();
          }}
          boxes={boxes}
        />
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} boxes={boxes} />}

      {showManageGenres && (
        <ManageGenres onClose={() => setShowManageGenres(false)} />
      )}
      {showManageBoxes && (
        <ManageBoxes onClose={() => setShowManageBoxes(false)} />
      )}
    </>
  );
}

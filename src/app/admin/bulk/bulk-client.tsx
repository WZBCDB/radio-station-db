"use client";

import { useState } from "react";
import type { Media } from "@/lib/types";
import BulkGrid from "@/components/admin/bulk-grid";
import BulkToolbar from "@/components/admin/bulk-toolbar";
import BulkEditModal from "@/components/admin/bulk-edit-modal";
import ImportModal from "@/components/admin/import-modal";

export default function BulkClient({ media }: { media: Media[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);

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
        />
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </>
  );
}

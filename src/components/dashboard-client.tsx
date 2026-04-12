"use client";

import { useState } from "react";
import type { Media, Role, Box } from "@/lib/types";
import MediaGrid from "@/components/media-grid";
import MediaForm from "@/components/media-form";

interface DashboardClientProps {
  media: Media[];
  role: Role;
  boxes: Box[];
}

export default function DashboardClient({
  media,
  role,
  boxes,
}: DashboardClientProps) {
  const [editing, setEditing] = useState<Media | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-7">
      <div className="glass-bright rounded-xl p-7 h-fit lg:sticky lg:top-5 lg:max-h-[88vh] lg:overflow-y-auto">
        <MediaForm
          editing={editing}
          onDone={() => setEditing(null)}
          boxes={boxes}
        />
      </div>
      <MediaGrid media={media} role={role} onEdit={setEditing} boxes={boxes} />
    </div>
  );
}

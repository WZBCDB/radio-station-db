"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeGenre } from "@/lib/genre-aliases";

// Module-level cache — fetched once, shared across all GenreTag instances
let genreCache: Record<string, string> | null = null;
let fetchPromise: Promise<void> | null = null;

async function ensureCache(): Promise<void> {
  if (genreCache) return;
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    const { data } = await createClient()
      .from("genres")
      .select("name, description");
    genreCache = {};
    (data ?? []).forEach((g: { name: string; description: string }) => {
      if (g.description) genreCache![g.name] = g.description;
    });
  })();
  return fetchPromise;
}

interface GenreTagProps {
  name: string;
  description?: string;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

export default function GenreTag({
  name,
  description: descProp,
  removable,
  onRemove,
  className = "",
}: GenreTagProps) {
  const displayName = normalizeGenre(name);
  const [showTooltip, setShowTooltip] = useState(false);
  const [desc, setDesc] = useState(descProp ?? "");

  useEffect(() => {
    if (descProp) return;
    ensureCache().then(() => {
      // Check both original and normalized name for description lookup
      setDesc(genreCache?.[displayName] ?? genreCache?.[name] ?? "");
    });
  }, [name, displayName, descProp]);

  return (
    <span
      className={`relative inline-flex items-center gap-1 bg-white/15 text-bc-gold-light px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}
      onMouseEnter={() => desc && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {displayName}
      {desc && (
        <span className="text-white/40 text-[10px]">ⓘ</span>
      )}
      {removable && onRemove && (
        <span
          className="cursor-pointer font-bold opacity-80 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          &times;
        </span>
      )}
      {showTooltip && desc && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md shadow-lg z-50 max-w-[250px] whitespace-normal text-center">
          {desc}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

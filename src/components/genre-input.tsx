"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Genre } from "@/lib/types";

interface GenreInputProps {
  selected: string[];
  onChange: (genres: string[]) => void;
}

export default function GenreInput({ selected, onChange }: GenreInputProps) {
  const [input, setInput] = useState("");
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("genres")
      .select("*")
      .order("name")
      .then(({ data }) => setAllGenres(data ?? []));
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addGenre(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Title-case normalize
    const normalized =
      trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (!selected.includes(normalized)) {
      onChange([...selected, normalized]);

      // If this genre doesn't exist in the DB yet, insert it
      const exists = allGenres.some(
        (g) => g.name.toLowerCase() === normalized.toLowerCase()
      );
      if (!exists) {
        const supabase = createClient();
        supabase
          .from("genres")
          .insert({ name: normalized })
          .then(({ data }) => {
            if (data) setAllGenres((prev) => [...prev, ...(data as Genre[])]);
          });
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    // Support comma-separated: "Jazz, Soul, Funk"
    const parts = input.split(",");
    parts.forEach((part) => addGenre(part));
    setInput("");
    setShowSuggestions(false);
  }

  const suggestions = allGenres.filter(
    (g) =>
      g.name.toLowerCase().includes(input.toLowerCase()) &&
      !selected.includes(g.name)
  );

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setShowSuggestions(e.target.value.length > 0);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => input.length > 0 && setShowSuggestions(true)}
        placeholder="Type genre & press Enter (comma-separated ok)..."
        className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-gray-900 border border-white/20 rounded-md shadow-xl max-h-48 overflow-y-auto">
          {suggestions.slice(0, 15).map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                addGenre(g.name);
                setInput("");
                setShowSuggestions(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 flex items-center justify-between"
            >
              <span>{g.name}</span>
              {g.description && (
                <span className="text-white/40 text-xs truncate ml-2 max-w-[150px]">
                  {g.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

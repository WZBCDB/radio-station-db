"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import type { Box } from "@/lib/types";
import { boxToColors } from "@/lib/box-colors";
import BoxDots from "@/components/box-dots";

/* ------------------------------------------------------------------ */
/*  Reusable typeable combobox                                        */
/* ------------------------------------------------------------------ */

interface ComboboxProps {
  placeholder: string;
  paramKey: string;
  options: string[];
  value: string;
  onCommit: (key: string, value: string) => void;
  /** Render a custom option row (default: plain text) */
  renderOption?: (option: string) => React.ReactNode;
}

function Combobox({
  placeholder,
  paramKey,
  options,
  value,
  onCommit,
  renderOption,
}: ComboboxProps) {
  const [input, setInput] = useState(value);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync when URL param changes externally (e.g. back button)
  useEffect(() => setInput(value), [value]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(input.toLowerCase())
  );

  function commit(val: string) {
    setInput(val);
    setOpen(false);
    onCommit(paramKey, val);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // If typed value matches an option exactly, use it; otherwise commit raw
            const exact = options.find(
              (o) => o.toLowerCase() === input.toLowerCase()
            );
            commit(exact ?? input);
          }
          if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-bc-gold"
      />
      {/* Clear button */}
      {input && (
        <button
          type="button"
          onClick={() => commit("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          &times;
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-900 border border-white/20 rounded-md shadow-xl max-h-52 overflow-y-auto">
          {filtered.slice(0, 20).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => commit(o)}
              className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10"
            >
              {renderOption ? renderOption(o) : o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SearchFilters                                                      */
/* ------------------------------------------------------------------ */

const TYPE_OPTIONS = ["Vinyl", "45 RPM", "CD"];
const TYPE_TO_VALUE: Record<string, string> = {
  vinyl: "Vinyl",
  "45": "45 RPM",
  cd: "CD",
};
const VALUE_TO_TYPE: Record<string, string> = {
  Vinyl: "vinyl",
  "45 RPM": "45",
  CD: "cd",
};

const CONDITION_OPTIONS = [
  "Mint (Sealed)",
  "Near Mint",
  "Excellent",
  "Good",
  "Fair",
  "Poor",
];
const CONDITION_TO_VALUE: Record<string, string> = {
  mint: "Mint (Sealed)",
  "near-mint": "Near Mint",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};
const VALUE_TO_CONDITION: Record<string, string> = {
  "Mint (Sealed)": "mint",
  "Near Mint": "near-mint",
  Excellent: "excellent",
  Good: "good",
  Fair: "fair",
  Poor: "poor",
};

export default function SearchFilters({
  allGenres,
  boxes,
  allYears,
  allLabels,
}: {
  allGenres: string[];
  boxes: Box[];
  allYears: number[];
  allLabels: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/dashboard?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Build box display strings and a lookup map
  const boxOptions = boxes.map((b) => {
    const colors = boxToColors(b);
    return `Box ${b.name} — ${colors.map((c) => c.name).join(", ")}`;
  });
  const boxDisplayToName: Record<string, string> = {};
  const boxNameToDisplay: Record<string, string> = {};
  boxes.forEach((b, i) => {
    boxDisplayToName[boxOptions[i]] = b.name;
    boxNameToDisplay[b.name] = boxOptions[i];
  });

  function handleBoxCommit(_key: string, display: string) {
    updateParam("box", boxDisplayToName[display] ?? "");
  }

  function handleTypeCommit(_key: string, display: string) {
    updateParam("type", VALUE_TO_TYPE[display] ?? "");
  }

  function handleConditionCommit(_key: string, display: string) {
    updateParam("condition", VALUE_TO_CONDITION[display] ?? "");
  }

  const currentBox = searchParams.get("box") ?? "";
  const currentType = searchParams.get("type") ?? "";
  const currentCondition = searchParams.get("condition") ?? "";

  return (
    <div className="glass rounded-xl p-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Title / Artist search */}
        <Combobox
          placeholder="Search title or artist..."
          paramKey="q"
          options={[]}
          value={searchParams.get("q") ?? ""}
          onCommit={updateParam}
        />

        {/* Media type */}
        <Combobox
          placeholder="Media type..."
          paramKey="type"
          options={TYPE_OPTIONS}
          value={TYPE_TO_VALUE[currentType] ?? ""}
          onCommit={handleTypeCommit}
        />

        {/* Genre */}
        <Combobox
          placeholder="Genre..."
          paramKey="genre"
          options={allGenres}
          value={searchParams.get("genre") ?? ""}
          onCommit={updateParam}
        />

        {/* Year */}
        <Combobox
          placeholder="Year..."
          paramKey="year"
          options={allYears.map(String)}
          value={searchParams.get("year") ?? ""}
          onCommit={updateParam}
        />

        {/* Box */}
        <Combobox
          placeholder="Box location..."
          paramKey="box"
          options={boxOptions}
          value={boxNameToDisplay[currentBox] ?? ""}
          onCommit={handleBoxCommit}
          renderOption={(o) => {
            const name = boxDisplayToName[o];
            const box = boxes.find((b) => b.name === name);
            if (!box) return o;
            const colors = boxToColors(box).map((c) => ({
              name: c.name,
              hex: c.hex,
            }));
            return (
              <span className="flex items-center gap-2">
                <BoxDots letter={name} size="sm" colors={colors} />
                <span className="text-white/50 text-xs">
                  {colors.map((c) => c.name).join(", ")}
                </span>
              </span>
            );
          }}
        />

        {/* Condition */}
        <Combobox
          placeholder="Condition..."
          paramKey="condition"
          options={CONDITION_OPTIONS}
          value={CONDITION_TO_VALUE[currentCondition] ?? ""}
          onCommit={handleConditionCommit}
        />

        {/* Label */}
        <Combobox
          placeholder="Record label..."
          paramKey="label"
          options={allLabels}
          value={searchParams.get("label") ?? ""}
          onCommit={updateParam}
        />
      </div>
    </div>
  );
}

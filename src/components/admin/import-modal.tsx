"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { boxToColors } from "@/lib/box-colors";
import type { Box } from "@/lib/types";
import BoxDots from "@/components/box-dots";

const TARGET_FIELDS = [
  "media_type",
  "title",
  "artist",
  "label",
  "year",
  "genres",
  "condition",
  "notes",
] as const;

type TargetField = (typeof TARGET_FIELDS)[number];

const REQUIRED_FIELDS: TargetField[] = ["media_type", "title", "artist"];

const VALID_MEDIA_TYPES = ["vinyl", "45", "cd"];
const VALID_CONDITIONS = ["mint", "near-mint", "excellent", "good", "fair", "poor"];

// Normalize free-text condition values to our enum
const CONDITION_ALIASES: Record<string, string> = {
  "near mint": "near-mint",
  "nearmint": "near-mint",
  "nm": "near-mint",
  "very good": "good",
  "vg": "good",
  "vg+": "good",
  "fair": "fair",
  "poor": "poor",
  "mint": "mint",
  "excellent": "excellent",
  "good": "good",
};

// Map common CSV column names to our target fields
const COLUMN_ALIASES: Record<string, TargetField> = {
  "artist": "artist",
  "album": "title",
  "title": "title",
  "name": "title",
  "genre": "genres",
  "genres": "genres",
  "genretags": "genres",
  "genre tags": "genres",
  "comments": "notes",
  "notes": "notes",
  "comment": "notes",
  "recordcondition": "condition",
  "record condition": "condition",
  "condition": "condition",
  "year": "year",
  "yearreleased": "year",
  "year released": "year",
  "label": "label",
  "mediatype": "media_type",
  "media type": "media_type",
  "type": "media_type",
};

interface ImportModalProps {
  onClose: () => void;
  boxes: Box[];
}

type ColumnMapping = Record<string, TargetField | "">;

export default function ImportModal({ onClose, boxes }: ImportModalProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaultMediaType, setDefaultMediaType] = useState<string>("vinyl");
  const [boxLetter, setBoxLetter] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (json.length === 0) return;

      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);

      // Filter out empty rows (where the first two meaningful columns are blank)
      const filtered = json.filter((row) => {
        const vals = Object.values(row).map((v) => v?.toString().trim() ?? "");
        // Keep row if at least 2 non-empty values exist
        return vals.filter(Boolean).length >= 2;
      });
      setRows(filtered);

      // Auto-map columns by name using aliases
      const autoMap: ColumnMapping = {};
      hdrs.forEach((h) => {
        const lower = h.toLowerCase().trim();
        const normalized = lower.replace(/[^a-z]/g, "");
        // Check aliases first (handles "Album", "Genre Tags", "Comments", "Record condition", etc.)
        const alias = COLUMN_ALIASES[lower] ?? COLUMN_ALIASES[normalized];
        if (alias) {
          autoMap[h] = alias;
        } else {
          // Fallback: check if normalized name contains a target field
          const match = TARGET_FIELDS.find(
            (f) => f.replace("_", "") === normalized || normalized.includes(f.replace("_", ""))
          );
          autoMap[h] = match ?? "";
        }
      });
      setMapping(autoMap);
    };
    reader.readAsArrayBuffer(file);
  }

  function cleanValue(val: string): string {
    // Strip surrounding quotes (the WZBC CSV has literal "example" values)
    return val.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "").trim();
  }

  function mapRow(row: Record<string, string>): Record<string, unknown> | null {
    const mapped: Record<string, unknown> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      const raw = row[header]?.toString().trim() ?? "";
      const val = cleanValue(raw);
      if (field === "year") {
        const num = parseInt(val);
        mapped.year = !isNaN(num) && num >= 1900 && num <= 2099 ? num : null;
      } else if (field === "genres") {
        mapped.genres = val
          ? val.split(/[,;]/).map((g) => cleanValue(g)).filter(Boolean)
          : [];
      } else if (field === "media_type") {
        mapped.media_type = VALID_MEDIA_TYPES.includes(val.toLowerCase())
          ? val.toLowerCase()
          : val;
      } else if (field === "condition") {
        const lower = val.toLowerCase();
        // Check direct match first, then aliases
        if (VALID_CONDITIONS.includes(lower)) {
          mapped.condition = lower;
        } else {
          mapped.condition = CONDITION_ALIASES[lower] ?? null;
        }
      } else {
        mapped[field] = val || null;
      }
    }

    // Apply default media type if not mapped or empty
    if (!mapped.media_type && defaultMediaType) {
      mapped.media_type = defaultMediaType;
    }

    return mapped;
  }

  function isValid(mapped: Record<string, unknown>): boolean {
    if (!mapped.media_type || !VALID_MEDIA_TYPES.includes(mapped.media_type as string)) return false;
    if (!mapped.title || (mapped.title as string).trim() === "") return false;
    if (!mapped.artist || (mapped.artist as string).trim() === "") return false;
    return true;
  }

  async function handleImport() {
    setImporting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    let imported = 0;
    let skipped = 0;
    const batchSize = 50;
    const validRows: Record<string, unknown>[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const mapped = mapRow(rows[idx]);
      if (mapped && isValid(mapped)) {
        validRows.push({
          ...mapped,
          created_by: user.id,
          genres: mapped.genres ?? [],
          location: boxLetter || null,
          source_row: idx + 2, // +2: row 1 is header, data starts at row 2
        });
      } else {
        skipped++;
      }
    }

    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize);
      const { error } = await supabase.from("media").insert(batch);
      if (error) {
        console.error("Batch import error:", error);
        skipped += batch.length;
      } else {
        imported += batch.length;
      }
    }

    setResult({ imported, skipped });
    setImporting(false);
    router.refresh();
  }

  const previewRows = rows.slice(0, 10);
  const mappedPreview = previewRows.map(mapRow);
  const validCount = rows.filter((r) => {
    const m = mapRow(r);
    return m && isValid(m);
  }).length;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-bright p-7 rounded-xl w-full max-w-4xl max-h-[85vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-white text-lg font-bold">Import Media</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">
            &times;
          </button>
        </div>

        {result ? (
          <div className="text-center py-8">
            <p className="text-white text-lg font-bold mb-2">Import Complete</p>
            <p className="text-white/80">
              {result.imported} imported, {result.skipped} skipped
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 bg-bc-gold text-white rounded-md font-bold text-sm hover:bg-bc-gold-light transition"
            >
              Done
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div>
            <p className="text-white/60 text-sm mb-4">
              Each spreadsheet is one box. Pick the box first, then upload the file.
            </p>

            {/* Box selector */}
            <div className="mb-5">
              <label className="block mb-1.5 text-sm font-semibold text-white/80">
                Which box is this sheet for?
              </label>
              <select
                value={boxLetter}
                onChange={(e) => setBoxLetter(e.target.value)}
                className="w-full p-2.5 bg-white/90 border-2 border-white/30 rounded-md text-sm text-gray-900 focus:outline-none focus:border-bc-gold"
              >
                <option value="">Select a box...</option>
                {boxes.map((b) => {
                  const colors = boxToColors(b);
                  return (
                    <option key={b.name} value={b.name}>
                      Box {b.name} — {colors.map((c) => c.name).join(", ")}
                    </option>
                  );
                })}
              </select>
              {boxLetter && (() => {
                const box = boxes.find((b) => b.name === boxLetter);
                return box ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-white/60">Preview:</span>
                    <BoxDots letter={boxLetter} colors={boxToColors(box).map(c => ({ name: c.name, hex: c.hex }))} />
                  </div>
                ) : null;
              })()}
            </div>

            {/* File upload — only enabled after box is selected */}
            {boxLetter ? (
              <label className="block p-8 bg-white/10 border-2 border-dashed border-bc-gold/50 rounded-md text-center cursor-pointer text-sm text-bc-gold font-medium hover:bg-white/20 transition">
                Click to upload spreadsheet for Box {boxLetter}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.ods"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
            ) : (
              <div className="p-8 bg-white/5 border-2 border-dashed border-white/20 rounded-md text-center text-sm text-white/30">
                Select a box above to enable file upload
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Selected box indicator */}
            <div className="glass rounded-lg p-3 mb-5 flex items-center gap-3">
              <span className="text-white/60 text-sm">Importing to:</span>
              <BoxDots letter={boxLetter} colors={(() => { const box = boxes.find((b) => b.name === boxLetter); return box ? boxToColors(box) : undefined; })()} />
              <span className="text-white/80 text-sm font-semibold">Box {boxLetter}</span>
              <span className="text-white/40 text-xs">({rows.length} rows loaded)</span>
            </div>

            {/* Column mapping */}
            <div className="mb-5">
              <h4 className="text-white/80 text-sm font-semibold mb-2">Column Mapping</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="text-white/60 text-xs truncate w-24">{h}</span>
                    <select
                      value={mapping[h] ?? ""}
                      onChange={(e) =>
                        setMapping({ ...mapping, [h]: e.target.value as TargetField | "" })
                      }
                      className="flex-1 p-1.5 bg-white/90 border border-white/30 rounded text-xs text-gray-900"
                    >
                      <option value="">— skip —</option>
                      {TARGET_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Default media type */}
            <div className="mb-5">
              <h4 className="text-white/80 text-sm font-semibold mb-2">Default Media Type</h4>
              <p className="text-white/50 text-xs mb-2">
                Applied to all rows without a media_type column mapped.
              </p>
              <select
                value={defaultMediaType}
                onChange={(e) => setDefaultMediaType(e.target.value)}
                className="p-2 bg-white/90 border border-white/30 rounded text-sm text-gray-900"
              >
                <option value="vinyl">Vinyl Record</option>
                <option value="45">45 RPM Single</option>
                <option value="cd">CD</option>
              </select>
            </div>

            {/* Preview table */}
            <div className="mb-4 overflow-x-auto">
              <h4 className="text-white/80 text-sm font-semibold mb-2">
                Preview (first {previewRows.length} of {rows.length} rows)
              </h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/20 text-white/60">
                    <th className="py-2 px-1 text-left">#</th>
                    {TARGET_FIELDS.filter((f) =>
                      Object.values(mapping).includes(f)
                    ).map((f) => (
                      <th key={f} className="py-2 px-1 text-left">{f}</th>
                    ))}
                    <th className="py-2 px-1 text-left">Valid?</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedPreview.map((m, i) => {
                    const valid = m && isValid(m);
                    return (
                      <tr
                        key={i}
                        className={`border-b border-white/10 ${
                          valid ? "text-white/80" : "text-red-300 bg-red-500/10"
                        }`}
                      >
                        <td className="py-1.5 px-1">{i + 1}</td>
                        {TARGET_FIELDS.filter((f) =>
                          Object.values(mapping).includes(f)
                        ).map((f) => (
                          <td key={f} className="py-1.5 px-1 max-w-[120px] truncate">
                            {m ? String(m[f] ?? "") : ""}
                          </td>
                        ))}
                        <td className="py-1.5 px-1">{valid ? "Yes" : "No"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-white/15 text-white/80 rounded-md font-semibold text-sm hover:bg-white/25 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="flex-1 py-2.5 bg-bc-gold text-white rounded-md font-bold text-sm hover:bg-bc-gold-light transition disabled:opacity-50"
              >
                {importing
                  ? "Importing..."
                  : `Import ${validCount} valid rows`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

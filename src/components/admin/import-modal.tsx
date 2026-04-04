"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

const TARGET_FIELDS = [
  "media_type",
  "title",
  "artist",
  "label",
  "year",
  "genres",
  "location",
  "condition",
  "notes",
] as const;

type TargetField = (typeof TARGET_FIELDS)[number];

const REQUIRED_FIELDS: TargetField[] = ["media_type", "title", "artist"];

const VALID_MEDIA_TYPES = ["vinyl", "45", "cd"];
const VALID_CONDITIONS = ["mint", "near-mint", "excellent", "good", "fair", "poor"];

interface ImportModalProps {
  onClose: () => void;
}

type ColumnMapping = Record<string, TargetField | "">;

export default function ImportModal({ onClose }: ImportModalProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
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
      setRows(json);

      // Auto-map columns by name
      const autoMap: ColumnMapping = {};
      hdrs.forEach((h) => {
        const lower = h.toLowerCase().replace(/[^a-z]/g, "");
        const match = TARGET_FIELDS.find(
          (f) => f.replace("_", "") === lower || f === lower || lower.includes(f.replace("_", ""))
        );
        autoMap[h] = match ?? "";
      });
      setMapping(autoMap);
    };
    reader.readAsArrayBuffer(file);
  }

  function mapRow(row: Record<string, string>): Record<string, unknown> | null {
    const mapped: Record<string, unknown> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      const val = row[header]?.toString().trim() ?? "";
      if (field === "year") {
        const num = parseInt(val);
        mapped.year = !isNaN(num) && num >= 1900 && num <= 2099 ? num : null;
      } else if (field === "genres") {
        mapped.genres = val
          ? val.split(/[,;]/).map((g) => g.trim()).filter(Boolean)
          : [];
      } else if (field === "media_type") {
        mapped.media_type = VALID_MEDIA_TYPES.includes(val.toLowerCase())
          ? val.toLowerCase()
          : val;
      } else if (field === "condition") {
        mapped.condition = VALID_CONDITIONS.includes(val.toLowerCase())
          ? val.toLowerCase()
          : null;
      } else {
        mapped[field] = val || null;
      }
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

    for (const row of rows) {
      const mapped = mapRow(row);
      if (mapped && isValid(mapped)) {
        validRows.push({
          ...mapped,
          created_by: user.id,
          genres: mapped.genres ?? [],
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
            <p className="text-white/60 text-sm mb-3">
              Upload a CSV, XLSX, XLS, or ODS file.
            </p>
            <label className="block p-8 bg-white/10 border-2 border-dashed border-bc-gold/50 rounded-md text-center cursor-pointer text-sm text-bc-gold font-medium hover:bg-white/20 transition">
              Click to choose file
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.ods"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
          </div>
        ) : (
          <>
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

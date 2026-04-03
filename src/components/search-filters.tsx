"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export default function SearchFilters({
  allGenres,
}: {
  allGenres: string[];
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

  return (
    <div className="bg-white rounded-xl p-4 mb-6 shadow-md">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="Search title or artist..."
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => updateParam("q", e.target.value)}
          className="p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
        />
        <select
          defaultValue={searchParams.get("type") ?? ""}
          onChange={(e) => updateParam("type", e.target.value)}
          className="p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Types</option>
          <option value="vinyl">Vinyl</option>
          <option value="45">45 RPM</option>
          <option value="cd">CD</option>
        </select>
        <select
          defaultValue={searchParams.get("genre") ?? ""}
          onChange={(e) => updateParam("genre", e.target.value)}
          className="p-2.5 border-2 border-gray-200 rounded-md text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Genres</option>
          {allGenres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

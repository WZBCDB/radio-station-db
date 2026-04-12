// Spreadsheet abbreviations → full genre names
// Keys are lowercase for case-insensitive matching
export const GENRE_ALIASES: Record<string, string> = {
  z: "Jazz",
  "4": "Country",
  "5": "Blues",
  "6": "Rock",
  x: "NCP",
  ez: "Easy Listening",
  u: "Hip Hop",
  m: "Metal",
  r: "Reggae",
  va: "Various Artists",
  el: "Electronic",
  p: "Pop",
  f: "Folk",
  i: "International",
};

/** Normalize a genre tag — expands abbreviations, title-cases otherwise */
export function normalizeGenre(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (GENRE_ALIASES[lower]) return GENRE_ALIASES[lower];
  // Title-case if not an alias
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

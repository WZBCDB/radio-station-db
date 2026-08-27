// Photos are hosted externally (e.g. Cloudflare R2) and referenced by filename only.
const PHOTO_BASE_URL = process.env.NEXT_PUBLIC_PHOTO_BASE_URL ?? "";

export function getPhotoUrl(filename: string | null | undefined): string | null {
  if (!filename || !PHOTO_BASE_URL) return null;
  return `${PHOTO_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(filename)}`;
}

// Source spreadsheets aren't consistent about .jpg vs .jpeg for the same photo;
// swap the extension so callers can retry the alternate spelling on load failure.
export function swapJpgJpeg(url: string): string | null {
  if (/\.jpeg$/i.test(url)) return url.replace(/\.jpeg$/i, ".jpg");
  if (/\.jpg$/i.test(url)) return url.replace(/\.jpg$/i, ".jpeg");
  return null;
}

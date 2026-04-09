export type MediaType = "vinyl" | "45" | "cd";

export type Condition =
  | "mint"
  | "near-mint"
  | "excellent"
  | "good"
  | "fair"
  | "poor";

export type PhotoType = "cover" | "condition" | "tag";

export type Role = "admin" | "member";

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  created_at: string;
}

export interface MediaPhoto {
  id: string;
  media_id: string;
  photo_type: PhotoType;
  storage_path: string;
  url: string;
  description: string;
  uploaded_at: string;
}

export interface Media {
  id: string;
  created_by: string;
  media_type: MediaType;
  title: string;
  artist: string;
  label: string | null;
  year: number | null;
  genres: string[];
  location: string | null;
  condition: Condition | null;
  notes: string | null;
  date_added: string;
  photos: MediaPhoto[];
  profile?: Pick<Profile, "display_name">;
}

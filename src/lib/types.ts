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

export interface Genre {
  id: string;
  name: string;
  description: string;
  parent_id: string | null;
  created_at: string;
}

export interface Box {
  id: string;
  name: string;
  color1_name: string;
  color1_hex: string;
  color2_name: string;
  color2_hex: string;
  color3_name: string;
  color3_hex: string;
  sort_order: number;
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
  source_row: number | null;
  photos: MediaPhoto[];
  profile?: Pick<Profile, "display_name">;
}

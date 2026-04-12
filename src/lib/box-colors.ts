import { createClient } from "@/lib/supabase/client";
import type { Box } from "@/lib/types";

export interface BoxColor {
  name: string;
  hex: string;
}

export interface BoxDefinition {
  letter: string;
  colors: [BoxColor, BoxColor, BoxColor];
}

const COLOR_MAP: Record<string, string> = {
  Red: "#FF0000",
  Orange: "#FF8000",
  Yellow: "#FFD700",
  Green: "#00A651",
  Blue: "#0000FF",
  Indigo: "#4B0082",
  Purple: "#800080",
  Pink: "#FF69B4",
};

function c(name: string): BoxColor {
  return { name, hex: COLOR_MAP[name] };
}

export const BOXES: BoxDefinition[] = [
  { letter: "A", colors: [c("Red"), c("Orange"), c("Yellow")] },
  { letter: "B", colors: [c("Green"), c("Blue"), c("Indigo")] },
  { letter: "C", colors: [c("Purple"), c("Pink"), c("Yellow")] },
  { letter: "D", colors: [c("Red"), c("Blue"), c("Orange")] },
  { letter: "E", colors: [c("Blue"), c("Green"), c("Yellow")] },
  { letter: "F", colors: [c("Indigo"), c("Purple"), c("Pink")] },
  { letter: "G", colors: [c("Orange"), c("Red"), c("Purple")] },
  { letter: "H", colors: [c("Yellow"), c("Green"), c("Blue")] },
  { letter: "I", colors: [c("Pink"), c("Red"), c("Indigo")] },
  { letter: "J", colors: [c("Green"), c("Orange"), c("Purple")] },
  { letter: "K", colors: [c("Blue"), c("Pink"), c("Red")] },
  { letter: "L", colors: [c("Indigo"), c("Yellow"), c("Green")] },
  { letter: "M", colors: [c("Purple"), c("Blue"), c("Orange")] },
  { letter: "N", colors: [c("Red"), c("Yellow"), c("Pink")] },
  { letter: "O", colors: [c("Orange"), c("Green"), c("Indigo")] },
  { letter: "P", colors: [c("Yellow"), c("Purple"), c("Red")] },
  { letter: "Q", colors: [c("Pink"), c("Blue"), c("Green")] },
  { letter: "R", colors: [c("Green"), c("Indigo"), c("Orange")] },
  { letter: "S", colors: [c("Blue"), c("Yellow"), c("Purple")] },
  { letter: "T", colors: [c("Indigo"), c("Red"), c("Pink")] },
  { letter: "U", colors: [c("Purple"), c("Green"), c("Yellow")] },
  { letter: "V", colors: [c("Red"), c("Pink"), c("Blue")] },
  { letter: "W", colors: [c("Orange"), c("Indigo"), c("Green")] },
  { letter: "X", colors: [c("Yellow"), c("Blue"), c("Red")] },
];

export const BOX_BY_LETTER: Record<string, BoxDefinition> = Object.fromEntries(
  BOXES.map((b) => [b.letter, b])
);

export const BOX_LETTERS = BOXES.map((b) => b.letter);

export async function fetchBoxes(): Promise<Box[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("boxes")
    .select("*")
    .order("sort_order");
  return data ?? [];
}

export function boxToColors(box: Box): [BoxColor, BoxColor, BoxColor] {
  return [
    { name: box.color1_name, hex: box.color1_hex },
    { name: box.color2_name, hex: box.color2_hex },
    { name: box.color3_name, hex: box.color3_hex },
  ];
}

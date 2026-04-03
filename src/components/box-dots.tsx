import { BOX_BY_LETTER } from "@/lib/box-colors";

interface BoxDotsProps {
  letter: string;
  size?: "sm" | "md";
}

export default function BoxDots({ letter, size = "md" }: BoxDotsProps) {
  const box = BOX_BY_LETTER[letter];
  if (!box) return null;

  const dotSize = size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-bold text-white">{letter}</span>
      {box.colors.map((c, i) => (
        <span
          key={i}
          className={`${dotSize} rounded-full inline-block border border-white/30`}
          style={{ backgroundColor: c.hex }}
          title={c.name}
        />
      ))}
    </span>
  );
}

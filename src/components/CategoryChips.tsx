import type { Category } from "../lib/products";

export default function CategoryChips({
  categories,
  max,
  oneLine = false,
}: {
  categories: Category[];
  max?: number;
  /**
   * Una sola línea, sin wrap: lo usan las tarjetas para que todas midan
   * exactamente lo mismo (los nombres largos se truncan).
   */
  oneLine?: boolean;
}) {
  if (categories.length === 0) return null;
  const shown = typeof max === "number" ? categories.slice(0, max) : categories;
  const rest = categories.length - shown.length;

  return (
    <ul
      className={[
        "flex gap-1 overflow-hidden",
        oneLine ? "h-6 flex-nowrap items-start" : "flex-wrap",
      ].join(" ")}
    >
      {shown.map((c) => (
        <li
          key={c.slug}
          className={[
            "truncate rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700",
            oneLine ? "min-w-0 shrink" : "max-w-full",
          ].join(" ")}
        >
          {c.name}
        </li>
      ))}
      {rest > 0 && (
        <li className="shrink-0 rounded-full bg-line/70 px-2 py-0.5 text-[10px] font-semibold text-muted">
          +{rest}
        </li>
      )}
    </ul>
  );
}

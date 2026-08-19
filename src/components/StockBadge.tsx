export default function StockBadge({ inStock }: { inStock: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
        inStock
          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
          : "bg-rose-50 text-rose-800 ring-rose-200",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          inStock ? "bg-emerald-500" : "bg-rose-500",
        ].join(" ")}
        aria-hidden="true"
      />
      {inStock ? "En stock" : "Sin stock"}
    </span>
  );
}

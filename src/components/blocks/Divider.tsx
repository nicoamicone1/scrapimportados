import type { BlockProps } from "./types";

const SPACE = { sm: "var(--space-section-sm)", md: "var(--space-section-md)", lg: "var(--space-section-lg)" } as const;

/** Separador: regla `--border` o espacio. */
export function Divider({ block }: BlockProps<"divider">) {
  const s = block.settings;
  if (s.style === "space") return <div aria-hidden style={{ height: SPACE[s.size] }} />;
  return (
    <div style={{ paddingBlock: `calc(${SPACE[s.size]} / 2)` }}>
      <hr className="blk-rule" />
    </div>
  );
}

import type { CSSProperties } from "react";

import { FEATURE_ICONS } from "./icons";
import type { BlockProps } from "./types";

/**
 * Beneficios como fila de texto (DESIGN.md §1.1): ícono lucide 20px trazo
 * 1.5 en `--fg` a la izquierda del título, sin fondos ni círculos. Máx. 4.
 */
export function Features({ block }: BlockProps<"features">) {
  const s = block.settings;
  const items = s.items.filter((i) => i.title).slice(0, 4);
  if (!items.length) return null;
  const cols = Math.min(s.columns, items.length);
  return (
    <ul
      className="blk-cols"
      style={{ "--m-cols": 1, "--t-cols": Math.min(cols, 2), "--cols": cols, rowGap: "calc(var(--gap-grid) * 1.5)" } as CSSProperties}
    >
      {items.map((item, i) => {
        const Icon = FEATURE_ICONS[item.icon];
        return (
          <li key={i} className="min-w-0">
            <p className="flex items-center gap-2.5 text-base" style={{ fontWeight: "var(--body-strong-weight)" }}>
              {Icon ? <Icon aria-hidden className="size-5 shrink-0 text-fg" strokeWidth={1.5} /> : null}
              <span>{item.title}</span>
            </p>
            {item.text ? (
              <p className="mt-1 text-sm text-fg-muted" style={Icon ? { paddingLeft: "calc(20px + 0.625rem)" } : undefined}>
                {item.text}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

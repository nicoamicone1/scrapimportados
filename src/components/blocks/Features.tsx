import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

import { FEATURE_ICONS } from "./icons";
import type { BlockProps } from "./types";

/**
 * Beneficios (DESIGN.md §1.1, §6.12). Ícono lucide 20px trazo 1.5 en `--fg`,
 * nunca dentro de un círculo pastel. Máx. 4.
 * - row:   fila de texto (ícono a la izquierda del título).
 * - cards: tarjetas con la forma chica del tema y el número del dato.
 * - strip: tira compacta con separadores verticales, como una barra de datos.
 */
export function Features({ block }: BlockProps<"features">) {
  const s = block.settings;
  const items = s.items.filter((i) => i.title).slice(0, 4);
  if (!items.length) return null;
  const cols = Math.min(s.columns, items.length);
  const layout = s.layout ?? "row";

  if (layout === "strip") {
    return (
      <ul className="blk-strip st-stagger" data-n={items.length}>
        {items.map((item, i) => {
          const Icon = FEATURE_ICONS[item.icon];
          return (
            <li key={i} className="blk-strip-item" style={{ "--i": i } as CSSProperties}>
              {Icon ? <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.5} /> : null}
              <span className="min-w-0">
                <span className="blk-strip-title">{item.title}</span>
                {item.text ? <span className="blk-strip-text">{item.text}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul
      className={cn("blk-cols st-stagger", layout === "cards" && "blk-feat-cards")}
      style={{ "--m-cols": 1, "--t-cols": Math.min(cols, 2), "--cols": cols, rowGap: "calc(var(--gap-grid) * 1.5)" } as CSSProperties}
    >
      {items.map((item, i) => {
        const Icon = FEATURE_ICONS[item.icon];
        if (layout === "cards") {
          return (
            <li key={i} className="blk-feat-card blk-card-shape" style={{ "--i": i } as CSSProperties}>
              <span className="blk-feat-num tnum" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              {Icon ? <Icon aria-hidden className="size-5 text-fg" strokeWidth={1.5} /> : null}
              <p className="blk-feat-title">{item.title}</p>
              {item.text ? <p className="mt-1.5 text-sm text-fg-muted">{item.text}</p> : null}
            </li>
          );
        }
        return (
          <li key={i} className="min-w-0" style={{ "--i": i } as CSSProperties}>
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

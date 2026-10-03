"use client";

import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { Dialog } from "@/components/ui/Dialog";
import type { Block } from "@/lib/blocks/schema";
import { defaultHomeFor, STARTER_TEMPLATES, type StarterPresetId } from "@/lib/blocks/starters";
import { PRESET_LIST, PRESETS } from "@/lib/theme/presets";
import type { Theme } from "@/lib/theme";

/*
 * "Empezar desde una plantilla" (DESIGN.md §6.5): las 10 portadas de fábrica,
 * una por estilo, dibujadas como una silueta de página con los colores de la
 * tienda. Elegir una reemplaza los bloques (se deshace desde el aviso) y fija
 * la disposición de la portada de esa plantilla, para que se vea igual aunque
 * el estilo de la tienda sea otro.
 */

export interface StarterContext {
  storeName: string;
  transferDiscount: number;
  whatsapp: boolean;
}

/** Bloques de la plantilla, listos para el editor (ids nuevos; portada con la disposición de su estilo). */
export function starterBlocksFor(preset: StarterPresetId, ctx: StarterContext): Block[] {
  const hero = PRESETS[preset].style.hero;
  return defaultHomeFor(preset, { ...ctx, stableIds: false }).map((b) =>
    b.type === "hero" ? ({ ...b, settings: { ...b.settings, layout: hero } } as Block) : b,
  );
}

const W = 120;

/** Silueta de la página: cada bloque es una franja con su forma básica. */
function PageSketch({ blocks, preset, theme }: { blocks: Block[]; preset: StarterPresetId; theme: Theme }) {
  const c = theme.colors;
  const heroStyle = PRESETS[preset].style.hero;
  let y = 0;
  const parts: ReactNode[] = [];
  const box = (x: number, yy: number, w: number, h: number, fill: string, key: string, rx = 1) => (
    <rect key={key} x={x} y={yy} width={w} height={h} rx={rx} fill={fill} />
  );
  for (const [i, b] of blocks.entries()) {
    const k = `${i}`;
    switch (b.type) {
      case "hero": {
        const h = 46;
        if (heroStyle === "split") {
          parts.push(box(0, y, W / 2, h, c.primary, k + "a", 0), box(W / 2 + 6, y + 6, W / 2 - 12, h - 12, c.surface, k + "b", 3));
          parts.push(box(6, y + 18, 34, 5, c.primaryText, k + "c"), box(6, y + 27, 22, 3, c.primaryText, k + "d"));
        } else if (heroStyle === "framed") {
          parts.push(box(6, y + 4, W - 12, h - 10, c.secondary, k + "a", 6), box(12, y + 22, 44, 20, c.background, k + "b", 3));
          parts.push(box(16, y + 27, 30, 4, c.text, k + "c"));
        } else if (heroStyle === "poster") {
          parts.push(box(0, y, W, h, c.secondary, k + "a", 0), box(6, y + 8, 92, 12, c.text, k + "b"), box(6, y + 23, 60, 12, c.text, k + "c"));
        } else if (heroStyle === "stack") {
          parts.push(box(32, y + 6, 56, 6, c.text, k + "a"), box(44, y + 15, 32, 4, c.primary, k + "b"), box(0, y + 28, W, 18, c.secondary, k + "c", 0));
          for (let j = 0; j < 4; j++) parts.push(box(8 + j * 27, y + 24, 23, 18, c.surface, `${k}d${j}`, 2));
        } else {
          parts.push(box(0, y, W, h, c.textMuted, k + "a", 0), box(6, y + 26, 44, 6, c.background, k + "b"), box(6, y + 35, 16, 5, c.background, k + "c"));
        }
        y += h + 4;
        break;
      }
      case "marquee": {
        const h = b.settings.size === "lg" ? 12 : 7;
        parts.push(box(0, y, W, h, b.style.background === "primary" ? c.primary : c.surface, k, 0));
        for (let j = 0; j < 4; j++) parts.push(box(4 + j * 30, y + h / 2 - 1.5, 22, 3, b.style.background === "primary" ? c.primaryText : c.text, `${k}t${j}`));
        y += h + 4;
        break;
      }
      case "product_grid":
      case "product_slider": {
        const cols = b.type === "product_grid" ? Math.min(b.settings.columns, 5) : Math.min(b.settings.cardsPerView, 5);
        const rows = b.type === "product_grid" ? 2 : 1;
        const cw = (W - 12 - (cols - 1) * 3) / cols;
        parts.push(box(6, y, 30, 3, c.text, k + "t"));
        y += 6;
        const first = b.settings.highlight === "first";
        for (let r = 0; r < rows; r++) {
          for (let j = 0; j < cols; j++) {
            if (first && b.type === "product_grid" && j < 2 && r === 1) continue;
            const big = first && j === 0 && r === 0;
            const w = big ? cw * 2 + 3 : cw;
            const x = 6 + (big ? 0 : first && j > 0 ? j + 1 : j) * (cw + 3);
            if (x + w > W - 5) continue;
            parts.push(box(x, y + r * (cw + 3), w, big && b.type === "product_grid" ? cw * 2 + 3 : cw, c.surface, `${k}${r}${j}`, 1.5));
          }
        }
        y += rows * (cw + 3) + 4;
        break;
      }
      case "category_list": {
        parts.push(box(6, y, 26, 3, c.text, k + "t"));
        y += 6;
        if (b.settings.style === "list") {
          for (let j = 0; j < 3; j++) parts.push(box(6, y + j * 6, [56, 40, 48][j], 3.5, c.text, `${k}${j}`), box(6, y + j * 6 + 4.6, W - 12, 0.5, c.border, `${k}l${j}`, 0));
          y += 22;
        } else if (b.settings.style === "chips") {
          for (let j = 0; j < 5; j++) parts.push(<rect key={`${k}${j}`} x={6 + j * 22} y={y} width={19} height={5} rx={2.5} fill="none" stroke={c.border} />);
          y += 9;
        } else if (b.settings.style === "circles") {
          for (let j = 0; j < 6; j++) parts.push(<circle key={`${k}${j}`} cx={12 + j * 19} cy={y + 7} r={6.5} fill={c.surface} stroke={c.border} strokeWidth={0.5} />);
          y += 18;
        } else {
          for (let j = 0; j < 4; j++) parts.push(box(6 + j * 27.5, y, 24.5, 20, c.surface, `${k}${j}`, 2));
          y += 24;
        }
        break;
      }
      case "lookbook": {
        const left = b.settings.imagePosition === "left";
        parts.push(box(left ? 6 : 64, y, 50, 40, c.secondary, k + "a", 2));
        for (let j = 0; j < 4; j++) parts.push(box((left ? 62 : 6) + (j % 2) * 26, y + 4 + Math.floor(j / 2) * 19, 22, 16, c.surface, `${k}${j}`, 1.5));
        y += 44;
        break;
      }
      case "features": {
        const bg = b.style.background === "surface";
        if (bg) parts.push(box(0, y - 2, W, 14, c.surface, k + "bg", 0));
        const n = Math.min(b.settings.items.length, 4);
        for (let j = 0; j < n; j++) {
          const w = (W - 12 - (n - 1) * 4) / n;
          if (b.settings.layout === "cards") parts.push(box(6 + j * (w + 4), y, w, 10, bg ? c.background : c.surface, `${k}${j}`, 2));
          else parts.push(box(6 + j * (w + 4), y + 3, w * 0.7, 3, c.text, `${k}${j}`));
        }
        y += 14;
        break;
      }
      case "faq": {
        const split = b.settings.layout === "split";
        parts.push(box(6, y, split ? 30 : 34, 4, c.text, k + "t"));
        for (let j = 0; j < 3; j++) parts.push(box(split ? 50 : 6, y + (split ? 0 : 7) + j * 5, split ? 64 : W - 12, 0.6, c.border, `${k}${j}`, 0));
        y += split ? 16 : 22;
        break;
      }
      default:
        y += 8;
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${y}`} className="block h-auto w-full" aria-hidden style={{ background: c.background }}>
      {parts}
    </svg>
  );
}

export function StarterTemplatesDialog({
  open,
  onOpenChange,
  theme,
  context,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  theme: Theme;
  context: StarterContext;
  onPick: (preset: StarterPresetId) => void;
}) {
  const names = new Map(PRESET_LIST.map((p) => [p.id, p.name]));
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Empezar desde una plantilla"
      description="Cada estilo trae su portada armada. Reemplaza los bloques de esta página (lo podés deshacer) y conserva tus colores y fuentes."
      size="xl"
    >
      <ul className="grid grid-cols-2 gap-3 pb-1 sm:grid-cols-3 lg:grid-cols-5">
        {STARTER_TEMPLATES.map((t) => {
          const blocks = starterBlocksFor(t.preset, context);
          return (
            <li key={t.preset}>
              <button
                type="button"
                onClick={() => {
                  onPick(t.preset);
                  onOpenChange(false);
                }}
                className="group flex h-full w-full flex-col overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface text-left transition-[border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:border-adm-link hover:shadow-[var(--adm-shadow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-link"
              >
                <span className="block h-44 overflow-hidden border-b border-adm-border" style={{ background: theme.colors.background }}>
                  <PageSketch blocks={blocks} preset={t.preset} theme={theme} />
                </span>
                <span className="flex flex-1 flex-col gap-1 p-2.5">
                  <span className="flex items-center justify-between gap-2 text-[13px] font-semibold text-adm-fg">
                    {t.label}
                    <ArrowRight className="size-3.5 shrink-0 text-adm-link opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </span>
                  <span className="text-xs leading-snug text-adm-fg-muted">{t.description}</span>
                  <span className="mt-auto pt-1 text-[11px] text-adm-fg-muted">Del estilo {names.get(t.preset)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

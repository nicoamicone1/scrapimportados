import {
  AlignLeft,
  CalendarClock,
  CircleHelp,
  Columns2,
  GalleryHorizontal,
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  LayoutPanelLeft,
  ListChecks,
  MessageSquareQuote,
  Minus,
  PanelTop,
  SquarePlay,
  Tags,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { BlockType } from "@/lib/blocks/schema";

/** Ícono lucide por tipo de bloque (lista del builder). */
export const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  hero: PanelTop,
  product_slider: GalleryHorizontal,
  product_grid: LayoutGrid,
  banner_grid: Columns2,
  rich_text: AlignLeft,
  heading: Heading,
  image_text: LayoutPanelLeft,
  category_list: Tags,
  features: ListChecks,
  faq: CircleHelp,
  countdown: CalendarClock,
  testimonials: MessageSquareQuote,
  video: SquarePlay,
  divider: Minus,
};

export const BlockIconImage = ImageIcon;

/*
 * Miniaturas esquemáticas (SVG) para la paleta de bloques. Monocromas con
 * `currentColor` en distintas opacidades: sin imágenes ni colores de marca.
 */

const W = 160;
const H = 96;

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="4" fill="var(--adm-surface)" stroke="var(--adm-border)" />
      {children}
    </svg>
  );
}

const fill = (o: number) => ({ fill: "currentColor", fillOpacity: o });

function Lines({ x, y, widths, gap = 7, h = 3.5, o = 0.35 }: { x: number; y: number; widths: number[]; gap?: number; h?: number; o?: number }) {
  return (
    <>
      {widths.map((w, i) => (
        <rect key={i} x={x} y={y + i * gap} width={w} height={h} rx="1.5" {...fill(o)} />
      ))}
    </>
  );
}

function Card({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h * 0.62} rx="2" {...fill(0.14)} />
      <rect x={x} y={y + h * 0.7} width={w * 0.85} height="3" rx="1.5" {...fill(0.35)} />
      <rect x={x} y={y + h * 0.7 + 6} width={w * 0.45} height="3" rx="1.5" {...fill(0.6)} />
    </>
  );
}

const THUMBS: Record<BlockType, () => ReactNode> = {
  hero: () => (
    <Frame>
      <rect x="6" y="6" width="148" height="84" rx="2" {...fill(0.16)} />
      <rect x="14" y="44" width="70" height="8" rx="2" {...fill(0.7)} />
      <rect x="14" y="57" width="52" height="4" rx="2" {...fill(0.4)} />
      <rect x="14" y="68" width="30" height="10" rx="2" {...fill(0.85)} />
      <rect x="50" y="72" width="22" height="3" rx="1.5" {...fill(0.45)} />
    </Frame>
  ),
  product_slider: () => (
    <Frame>
      <Lines x={10} y={12} widths={[46]} h={5} o={0.6} />
      <rect x="130" y="10" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeOpacity=".35" />
      <rect x="142" y="10" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeOpacity=".35" />
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} x={10 + i * 40} y={28} w={34} h={58} />
      ))}
    </Frame>
  ),
  product_grid: () => (
    <Frame>
      <Lines x={10} y={10} widths={[40]} h={5} o={0.6} />
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} x={10 + i * 36} y={22} w={31} h={32} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Card key={`b${i}`} x={10 + i * 36} y={58} w={31} h={32} />
      ))}
    </Frame>
  ),
  banner_grid: () => (
    <Frame>
      <rect x="8" y="8" width="94" height="80" rx="2" {...fill(0.16)} />
      <rect x="106" y="8" width="46" height="38" rx="2" {...fill(0.12)} />
      <rect x="106" y="50" width="46" height="38" rx="2" {...fill(0.12)} />
      <Lines x={14} y={70} widths={[40, 26]} o={0.6} />
    </Frame>
  ),
  rich_text: () => (
    <Frame>
      <Lines x={14} y={14} widths={[60]} h={6} o={0.6} />
      <Lines x={14} y={30} widths={[128, 120, 132, 96]} />
      <Lines x={14} y={62} widths={[124, 110, 70]} />
    </Frame>
  ),
  heading: () => (
    <Frame>
      <Lines x={14} y={32} widths={[34]} h={3} o={0.4} />
      <rect x="14" y="42" width="98" height="12" rx="2" {...fill(0.7)} />
    </Frame>
  ),
  image_text: () => (
    <Frame>
      <rect x="8" y="10" width="84" height="76" rx="2" {...fill(0.16)} />
      <rect x="100" y="28" width="46" height="7" rx="2" {...fill(0.65)} />
      <Lines x={100} y={42} widths={[50, 46, 40]} />
      <rect x="100" y="66" width="26" height="9" rx="2" {...fill(0.8)} />
    </Frame>
  ),
  category_list: () => (
    <Frame>
      <Lines x={10} y={12} widths={[50]} h={5} o={0.6} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={10 + i * 36} y="26" width="31" height="31" rx="2" {...fill(0.14)} />
          <rect x={10 + i * 36} y="62" width="24" height="3.5" rx="1.5" {...fill(0.55)} />
          <rect x={10 + i * 36} y="69" width="16" height="3" rx="1.5" {...fill(0.3)} />
        </g>
      ))}
    </Frame>
  ),
  features: () => (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={12 + i * 48} y="38" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeOpacity=".7" />
          <rect x={24 + i * 48} y="39.5" width="26" height="4.5" rx="1.5" {...fill(0.6)} />
          <Lines x={24 + i * 48} y={50} widths={[30, 22]} h={3} gap={6} o={0.3} />
        </g>
      ))}
    </Frame>
  ),
  faq: () => (
    <Frame>
      <Lines x={14} y={12} widths={[56]} h={5} o={0.6} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="14" y={28 + i * 15} width="132" height="0.8" {...fill(0.3)} />
          <rect x="14" y={33 + i * 15} width={70 + (i % 2) * 20} height="3.5" rx="1.5" {...fill(0.5)} />
          <rect x="140" y={32 + i * 15} width="6" height="1.5" {...fill(0.5)} />
        </g>
      ))}
    </Frame>
  ),
  countdown: () => (
    <Frame>
      <Lines x={14} y={16} widths={[64]} h={5} o={0.6} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={14 + i * 32} y="34" width="22" height="18" rx="2" {...fill(0.7)} />
          <rect x={14 + i * 32} y="57" width="14" height="3" rx="1.5" {...fill(0.3)} />
        </g>
      ))}
      <rect x="14" y="70" width="32" height="10" rx="2" {...fill(0.8)} />
    </Frame>
  ),
  testimonials: () => (
    <Frame>
      {[0, 1].map((i) => (
        <g key={i}>
          <Lines x={14 + i * 72} y={28} widths={[60, 54, 40]} h={4} gap={8} o={0.55} />
          <rect x={14 + i * 72} y="62" width="26" height="3.5" rx="1.5" {...fill(0.7)} />
        </g>
      ))}
    </Frame>
  ),
  video: () => (
    <Frame>
      <rect x="20" y="10" width="120" height="76" rx="2" {...fill(0.16)} />
      <rect x="68" y="36" width="24" height="24" rx="3" {...fill(0.85)} />
      <path d="M77 42 L87 48 L77 54 Z" fill="var(--adm-surface)" />
    </Frame>
  ),
  divider: () => (
    <Frame>
      <Lines x={14} y={22} widths={[100, 80]} o={0.2} />
      <rect x="14" y="48" width="132" height="1" {...fill(0.55)} />
      <Lines x={14} y={62} widths={[110, 70]} o={0.2} />
    </Frame>
  ),
};

export function BlockThumb({ type }: { type: BlockType }) {
  return <>{THUMBS[type]()}</>;
}

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Tonos lavados de docs/DESIGN.md §7.7 (contraste ≥ 5.8:1). */
export type BadgeTone = "neutral" | "amber" | "blue" | "purple" | "teal" | "green" | "orange" | "red" | "accent";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-[#ECEBE7] text-[#5C5952]",
  amber: "bg-[#F5EAD3] text-[#7A4A00]",
  blue: "bg-[#E2EBF4] text-[#1F4B75]",
  purple: "bg-[#ECE5F2] text-[#5A3C82]",
  teal: "bg-[#DCEFEC] text-[#1C5C55]",
  green: "bg-[#E1EFDF] text-[#2A5F2E]",
  orange: "bg-[#F7E4D6] text-[#8A3C0C]",
  red: "bg-[#F8E1DE] text-[#9B2218]",
  accent: "bg-adm-accent-soft text-adm-accent",
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** Punto de 6px del color del texto (el estado nunca va sólo por color). */
  dot?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}

export function Badge({ tone = "neutral", dot = true, className, children, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-adm-sm px-1.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/** Mapas de estado → etiqueta + tono (pedidos, pagos, productos, stock). */
export const STATUS_BADGES = {
  order: {
    pending: { label: "Pendiente", tone: "amber" },
    confirmed: { label: "Confirmado", tone: "blue" },
    preparing: { label: "En preparación", tone: "purple" },
    shipped: { label: "Enviado", tone: "teal" },
    delivered: { label: "Entregado", tone: "green" },
    cancelled: { label: "Cancelado", tone: "neutral" },
  },
  payment: {
    pending: { label: "Sin pagar", tone: "amber" },
    partial: { label: "Pago parcial", tone: "orange" },
    paid: { label: "Pagado", tone: "green" },
    refunded: { label: "Reintegrado", tone: "neutral" },
  },
  product: {
    draft: { label: "Borrador", tone: "neutral" },
    active: { label: "Activo", tone: "green" },
    archived: { label: "Archivado", tone: "neutral" },
  },
  stock: {
    low: { label: "Stock bajo", tone: "amber" },
    out: { label: "Sin stock", tone: "red" },
    ok: { label: "En stock", tone: "green" },
  },
  page: {
    draft: { label: "Borrador", tone: "neutral" },
    published: { label: "Publicada", tone: "green" },
  },
} as const satisfies Record<string, Record<string, { label: string; tone: BadgeTone }>>;

export type StatusKind = keyof typeof STATUS_BADGES;

export function StatusBadge<K extends StatusKind>({
  kind,
  value,
  className,
}: {
  kind: K;
  value: keyof (typeof STATUS_BADGES)[K] | (string & {});
  className?: string;
}) {
  const map = STATUS_BADGES[kind] as Record<string, { label: string; tone: BadgeTone }>;
  const entry = map[String(value)] ?? { label: String(value), tone: "neutral" as const };
  return (
    <Badge tone={entry.tone} className={className}>
      {entry.label}
    </Badge>
  );
}

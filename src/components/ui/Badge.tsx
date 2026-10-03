import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Tonos lavados fríos de docs/DESIGN.md §7.7 (tokens `--adm-badge-*` en
 * admin.css, contraste ≥ 5,9:1). `accent` = pomelo de marca ("En uso",
 * "Nuevo"); `ink` = tinta sólida para un dato que tiene que saltar.
 */
export type BadgeTone = "neutral" | "amber" | "blue" | "purple" | "teal" | "green" | "orange" | "red" | "accent" | "ink";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-[var(--adm-badge-neutral-bg)] text-[var(--adm-badge-neutral-fg)]",
  amber: "bg-[var(--adm-badge-amber-bg)] text-[var(--adm-badge-amber-fg)]",
  blue: "bg-[var(--adm-badge-blue-bg)] text-[var(--adm-badge-blue-fg)]",
  purple: "bg-[var(--adm-badge-purple-bg)] text-[var(--adm-badge-purple-fg)]",
  teal: "bg-[var(--adm-badge-teal-bg)] text-[var(--adm-badge-teal-fg)]",
  green: "bg-[var(--adm-badge-green-bg)] text-[var(--adm-badge-green-fg)]",
  orange: "bg-[var(--adm-badge-orange-bg)] text-[var(--adm-badge-orange-fg)]",
  red: "bg-[var(--adm-badge-red-bg)] text-[var(--adm-badge-red-fg)]",
  accent: "bg-[var(--adm-badge-accent-bg)] text-[var(--adm-badge-accent-fg)]",
  ink: "bg-eco-ink text-white",
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** Punto de 6px del color del texto (el estado nunca va sólo por color). */
  dot?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}

/** Pastilla de 22 px con punto + etiqueta (BRAND §10). */
export function Badge({ tone = "neutral", dot = true, className, children, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full text-xs leading-none font-medium whitespace-nowrap",
        dot ? "pr-2.5 pl-2" : "px-2.5",
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

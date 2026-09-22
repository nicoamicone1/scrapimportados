import { ImageOff } from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { formatMoney, formatNumber, formatPercent } from "@/lib/money";
import {
  COUPON_STATUS_LABELS,
  SCHEDULE_STATUS_LABELS,
  summarizeCategorySelection,
  type CategoryLite,
  type CouponStatus,
  type ScheduleStatus,
} from "@/lib/pricing";

/* Piezas chicas compartidas por precios, promociones y cupones (agente C). */

/** Miniatura 32px (DESIGN.md §7.5). */
export function Thumb({ url, className }: { url: string | null | undefined; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-adm-sm border border-adm-border bg-adm-surface-2",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura del admin de 32px; next/image no aporta y los hosts de imágenes importadas varían
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <ImageOff className="size-3.5 text-adm-fg-muted" aria-hidden />
      )}
    </span>
  );
}

const SCHEDULE_TONES: Record<ScheduleStatus, BadgeTone> = {
  active: "green",
  scheduled: "blue",
  paused: "amber",
  expired: "neutral",
};

export function PromoStatusBadge({ status }: { status: ScheduleStatus }) {
  return <Badge tone={SCHEDULE_TONES[status]}>{SCHEDULE_STATUS_LABELS[status]}</Badge>;
}

const COUPON_TONES: Record<CouponStatus, BadgeTone> = { ...SCHEDULE_TONES, exhausted: "orange" };

export function CouponStatusBadge({ status }: { status: CouponStatus }) {
  return <Badge tone={COUPON_TONES[status]}>{COUPON_STATUS_LABELS[status]}</Badge>;
}

/** "-15 %" · "-$ 2.000" · "Envío gratis" */
export function discountLabel(type: string, value: number): string {
  if (type === "free_shipping") return "Envío gratis";
  if (type === "fixed") return `-${formatMoney(value)}`;
  return `-${formatPercent(value)}`;
}

/** Input numérico → number | null (vacío = null). */
export function parseNumberInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Precio viejo → nuevo, con el nuevo resaltado si cambia. */
export function PriceChange({ from, to }: { from: number | null; to: number | null }) {
  const changed = from !== to;
  return (
    <span className="tnum inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
      <span className={cn(changed ? "text-adm-fg-muted" : "text-adm-fg")}>{from == null ? "—" : formatMoney(from)}</span>
      {changed ? (
        <>
          <span aria-hidden className="text-adm-fg-muted">
            →
          </span>
          <span className="sr-only">pasa a</span>
          <span className="font-medium text-adm-fg">{to == null ? "—" : formatMoney(to)}</span>
        </>
      ) : null}
    </span>
  );
}

/** "Toda la tienda" · "Hogar, Audio y 2 más" · "3 productos" */
export function scopeSummary(
  item: { scope: string; categoryIds: string[]; productIds: string[] },
  categories: CategoryLite[],
): string {
  if (item.scope === "all") return "Toda la tienda";
  if (item.scope === "products") return item.productIds.length === 1 ? "1 producto" : `${formatNumber(item.productIds.length)} productos`;
  const names = summarizeCategorySelection(categories, item.categoryIds);
  if (names.length <= 2) return names.join(", ") || "Sin categorías";
  return `${names.slice(0, 2).join(", ")} y ${names.length - 2} más`;
}

/** Vigencia en la zona de la tienda: "Sin límite" · "Desde …" · "… → …". */
export function windowSummary(startsAt: string | null | undefined, endsAt: string | null | undefined, tz: string): string {
  if (!startsAt && !endsAt) return "Sin límite";
  if (startsAt && endsAt) return `${formatDateTime(startsAt, tz)} → ${formatDateTime(endsAt, tz)}`;
  if (startsAt) return `Desde ${formatDateTime(startsAt, tz)}`;
  return `Hasta ${formatDateTime(endsAt, tz)}`;
}

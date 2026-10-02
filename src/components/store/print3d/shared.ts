/**
 * Taller 3D en la tienda: tipos de la cotización pública y formatos (sin
 * server-only: lo usan las páginas y las islas client).
 */

import type { Geometry, ModelFormat, ReviewReason } from "@/lib/print3d/types";

export const QUOTE_STATUSES = ["pending_review", "priced", "ordered", "expired", "rejected"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export interface PublicQuoteItem {
  id: string;
  fileName: string;
  format: ModelFormat;
  geometry: Geometry | null;
  materialName: string;
  materialType: string;
  colorName: string;
  colorHex: string;
  qualityName: string;
  layerHeight: number | null;
  infillPct: number;
  supports: boolean;
  qty: number;
  /** Por unidad, calibrados. */
  grams: number;
  minutes: number;
  unitPrice: number;
  total: number;
  needsReview: boolean;
  reviewReasons: ReviewReason[];
}

export interface PublicQuote {
  token: string;
  storeId: string;
  status: QuoteStatus;
  subtotal: number;
  setupFee: number;
  minAdjustment: number;
  total: number;
  /** YYYY-MM-DD */
  estimatedReadyDate: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  reviewNote: string | null;
  notes: string | null;
  /** Token público del pedido (si la RPC lo devuelve) para linkear `/pedido/<token>`. */
  orderToken: string | null;
  orderNumber: number | null;
  items: PublicQuoteItem[];
}

/** "jueves 9 de octubre" a partir de "2026-10-09" (fecha pura: sin corrimiento de zona). */
export function formatReadyDate(isoDate: string | null | undefined): string | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d).replace(",", "");
}

/** Minutos → "45 min" · "3 h 20 min" · "26 h". */
export function formatPrintTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const total = Math.max(1, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h >= 10) return `${Math.round(total / 60)} h`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

const nf1 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** Gramos: "38 g" · "1,2 kg". */
export function formatGrams(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return "—";
  if (grams >= 1000) return `${nf1.format(grams / 1000)} kg`;
  return `${grams < 10 ? nf1.format(grams) : nf0.format(grams)} g`;
}

/** Una medida en mm: 1 decimal por debajo de 100 mm. */
export function formatMm(value: number): string {
  return value < 100 ? nf1.format(value) : nf0.format(value);
}

/** "120 × 80 × 45 mm" */
export function formatDims(bbox: readonly [number, number, number]): string {
  return `${bbox.map(formatMm).join(" × ")} mm`;
}

/** "PLA Negro · Estándar 0,20 · 20 % relleno · con soportes" (igual que la línea del pedido). */
export function describeChoice(input: {
  materialName: string;
  colorName: string;
  qualityName: string;
  infillPct: number;
  supports: boolean;
}): string {
  return [`${input.materialName} ${input.colorName}`.trim(), input.qualityName, `${input.infillPct} % relleno`, input.supports ? "con soportes" : null]
    .filter(Boolean)
    .join(" · ");
}

/** Nombre de archivo seguro para la ruta del bucket (sin extensión). */
export function safeFileStem(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const clean = stem
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60);
  return clean || "pieza";
}

/** Formato por extensión (null = no soportado). */
export function formatOf(fileName: string): ModelFormat | null {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext === "stl" ? "stl" : ext === "3mf" ? "3mf" : null;
}

export const STATUS_COPY: Record<QuoteStatus, { label: string; tone: string }> = {
  pending_review: { label: "En revisión", tone: "text-fg-muted" },
  priced: { label: "Cotizada", tone: "text-success" },
  ordered: { label: "Pedida", tone: "text-fg" },
  expired: { label: "Vencida", tone: "text-fg-muted" },
  rejected: { label: "No la podemos hacer", tone: "text-danger" },
};

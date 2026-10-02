import "server-only";

import { unstable_cache } from "next/cache";

import { QUOTE_STATUSES, type PublicQuote, type PublicQuoteItem, type QuoteStatus } from "@/components/store/print3d/shared";
import { estimateReadyDate } from "@/lib/print3d";
import {
  MATERIAL_TYPES,
  REVIEW_REASONS,
  type Calibration,
  type Geometry,
  type MadeToOrderSpec,
  type MaterialType,
  type PrinterCapacity,
  type PublicConfig,
  type PublicMaterial,
  type PublicQuality,
  type PublicSettings,
  type ReviewReason,
} from "@/lib/print3d/types";
import type { Json } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/server";

/*
 * Taller 3D — lecturas PÚBLICAS del storefront (spec TALLER-3D §2.1, §4).
 * Todo pasa por RPC security definer (anon no lee tablas `print3d_*`).
 *
 * Caché: la config pública va con la tag `print3d:<storeId>`. Toda mutación
 * del admin que cambie precios, materiales, colores, bobinas, calidades,
 * impresoras o trabajos tiene que hacer `revalidateTag(print3dTag(storeId), "max")`.
 */

export function print3dTag(storeId: string): string {
  return `print3d:${storeId}`;
}

// ---------------------------------------------------------------------------
// Lectores defensivos de jsonb
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = num(v, Number.NaN);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}
function triple(v: unknown): [number, number, number] | null {
  const a = arr(v);
  if (a.length !== 3) return null;
  const t = a.map((x) => num(x, Number.NaN));
  return t.every((x) => Number.isFinite(x)) ? [t[0], t[1], t[2]] : null;
}
function materialType(v: unknown): MaterialType {
  const s = str(v).toUpperCase();
  return (MATERIAL_TYPES as readonly string[]).includes(s) ? (s as MaterialType) : "OTRO";
}

function parseSettings(raw: Obj): PublicSettings {
  const days = arr(raw.working_days)
    .map((d) => Math.trunc(num(d)))
    .filter((d) => d >= 1 && d <= 7);
  return {
    hour_rate: num(raw.hour_rate),
    min_piece_price: num(raw.min_piece_price),
    min_order_price: num(raw.min_order_price),
    setup_fee: num(raw.setup_fee),
    post_process_fee: num(raw.post_process_fee),
    support_extra_pct: num(raw.support_extra_pct, 25),
    round_to: num(raw.round_to),
    max_auto_hours: num(raw.max_auto_hours, 24),
    max_file_mb: Math.min(100, Math.max(1, num(raw.max_file_mb, 50))),
    quote_valid_days: num(raw.quote_valid_days, 7),
    daily_print_hours: num(raw.daily_print_hours, 18),
    post_process_days: num(raw.post_process_days, 1),
    buffer_days: num(raw.buffer_days),
    working_days: days.length ? days : [1, 2, 3, 4, 5],
    intro_md: str(raw.intro_md),
  };
}

function parseMaterial(raw: unknown): PublicMaterial | null {
  const m = obj(raw);
  if (!m || typeof m.id !== "string") return null;
  return {
    id: m.id,
    type: materialType(m.type),
    name: str(m.name, "Material"),
    density: num(m.density, 1.24),
    price_per_gram: num(m.price_per_gram),
    speed_factor: num(m.speed_factor, 1) || 1,
    colors: arr(m.colors).flatMap((c) => {
      const o = obj(c);
      if (!o || typeof o.id !== "string") return [];
      return [{ id: o.id, name: str(o.name, "Color"), hex: /^#[0-9a-f]{3,8}$/i.test(str(o.hex)) ? str(o.hex) : "#999999", available_grams: num(o.available_grams) }];
    }),
  };
}

function parseQuality(raw: unknown): PublicQuality | null {
  const q = obj(raw);
  if (!q || typeof q.id !== "string") return null;
  return {
    id: q.id,
    code: str(q.code),
    name: str(q.name, "Calidad"),
    layer_height: num(q.layer_height, 0.2),
    wall_mm: num(q.wall_mm, 1.2),
    throughput_g_h: num(q.throughput_g_h, 15) || 15,
    price_multiplier: num(q.price_multiplier, 1) || 1,
  };
}

/** Respuesta de `print3d_public_config` → `PublicConfig` (null = app apagada / sin tienda). */
export function parsePublicConfig(raw: Json | null | undefined): PublicConfig | null {
  const root = obj(raw);
  const settings = obj(root?.settings);
  if (!root || !settings) return null;
  return {
    settings: parseSettings(settings),
    materials: arr(root.materials).map(parseMaterial).filter((m): m is PublicMaterial => m !== null),
    qualities: arr(root.qualities).map(parseQuality).filter((q): q is PublicQuality => q !== null),
    calibration: arr(root.calibration).flatMap((c): Calibration[] => {
      const o = obj(c);
      if (!o || typeof o.material_id !== "string" || typeof o.quality_id !== "string") return [];
      return [{ material_id: o.material_id, quality_id: o.quality_id, grams_factor: num(o.grams_factor, 1), time_factor: num(o.time_factor, 1), samples: num(o.samples) }];
    }),
    printers: arr(root.printers).flatMap((p): PrinterCapacity[] => {
      const o = obj(p);
      const bed = triple(o?.bed);
      if (!o || typeof o.id !== "string" || !bed) return [];
      return [{ id: o.id, bed, materials: arr(o.materials).map(materialType), backlog_minutes: num(o.backlog_minutes) }];
    }),
    made_to_order: arr(root.made_to_order).flatMap((s): MadeToOrderSpec[] => {
      const o = obj(s);
      if (!o || typeof o.product_id !== "string") return [];
      return [
        {
          product_id: o.product_id,
          variant_id: typeof o.variant_id === "string" ? o.variant_id : null,
          minutes_per_unit: num(o.minutes_per_unit),
          units_per_plate: Math.max(1, Math.trunc(num(o.units_per_plate, 1))),
          material_type: materialType(o.material_type),
        },
      ];
    }),
  };
}

// ---------------------------------------------------------------------------
// Config pública
// ---------------------------------------------------------------------------

/** Sin caché (para lo que decide precios en el server). */
export async function fetchPrint3dConfigFresh(storeId: string): Promise<PublicConfig | null> {
  const { data, error } = await createPublicClient().rpc("print3d_public_config", { p_store_id: storeId });
  if (error) {
    // Sin la migración 0022 (función inexistente) la app simplemente no está.
    if (error.code === "PGRST202" || error.code === "42883") return null;
    throw new Error(`No se pudo leer la config del Taller 3D: ${error.message}`);
  }
  return parsePublicConfig(data);
}

/** Config pública cacheada (tag `print3d:<storeId>`, 5 min). `null` = app no activa o cotizador apagado. */
export function getPrint3dConfig(storeId: string): Promise<PublicConfig | null> {
  return unstable_cache(() => fetchPrint3dConfigFresh(storeId), ["print3d-public-config", storeId], {
    tags: [print3dTag(storeId)],
    revalidate: 300,
  })();
}

// ---------------------------------------------------------------------------
// "Se imprime a pedido · listo aprox. el …" (ficha de producto)
// ---------------------------------------------------------------------------

/**
 * Fecha estimada (YYYY-MM-DD) por variante para un producto con spec
 * `made_to_order`: clave = variant_id, o "*" para la spec de todas las
 * variantes. Motor §3.5 con una unidad (`minutes_per_unit`) sobre la cola actual.
 */
export function madeToOrderDates(config: PublicConfig | null, productId: string, now: Date = new Date()): Record<string, string> {
  if (!config) return {};
  const out: Record<string, string> = {};
  for (const spec of config.made_to_order) {
    if (spec.product_id !== productId || spec.minutes_per_unit <= 0) continue;
    const est = estimateReadyDate(
      config.printers,
      [{ minutes_total: spec.minutes_per_unit, material_type: spec.material_type, bbox: [0, 0, 0] }],
      config.settings,
      now,
    );
    if (est) out[spec.variant_id ?? "*"] = est.date;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cotización pública
// ---------------------------------------------------------------------------

function parseGeometry(v: unknown): Geometry | null {
  const g = obj(v);
  const bbox = triple(g?.bbox);
  if (!g || !bbox) return null;
  return {
    volume_mm3: num(g.volume_mm3),
    area_mm2: num(g.area_mm2),
    bbox,
    triangles: num(g.triangles),
    manifold: g.manifold !== false,
  };
}

function parseReasons(v: unknown): ReviewReason[] {
  return arr(v).filter((r): r is ReviewReason => typeof r === "string" && (REVIEW_REASONS as readonly string[]).includes(r));
}

function parseQuoteItem(raw: unknown): PublicQuoteItem | null {
  const i = obj(raw);
  if (!i) return null;
  // La RPC puede traer los nombres planos o anidados ({ material: { name, type } }).
  const material = obj(i.material);
  const color = obj(i.color);
  const quality = obj(i.quality);
  return {
    id: str(i.id, crypto.randomUUID()),
    fileName: str(i.file_name, "pieza.stl"),
    format: i.format === "3mf" ? "3mf" : "stl",
    geometry: parseGeometry(i.geometry),
    materialName: str(i.material_name, str(material?.name, "")),
    materialType: str(i.material_type, str(material?.type, "")),
    colorName: str(i.color_name, str(color?.name, "")),
    colorHex: str(i.color_hex, str(color?.hex, "#999999")),
    qualityName: str(i.quality_name, str(quality?.name, "")),
    layerHeight: numOrNull(i.layer_height ?? quality?.layer_height),
    infillPct: Math.round(num(i.infill_pct, 20)),
    supports: i.supports === true,
    qty: Math.max(1, Math.trunc(num(i.qty, 1))),
    grams: num(i.grams),
    minutes: num(i.minutes),
    unitPrice: num(i.unit_price),
    total: num(i.total),
    needsReview: i.needs_review === true,
    reviewReasons: parseReasons(i.review_reasons),
  };
}

export function parsePublicQuote(raw: Json | null | undefined, token: string): PublicQuote | null {
  const root = obj(raw);
  const q = obj(root?.quote) ?? root;
  if (!q) return null;
  const status = str(q.status);
  if (!(QUOTE_STATUSES as readonly string[]).includes(status)) return null;
  const order = obj(q.order);
  return {
    token: str(q.token, token),
    storeId: str(q.store_id, str(root?.store_id)),
    status: status as QuoteStatus,
    subtotal: num(q.subtotal),
    setupFee: num(q.setup_fee),
    minAdjustment: num(q.min_adjustment),
    total: num(q.total),
    estimatedReadyDate: strOrNull(q.estimated_ready_date)?.slice(0, 10) ?? null,
    expiresAt: strOrNull(q.expires_at),
    createdAt: strOrNull(q.created_at),
    reviewNote: strOrNull(q.review_note),
    notes: strOrNull(q.notes),
    orderToken: strOrNull(q.order_public_token) ?? strOrNull(q.order_token) ?? strOrNull(order?.public_token),
    orderNumber: numOrNull(q.order_number ?? order?.number),
    items: arr(root?.items ?? q.items)
      .map(parseQuoteItem)
      .filter((i): i is PublicQuoteItem => i !== null),
  };
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Cotización por token, SIN caché (el estado cambia: revisión, pedido, vencimiento). */
export async function getPrint3dQuote(storeId: string, token: string): Promise<PublicQuote | null> {
  if (!TOKEN_RE.test(token)) return null;
  const { data, error } = await createPublicClient().rpc("print3d_get_quote", { p_token: token });
  if (error) {
    if (error.code === "P0001" || error.code === "PGRST202" || error.code === "42883") return null;
    throw new Error(`No se pudo leer la cotización: ${error.message}`);
  }
  const quote = parsePublicQuote(data, token);
  // Una cotización de otra tienda no existe para ésta.
  if (!quote || (quote.storeId && quote.storeId !== storeId)) return null;
  return quote;
}

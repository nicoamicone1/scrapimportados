import "server-only";

import { requireAdmin } from "@/lib/auth";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import type { CategoryLite } from "@/lib/pricing";
import { scopeToRpc, type PriceScope } from "@/lib/schemas/price-update";
import { escapeLike } from "@/lib/store/utils";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Lecturas del admin de precios, promociones y cupones (agente C).
 * Sin caché, bajo RLS del admin logueado, siempre de la tienda activa
 * (`requireAdmin()` está memoizado por request).
 */

/** Zona horaria de la tienda activa (para los datetime-local de promos y cupones). */
export async function getStoreTimezone(): Promise<string> {
  try {
    const { supabase, store } = await requireAdmin();
    const { data } = await supabase.from("store_settings").select("timezone").eq("store_id", store.id).maybeSingle();
    return data?.timezone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Todas las categorías (livianas) para los selectores de alcance. */
export async function getCategoryOptions(): Promise<CategoryLite[]> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, parent_id, position")
    .eq("store_id", store.id)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, parentId: c.parent_id, position: c.position }));
}

export interface FacetOption {
  value: string;
  count: number;
}

function parseFacet(value: Json | undefined): FacetOption[] {
  if (!Array.isArray(value)) return [];
  const out: FacetOption[] = [];
  for (const item of value) {
    if (item && typeof item === "object" && !Array.isArray(item) && typeof item.value === "string") {
      out.push({ value: item.value, count: Number(item.count) || 0 });
    }
  }
  return out;
}

/** Marcas y etiquetas existentes (para "por marca" / "por etiqueta"). */
export async function getScopeFacets(): Promise<{ brands: FacetOption[]; tags: FacetOption[] }> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase.rpc("pricing_scope_facets", { p_store_id: store.id });
  if (error) throw new Error(error.message);
  const obj = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  return { brands: parseFacet(obj.brands), tags: parseFacet(obj.tags) };
}

export interface ScopeVariant {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productStatus: string;
  title: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  cost: number | null;
  stock: number;
  trackInventory: boolean;
  imageUrl: string | null;
}

/** Variantes alcanzadas por un alcance (productos no archivados). */
export async function getScopeVariants(scope: PriceScope): Promise<ScopeVariant[]> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase.rpc("pricing_scope_variants", { p_store_id: store.id, p_scope: scopeToRpc(scope) });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.variant_id,
    productId: r.product_id,
    productName: r.product_name,
    productSlug: r.product_slug,
    productStatus: r.product_status,
    title: r.variant_title,
    sku: r.sku ?? null,
    price: Number(r.price),
    compareAtPrice: r.compare_at_price === null ? null : Number(r.compare_at_price),
    cost: r.cost === null ? null : Number(r.cost),
    stock: r.stock,
    trackInventory: r.track_inventory,
    imageUrl: r.image_url ?? null,
  }));
}

export interface PickerProduct {
  id: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  price: number | null;
  status: string;
}

interface PickerRow {
  id: string;
  name: string;
  status: string;
  product_images: { url: string; position: number }[] | null;
  product_variants: { sku: string | null; price: number; position: number }[] | null;
}

function toPicker(row: PickerRow): PickerProduct {
  const img = [...(row.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
  const variant = [...(row.product_variants ?? [])].sort((a, b) => a.position - b.position)[0];
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    imageUrl: img?.url ?? null,
    sku: variant?.sku ?? null,
    price: variant ? Number(variant.price) : null,
  };
}

const PICKER_SELECT = "id, name, status, product_images(url, position), product_variants(sku, price, position)";

/** Búsqueda para el selector de productos (nombre o SKU). */
export async function searchPickerProducts(q: string, limit = 20): Promise<PickerProduct[]> {
  const { supabase, store } = await requireAdmin();
  const term = escapeLike(q.trim().slice(0, 80));
  let query = supabase
    .from("products")
    .select(PICKER_SELECT)
    .eq("store_id", store.id)
    .neq("status", "archived")
    .order("name")
    .limit(limit);
  if (term) {
    // SKU: ids de productos con variantes que matchean.
    const { data: bySku } = await supabase
      .from("product_variants")
      .select("product_id")
      .eq("store_id", store.id)
      .ilike("sku", `%${term}%`)
      .limit(50);
    const skuIds = [...new Set((bySku ?? []).map((v) => v.product_id))];
    query = skuIds.length
      ? query.or(`name.ilike.%${term}%,id.in.(${skuIds.join(",")})`)
      : query.ilike("name", `%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as PickerRow[]).map(toPicker);
}

/** Productos por id (para mostrar la selección guardada). Mantiene el orden pedido. */
export async function getPickerProductsByIds(ids: readonly string[]): Promise<PickerProduct[]> {
  if (!ids.length) return [];
  const { supabase, store } = await requireAdmin();
  const out: PickerProduct[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from("products")
      .select(PICKER_SELECT)
      .eq("store_id", store.id)
      .in("id", ids.slice(i, i + 150));
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as PickerRow[]).map(toPicker));
  }
  const byId = new Map(out.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is PickerProduct => Boolean(p));
}

export interface AdminPaymentMethod {
  id: string;
  code: string;
  name: string;
  type: string;
  discountPercent: number;
  isActive: boolean;
  position: number;
}

/** Métodos de pago (activos e inactivos). La configuración la hace H en /admin/configuracion/pagos. */
export async function getPaymentMethodsAdmin(): Promise<AdminPaymentMethod[]> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, code, name, type, discount_percent, is_active, position")
    .eq("store_id", store.id)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    type: m.type,
    discountPercent: Number(m.discount_percent),
    isActive: m.is_active,
    position: m.position,
  }));
}

// ---------------------------------------------------------------------------
// Historial de cambios masivos
// ---------------------------------------------------------------------------

export const BATCHES_PER_PAGE = 25;

export interface PriceBatchRow {
  batchId: string;
  createdAt: string;
  variantCount: number;
  createdByEmail: string | null;
  source: string;
  ruleSummary: string;
  scopeSummary: string;
  undoneAt: string | null;
  undoResult: { restored: number; skipped: number } | null;
}

function parseUndo(value: Json | null): PriceBatchRow["undoResult"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return { restored: Number(value.restored) || 0, skipped: Number(value.skipped) || 0 };
}

export async function listPriceBatches(page: number): Promise<{ rows: PriceBatchRow[]; total: number }> {
  const { supabase, store } = await requireAdmin();
  const from = (page - 1) * BATCHES_PER_PAGE;
  const { data, error, count } = await supabase
    .from("price_batch_list")
    .select("*", { count: "exact" })
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .range(from, from + BATCHES_PER_PAGE - 1);
  if (error) throw new Error(error.message);
  return {
    total: count ?? 0,
    rows: (data ?? [])
      .filter((r) => r.batch_id)
      .map((r) => ({
        batchId: r.batch_id as string,
        createdAt: r.created_at ?? "",
        variantCount: r.variant_count ?? 0,
        createdByEmail: r.created_by_email,
        source: r.source ?? "other",
        ruleSummary: r.rule_summary ?? "",
        scopeSummary: r.scope_summary ?? "",
        undoneAt: r.undone_at,
        undoResult: parseUndo(r.undo_result),
      })),
  };
}

export interface PriceChangeDetail {
  id: string;
  variantId: string;
  productId: string | null;
  productName: string;
  variantTitle: string;
  sku: string | null;
  oldPrice: number | null;
  newPrice: number | null;
  oldCompareAt: number | null;
  newCompareAt: number | null;
  /** Precio y tachado actuales (para saber si se puede deshacer). */
  currentPrice: number | null;
  currentCompareAt: number | null;
}

const num = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));

/** Detalle por variante de un batch. */
export async function getPriceBatchChanges(batchId: string): Promise<PriceChangeDetail[]> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("price_changes")
    .select(
      "id, variant_id, old_price, new_price, old_compare_at, new_compare_at, product_variants(title, sku, price, compare_at_price, product_id, products(name))",
    )
    .eq("store_id", store.id)
    .eq("batch_id", batchId)
    .order("created_at")
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => {
      const v = r.product_variants;
      return {
        id: r.id,
        variantId: r.variant_id,
        productId: v?.product_id ?? null,
        productName: v?.products?.name ?? "Variante eliminada",
        variantTitle: v?.title ?? "",
        sku: v?.sku ?? null,
        oldPrice: num(r.old_price),
        newPrice: num(r.new_price),
        oldCompareAt: num(r.old_compare_at),
        newCompareAt: num(r.new_compare_at),
        currentPrice: v ? Number(v.price) : null,
        currentCompareAt: v ? num(v.compare_at_price) : null,
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, "es"));
}

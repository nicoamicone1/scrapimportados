import "server-only";

import { requireAdmin } from "@/lib/auth";
import { MOVEMENT_REASONS, type MovementReason } from "@/lib/schemas/inventory";

import { catalogDb, type AdminInventoryRow } from "./catalog-db";
import { isUuid, searchTerm } from "./products";

/*
 * Lecturas de inventario del admin: tabla por variante, resumen y movimientos.
 */

export const INVENTORY_PER_PAGE = 50;

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export type InventoryState = "bajo" | "agotado" | "sin-seguimiento";
export type InventorySort = "stock" | "stock-desc" | "producto" | "actualizado";

export interface InventoryFilters {
  q: string;
  state: InventoryState | null;
  categoryId: string | null;
  sort: InventorySort;
  page: number;
}

export function parseInventoryFilters(params: Params): InventoryFilters {
  const state = first(params.estado);
  const sort = first(params.orden);
  const cat = first(params.categoria);
  return {
    q: first(params.q).trim().slice(0, 100),
    state: state === "bajo" || state === "agotado" || state === "sin-seguimiento" ? state : null,
    categoryId: isUuid(cat) ? cat : null,
    sort: sort === "stock" || sort === "stock-desc" || sort === "producto" ? sort : "actualizado",
    page: Math.max(1, Math.min(10_000, Number.parseInt(first(params.page), 10) || 1)),
  };
}

export async function listInventory(filters: InventoryFilters) {
  const { supabase, store } = await requireAdmin();
  const db = catalogDb(supabase);
  const from = (filters.page - 1) * INVENTORY_PER_PAGE;

  let query = db.from("admin_inventory").select("*", { count: "exact" }).eq("store_id", store.id);
  // Mismo criterio que la vista `low_stock_variants`: sólo variantes activas
  // de productos no archivados, con seguimiento y stock ≤ umbral.
  if (filters.state === "bajo") {
    query = query.eq("stock_state", "low").eq("is_active", true).neq("product_status", "archived");
  } else if (filters.state === "agotado") {
    query = query.eq("stock_state", "out").eq("is_active", true).neq("product_status", "archived");
  } else if (filters.state === "sin-seguimiento") {
    query = query.eq("stock_state", "untracked");
  }
  if (filters.categoryId) query = query.contains("category_ids", [filters.categoryId]);
  const term = searchTerm(filters.q);
  if (term) {
    const like = `*${term}*`;
    query = query.or(`product_name.ilike."${like}",sku.ilike."${like}",variant_title.ilike."${like}"`);
  }
  switch (filters.sort) {
    case "stock":
      query = query.order("stock", { ascending: true });
      break;
    case "stock-desc":
      query = query.order("stock", { ascending: false });
      break;
    case "producto":
      query = query.order("product_name").order("position");
      break;
    default:
      query = query.order("updated_at", { ascending: false });
  }
  query = query.order("variant_id").range(from, from + INVENTORY_PER_PAGE - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const items = ((data ?? []) as AdminInventoryRow[]).map((r) => ({ ...r, cost: r.cost === null ? null : Number(r.cost) }));
  return { items, total: count ?? 0, page: filters.page, perPage: INVENTORY_PER_PAGE };
}

export interface InventorySummary {
  low: number;
  out: number;
  tracked: number;
  untracked: number;
  valueAtCost: number;
  withCost: number;
}

export async function getInventorySummary(): Promise<InventorySummary> {
  const { supabase, store } = await requireAdmin();
  const head = { count: "exact" as const, head: true };
  // Stock bajo y agotadas salen de la vista `low_stock_variants` (0002).
  const [low, out, untracked, summary] = await Promise.all([
    supabase.from("low_stock_variants").select("variant_id", head).eq("store_id", store.id).gt("stock", 0),
    supabase.from("low_stock_variants").select("variant_id", head).eq("store_id", store.id).lte("stock", 0),
    supabase.from("product_variants").select("id", head).eq("store_id", store.id).eq("track_inventory", false),
    supabase.rpc("inventory_summary", { p_store_id: store.id }),
  ]);
  const s = (summary.data && typeof summary.data === "object" && !Array.isArray(summary.data) ? summary.data : {}) as Record<
    string,
    unknown
  >;
  return {
    low: low.count ?? 0,
    out: out.count ?? 0,
    tracked: Number(s.tracked ?? 0),
    untracked: untracked.count ?? 0,
    valueAtCost: Number(s.value_at_cost ?? 0),
    withCost: Number(s.with_cost ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------

export const MOVEMENTS_PER_PAGE = 50;

export interface MovementFilters {
  variantId: string | null;
  reason: MovementReason | null;
  from: string | null;
  to: string | null;
  page: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseMovementFilters(params: Params): MovementFilters {
  const variant = first(params.variante);
  const reason = first(params.motivo);
  const from = first(params.desde);
  const to = first(params.hasta);
  return {
    variantId: isUuid(variant) ? variant : null,
    reason: (MOVEMENT_REASONS as readonly string[]).includes(reason) ? (reason as MovementReason) : null,
    from: DATE_RE.test(from) ? from : null,
    to: DATE_RE.test(to) ? to : null,
    page: Math.max(1, Math.min(10_000, Number.parseInt(first(params.page), 10) || 1)),
  };
}

export interface MovementRow {
  id: string;
  created_at: string;
  delta: number;
  stock_after: number;
  reason: MovementReason;
  note: string | null;
  order: { id: string; number: number } | null;
  variant: { id: string; title: string; sku: string | null } | null;
  product: { id: string; name: string } | null;
  actor: string | null;
}

/** Fecha local AR (UTC-3) → ISO para filtrar `created_at`. */
function dayBoundary(date: string, end: boolean): string {
  return `${date}T${end ? "23:59:59.999" : "00:00:00"}-03:00`;
}

export async function listMovements(filters: MovementFilters) {
  const { supabase, store } = await requireAdmin();
  const from = (filters.page - 1) * MOVEMENTS_PER_PAGE;
  let query = supabase
    .from("inventory_movements")
    .select(
      "id, created_at, delta, stock_after, reason, note, created_by, order_id, orders(id, number), product_variants(id, title, sku, product_id, products(id, name))",
      { count: "exact" },
    )
    .eq("store_id", store.id);
  if (filters.variantId) query = query.eq("variant_id", filters.variantId);
  if (filters.reason) query = query.eq("reason", filters.reason);
  if (filters.from) query = query.gte("created_at", dayBoundary(filters.from, false));
  if (filters.to) query = query.lte("created_at", dayBoundary(filters.to, true));
  query = query.order("created_at", { ascending: false }).order("id").range(from, from + MOVEMENTS_PER_PAGE - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const actorIds = [...new Set((data ?? []).map((m) => m.created_by).filter((v): v is string => Boolean(v)))];
  const actors = new Map<string, string>();
  if (actorIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, name, email").in("id", actorIds);
    for (const p of profiles ?? []) actors.set(p.id, p.name || p.email || "Usuario");
  }

  const items: MovementRow[] = (data ?? []).map((m) => {
    const v = m.product_variants;
    return {
      id: m.id,
      created_at: m.created_at,
      delta: m.delta,
      stock_after: m.stock_after,
      reason: m.reason as MovementReason,
      note: m.note,
      order: m.orders ? { id: m.orders.id, number: m.orders.number } : null,
      variant: v ? { id: v.id, title: v.title, sku: v.sku } : null,
      product: v?.products ? { id: v.products.id, name: v.products.name } : null,
      actor: m.created_by ? (actors.get(m.created_by) ?? null) : null,
    };
  });
  return { items, total: count ?? 0, page: filters.page, perPage: MOVEMENTS_PER_PAGE };
}

/** Datos de una variante para el filtro "Movimientos de …". */
export async function getVariantLabel(variantId: string) {
  const { supabase, store } = await requireAdmin();
  const { data } = await supabase
    .from("product_variants")
    .select("id, title, sku, product_id, products(name)")
    .eq("store_id", store.id)
    .eq("id", variantId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    productId: data.product_id,
    label: data.title === "Default" ? (data.products?.name ?? "") : `${data.products?.name ?? ""} · ${data.title}`,
    sku: data.sku,
  };
}

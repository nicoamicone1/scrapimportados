import "server-only";

import { requireAdmin } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { escapeLike } from "@/lib/store/utils";

import { diffLines, type DiffLine } from "./diff";
import { zonedDayRange } from "./csv";

/* Lecturas del registro de auditoría (sin caché). */

export const AUDIT_PER_PAGE = 100;

export interface AuditFilters {
  actor?: string;
  /** Prefijo de acción: "product" → product.*, "settings.update"… */
  action?: string;
  entity?: string;
  /** YYYY-MM-DD (zona horaria de la tienda). */
  from?: string;
  to?: string;
  q?: string;
  page: number;
}

export type AuditRow = Tables<"audit_log"> & { href: string | null; lines: DiffLine[] };

/** Link al detalle de la entidad, cuando se puede armar. */
export function entityHref(entity: string | null, id: string | null): string | null {
  if (!entity) return null;
  const withId = (base: string) => (id ? `${base}/${id}` : base);
  switch (entity) {
    case "product":
      return withId("/admin/productos");
    case "order":
      return withId("/admin/pedidos");
    case "customer":
      return withId("/admin/clientes");
    case "category":
      return "/admin/categorias";
    case "promotion":
      return withId("/admin/promociones");
    case "coupon":
      return withId("/admin/cupones");
    case "page":
      return withId("/admin/paginas");
    case "import_job":
      return withId("/admin/importar");
    case "variant":
    case "inventory":
      return "/admin/inventario";
    case "price_batch":
      return "/admin/precios";
    case "shipping_zone":
    case "pickup_location":
      return "/admin/envios";
    case "menu":
      return "/admin/menus";
    case "theme":
      return "/admin/apariencia";
    case "settings":
      return "/admin/configuracion";
    case "payment_method":
      return "/admin/configuracion/pagos";
    case "redirect":
      return "/admin/configuracion/seo/redirecciones";
    case "profile":
    case "user":
      return "/admin/usuarios";
    default:
      return null;
  }
}

/** Aplica los filtros a una consulta de `audit_log` (se reusa en el export). */
export function auditFilterParams(filters: Omit<AuditFilters, "page">, timeZone: string) {
  const range = zonedDayRange(filters.from, filters.to, timeZone);
  return {
    actor: filters.actor || null,
    action: filters.action?.trim() || null,
    entity: filters.entity || null,
    fromIso: range.fromIso,
    toIso: range.toIso,
    q: filters.q?.trim() ? escapeLike(filters.q.trim()) : null,
  };
}

export async function listAudit(filters: AuditFilters, timeZone: string): Promise<{ rows: AuditRow[]; total: number }> {
  const { supabase, store } = await requireAdmin();
  const f = auditFilterParams(filters, timeZone);
  let query = supabase.from("audit_log").select("*", { count: "exact" }).eq("store_id", store.id);
  if (f.actor) query = query.eq("actor_id", f.actor);
  if (f.action) query = query.ilike("action", `${escapeLike(f.action)}%`);
  if (f.entity) query = query.eq("entity", f.entity);
  if (f.fromIso) query = query.gte("created_at", f.fromIso);
  if (f.toIso) query = query.lt("created_at", f.toIso);
  if (f.q) query = query.or(`summary.ilike.%${f.q}%,entity_id.ilike.%${f.q}%,actor_email.ilike.%${f.q}%,action.ilike.%${f.q}%`);
  const from = (filters.page - 1) * AUDIT_PER_PAGE;
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + AUDIT_PER_PAGE - 1);
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []).map((r) => ({ ...r, href: entityHref(r.entity, r.entity_id), lines: diffLines(r.diff) })),
    total: count ?? 0,
  };
}

/**
 * Opciones para los filtros: usuarios (miembros de la tienda + quien figure
 * en el registro reciente, ej. un ex miembro o soporte), prefijos de acción
 * y entidades usadas.
 */
export async function getAuditFacets(): Promise<{ actors: { id: string; label: string }[]; actions: string[]; entities: string[] }> {
  const { supabase, store } = await requireAdmin();
  const [{ data: members }, { data: recent }] = await Promise.all([
    supabase.rpc("admin_list_users", { p_store_id: store.id }),
    supabase
      .from("audit_log")
      .select("action, entity, actor_id, actor_email")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  const actions = new Set<string>();
  const entities = new Set<string>();
  const actors = new Map<string, string>();
  for (const m of members ?? []) actors.set(m.id, m.name ? `${m.name} (${m.email})` : m.email);
  for (const r of recent ?? []) {
    actions.add(r.action.split(".")[0]);
    if (r.entity) entities.add(r.entity);
    if (r.actor_id && !actors.has(r.actor_id)) actors.set(r.actor_id, r.actor_email ?? r.actor_id);
  }
  return {
    actors: [...actors].map(([id, label]) => ({ id, label })),
    actions: [...actions].sort(),
    entities: [...entities].sort(),
  };
}

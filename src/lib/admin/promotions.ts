import "server-only";

import { requireAdmin } from "@/lib/auth";
import { promotionFromRow, scheduleStatus, type Promotion, type ScheduleStatus } from "@/lib/pricing";

/*
 * Lecturas de promociones del admin (agente C). Son pocas filas: se leen
 * todas y se filtran/ordenan en memoria (el estado es calculado).
 */

export const PROMOTIONS_PER_PAGE = 50;

export const PROMO_STATUS_PARAM: Record<string, ScheduleStatus> = {
  activas: "active",
  programadas: "scheduled",
  vencidas: "expired",
  pausadas: "paused",
};

export interface AdminPromotion extends Promotion {
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

const SELECT =
  "id, name, type, value, scope, category_ids, product_ids, starts_at, ends_at, is_active, priority, badge_label, stackable, created_at, updated_at";

export async function listAllPromotions(): Promise<AdminPromotion[]> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("promotions")
    .select(SELECT)
    .eq("store_id", store.id)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const now = new Date();
  return (data ?? []).map((row) => {
    const promo = promotionFromRow(row);
    return { ...promo, status: scheduleStatus(promo, now), createdAt: row.created_at, updatedAt: row.updated_at };
  });
}

export interface PromotionListResult {
  rows: AdminPromotion[];
  total: number;
  counts: Record<ScheduleStatus | "all", number>;
}

export async function listPromotions(filters: { q: string; status: ScheduleStatus | null; page: number }): Promise<PromotionListResult> {
  const all = await listAllPromotions();
  const counts: PromotionListResult["counts"] = { all: all.length, active: 0, scheduled: 0, expired: 0, paused: 0 };
  for (const p of all) counts[p.status]++;
  const q = filters.q.trim().toLowerCase();
  const filtered = all.filter(
    (p) =>
      (!filters.status || p.status === filters.status) &&
      (!q || p.name.toLowerCase().includes(q) || (p.badgeLabel ?? "").toLowerCase().includes(q)),
  );
  // Activas primero, luego programadas, pausadas y vencidas.
  const order: Record<ScheduleStatus, number> = { active: 0, scheduled: 1, paused: 2, expired: 3 };
  filtered.sort((a, b) => order[a.status] - order[b.status] || b.priority - a.priority || a.name.localeCompare(b.name, "es"));
  const from = (filters.page - 1) * PROMOTIONS_PER_PAGE;
  return { rows: filtered.slice(from, from + PROMOTIONS_PER_PAGE), total: filtered.length, counts };
}

export async function getPromotion(id: string): Promise<AdminPromotion | null> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase.from("promotions").select(SELECT).eq("store_id", store.id).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const promo = promotionFromRow(data);
  return { ...promo, status: scheduleStatus(promo), createdAt: data.created_at, updatedAt: data.updated_at };
}

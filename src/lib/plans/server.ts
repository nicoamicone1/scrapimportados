import "server-only";

import type { AdminContext } from "@/lib/auth";

import { assertLimit, type LimitKey } from "./index";

type CountableLimit = Exclude<LimitKey, "images_per_product" | "storage_mb">;

/**
 * Uso actual de un límite en la tienda activa (lo que cuenta contra el plan):
 * - products: productos no archivados.
 * - pages: todas las páginas (incluye la home).
 * - staff: miembros activos + invitaciones pendientes.
 * - promotions / coupons: todas (activas o no).
 * - import_jobs_month: importaciones creadas desde el 1° del mes (UTC).
 */
export async function countUsage(ctx: Pick<AdminContext, "supabase" | "store">, key: CountableLimit): Promise<number> {
  const { supabase, store } = ctx;
  const head = { count: "exact" as const, head: true };
  switch (key) {
    case "products": {
      const { count } = await supabase.from("products").select("id", head).eq("store_id", store.id).neq("status", "archived");
      return count ?? 0;
    }
    case "pages": {
      const { count } = await supabase.from("pages").select("id", head).eq("store_id", store.id);
      return count ?? 0;
    }
    case "staff": {
      const [members, invites] = await Promise.all([
        supabase.from("store_members").select("user_id", head).eq("store_id", store.id).eq("is_active", true),
        supabase.from("store_invites").select("id", head).eq("store_id", store.id).gt("expires_at", new Date().toISOString()),
      ]);
      return (members.count ?? 0) + (invites.count ?? 0);
    }
    case "promotions": {
      const { count } = await supabase.from("promotions").select("id", head).eq("store_id", store.id);
      return count ?? 0;
    }
    case "coupons": {
      const { count } = await supabase.from("coupons").select("id", head).eq("store_id", store.id);
      return count ?? 0;
    }
    case "import_jobs_month": {
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const { count } = await supabase.from("import_jobs").select("id", head).eq("store_id", store.id).gte("created_at", from);
      return count ?? 0;
    }
  }
}

/** `assertLimit` contando el uso actual en la base: `await assertUsage(ctx, "products", 3)`. */
export async function assertUsage(ctx: AdminContext, key: CountableLimit, adding = 1): Promise<void> {
  if (ctx.plan.limits[key] === null) return;
  assertLimit(ctx, key, await countUsage(ctx, key), adding);
}

/** Fotos de un producto contra `images_per_product`. */
export async function assertProductImages(ctx: AdminContext, productId: string | null, adding: number): Promise<void> {
  if (ctx.plan.limits.images_per_product === null || adding <= 0) return;
  let current = 0;
  if (productId) {
    const { count } = await ctx.supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("store_id", ctx.store.id)
      .eq("product_id", productId);
    current = count ?? 0;
  }
  assertLimit(ctx, "images_per_product", current, adding);
}

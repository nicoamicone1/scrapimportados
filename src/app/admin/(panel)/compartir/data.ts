import "server-only";

import { catalogDb } from "@/lib/admin/catalog-db";
import { flattenTree } from "@/lib/admin/category-tree";
import type { AdminContext } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { storeUrl } from "@/lib/tenant/urls";

import { freeShippingThreshold } from "@/components/admin/share/messages";
import type { ShareTarget } from "@/components/admin/share/ShareTargetPicker";

/** Lecturas de `/admin/compartir` (tienda activa, sesión del usuario). */

export interface ShareData {
  currency: string;
  maintenance: boolean;
  activeProducts: number;
  transferDiscount: number;
  freeShippingFrom: number | null;
  sharedDone: boolean;
  products: ShareTarget[];
  categories: ShareTarget[];
}

type ProductRow = { id: string; name: string; slug: string; min_price: number | null; max_price: number | null; image_url: string | null };

export function toProductTarget(ctx: Pick<AdminContext, "store">, p: ProductRow, currency: string): ShareTarget {
  const min = p.min_price === null ? null : Number(p.min_price);
  const max = p.max_price === null ? null : Number(p.max_price);
  const price = min === null ? null : `${max !== null && max > min ? "desde " : ""}${formatMoney(min, { currency })}`;
  return {
    id: p.id,
    kind: "product",
    name: p.name,
    url: storeUrl(ctx.store, `/producto/${p.slug}`),
    path: `/producto/${p.slug}`,
    price: min,
    maxPrice: max,
    priceText: price,
    imageUrl: p.image_url,
  };
}

export const PRODUCT_COLUMNS = "id, name, slug, min_price, max_price, image_url";

export async function getShareData(ctx: Pick<AdminContext, "supabase" | "store">): Promise<ShareData> {
  const { supabase, store } = ctx;
  const [settings, methods, zones, active, products, categories] = await Promise.all([
    supabase.from("store_settings").select("currency, maintenance").eq("store_id", store.id).maybeSingle(),
    supabase.from("payment_methods").select("discount_percent").eq("store_id", store.id).eq("is_active", true).eq("type", "transfer"),
    supabase.from("shipping_zones").select("free_over").eq("store_id", store.id).eq("is_active", true),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("status", "active"),
    catalogDb(supabase)
      .from("admin_products")
      .select(PRODUCT_COLUMNS)
      .eq("store_id", store.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("categories")
      .select("id, name, slug, parent_id, position")
      .eq("store_id", store.id)
      .eq("is_visible", true)
      .order("position")
      .order("name")
      .limit(200),
  ]);

  const currency = settings.data?.currency || "ARS";
  const maintenanceRaw = settings.data?.maintenance;
  const maintenance = Boolean(
    maintenanceRaw && typeof maintenanceRaw === "object" && !Array.isArray(maintenanceRaw) && maintenanceRaw.enabled === true,
  );
  const transferDiscount = (methods.data ?? []).reduce((max, m) => Math.max(max, Number(m.discount_percent) || 0), 0);
  // Una categoría visible con padre oculto queda en la raíz (flattenTree).
  const tree = flattenTree(categories.data ?? []);
  const trail: string[] = [];
  const onboarding = store.onboarding && typeof store.onboarding === "object" && !Array.isArray(store.onboarding) ? store.onboarding : {};

  return {
    currency,
    maintenance,
    activeProducts: active.count ?? 0,
    transferDiscount,
    freeShippingFrom: freeShippingThreshold(zones.data ?? []),
    sharedDone: onboarding.shared === true,
    products: (products.data ?? []).map((p) => toProductTarget(ctx, p, currency)),
    categories: tree.map(({ item: c, depth }) => {
      trail.length = depth;
      trail.push(c.name);
      return {
        id: c.id,
        kind: "category" as const,
        name: c.name,
        label: trail.join(" › "),
        url: storeUrl(store, `/categoria/${c.slug}`),
        path: `/categoria/${c.slug}`,
        price: null,
        maxPrice: null,
        priceText: null,
        imageUrl: null,
      };
    }),
  };
}

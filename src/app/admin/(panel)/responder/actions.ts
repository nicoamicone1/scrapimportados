"use server";

import { z } from "zod";

import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { catalogDb } from "@/lib/admin/catalog-db";
import { searchTerm } from "@/lib/admin/products";
import type { ReplyProductHit } from "@/lib/admin/replies";
import { requireAdmin } from "@/lib/auth";
import { applyPromotions, type Promotion } from "@/lib/pricing";
import { fetchActivePromotionsFresh } from "@/lib/store/promotions";
import { storeUrl } from "@/lib/tenant/urls";

const schema = z.object({ q: z.string().max(80) });
const LIMIT = 8;

/**
 * Busca productos (nombre, SKU o slug) de la tienda activa para armar una
 * respuesta. Sin texto, los últimos editados. Excluye archivados; los
 * borradores vuelven con `status: "draft"` para avisar que el link no anda.
 * Los precios son los de la tienda: con las promociones vigentes aplicadas.
 */
export async function searchProductsForReply(input: { q: string }): Promise<ActionResult<ReplyProductHit[]>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail("Búsqueda inválida.");
    const { supabase, store } = ctx;

    let query = catalogDb(supabase)
      .from("admin_products")
      .select("id, name, slug, status, image_url, category_ids")
      .eq("store_id", store.id)
      .neq("status", "archived");
    const term = searchTerm(parsed.data.q);
    if (term) {
      const like = `*${term}*`;
      query = query.or(`name.ilike."${like}",skus.ilike."${like}",slug.ilike."${like}"`).order("name");
    } else {
      query = query.order("updated_at", { ascending: false });
    }
    const { data: products, error } = await query.limit(LIMIT);
    if (error) return fail("No se pudieron buscar los productos. Probá de nuevo.");
    if (!products?.length) return ok([]);

    const ids = products.map((p) => p.id);
    const [variants, promotions] = await Promise.all([
      supabase
        .from("product_variants")
        .select("id, product_id, title, sku, price, compare_at_price, stock, track_inventory, allow_backorder, position")
        .eq("store_id", store.id)
        .eq("is_active", true)
        .in("product_id", ids)
        .order("position"),
      // Sin promociones (o sin acceso) se responde con el precio de lista.
      fetchActivePromotionsFresh(store.id).catch((): Promotion[] => []),
    ]);
    if (variants.error) return fail("No se pudieron leer las variantes. Probá de nuevo.");

    const now = new Date();
    return ok(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        url: storeUrl(store, `/producto/${p.slug}`),
        imageUrl: p.image_url,
        variants: (variants.data ?? [])
          .filter((v) => v.product_id === p.id)
          .map((v) => {
            const price = applyPromotions(
              { id: v.id, price: Number(v.price), compareAtPrice: v.compare_at_price === null ? null : Number(v.compare_at_price) },
              { id: p.id, categoryIds: p.category_ids ?? [] },
              promotions,
              now,
            );
            return {
              id: v.id,
              title: v.title === "Default" ? null : v.title,
              sku: v.sku,
              price: price.price,
              compareAt: price.compareAt,
              stock: v.stock,
              trackInventory: v.track_inventory,
              allowBackorder: v.allow_backorder,
            };
          }),
      })),
    );
  });
}

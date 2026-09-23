"use server";

import { z } from "zod";

import type { ShareTarget } from "@/components/admin/share/ShareTargetPicker";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { catalogDb } from "@/lib/admin/catalog-db";
import { searchTerm } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth";

import { PRODUCT_COLUMNS, toProductTarget } from "./data";

const schema = z.object({ q: z.string().max(80) });

/** Busca productos activos para armar su link (máx. 10; sin texto, los últimos editados). */
export async function searchShareProducts(input: { q: string }): Promise<ActionResult<ShareTarget[]>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail("Búsqueda inválida.");
    const { supabase, store } = ctx;

    let query = catalogDb(supabase).from("admin_products").select(PRODUCT_COLUMNS).eq("store_id", store.id).eq("status", "active");
    const term = searchTerm(parsed.data.q);
    if (term) {
      const like = `*${term}*`;
      query = query.or(`name.ilike."${like}",skus.ilike."${like}",slug.ilike."${like}"`).order("name");
    } else {
      query = query.order("updated_at", { ascending: false });
    }
    const [{ data, error }, settings] = await Promise.all([
      query.limit(10),
      supabase.from("store_settings").select("currency").eq("store_id", store.id).maybeSingle(),
    ]);
    if (error) return fail("No se pudieron buscar los productos. Probá de nuevo.");
    const currency = settings.data?.currency || "ARS";
    return ok((data ?? []).map((p) => toProductTarget(ctx, p, currency)));
  });
}

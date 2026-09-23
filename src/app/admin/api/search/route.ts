import type { NextRequest } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { asObject, asString, escapeLike } from "@/lib/store/utils";

export const dynamic = "force-dynamic";

export interface PaletteSearchResult {
  products: { id: string; name: string; sku: string | null; image: string | null; status: string | null }[];
  orders: { id: string; number: number; name: string; email: string; total: number; status: string; payment_status: string }[];
}

/**
 * GET /admin/api/search?q= — búsqueda en vivo del command palette:
 * productos por nombre o SKU y pedidos por número (#1043) o email/nombre,
 * siempre de la tienda activa del panel.
 */
export async function GET(request: NextRequest) {
  let supabase;
  let storeId: string;
  try {
    const ctx = await requireAdmin();
    supabase = ctx.supabase;
    storeId = ctx.store.id;
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const raw = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const empty: PaletteSearchResult = { products: [], orders: [] };
  if (raw.length < 2 && !/^#?\d+$/.test(raw)) return Response.json(empty);

  const term = escapeLike(raw.replace(/^#/, ""));
  const numberMatch = /^#?(\d{1,12})$/.exec(raw);

  const productsQuery = supabase
    .from("admin_products")
    .select("id, name, skus, image_url, status")
    .eq("store_id", storeId)
    .or(`name.ilike.%${term}%,skus.ilike.%${term}%`)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(6);

  const ordersBase = supabase
    .from("orders")
    .select("id, number, customer, total, status, payment_status")
    .eq("store_id", storeId);
  const ordersQuery = numberMatch
    ? ordersBase.eq("number", Number(numberMatch[1])).limit(1)
    : raw.length >= 3
      ? ordersBase
          .or(`customer->>email.ilike.%${term}%,customer->>name.ilike.%${term}%`)
          .order("created_at", { ascending: false })
          .limit(6)
      : null;

  const [products, orders] = await Promise.all([numberMatch && raw.startsWith("#") ? null : productsQuery, ordersQuery]);

  const result: PaletteSearchResult = {
    products: (products?.data ?? []).map((p) => ({
      id: p.id ?? "",
      name: p.name ?? "",
      sku: p.skus?.split(/[,\s]+/).find(Boolean) ?? null,
      image: p.image_url,
      status: p.status,
    })),
    orders: (orders?.data ?? []).map((o) => {
      const c = asObject(o.customer);
      return {
        id: o.id,
        number: o.number,
        name: asString(c.name),
        email: asString(c.email),
        total: Number(o.total),
        status: o.status,
        payment_status: o.payment_status,
      };
    }),
  };
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}

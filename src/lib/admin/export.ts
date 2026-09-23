import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { asArray, asObject, asString, escapeLike } from "@/lib/store/utils";

import { CSV_BOM, csvLine, isoDate, zonedDayRange, type CsvValue } from "./csv";

/*
 * Exportaciones CSV del admin (P0-04). Cada export es un generador de filas
 * que pagina la base; `csvStream()` lo convierte en un `ReadableStream`
 * (UTF-8 con BOM, separador `,`, fechas ISO). Lo sirve
 * src/app/admin/api/export/[file]/route.ts. Toda consulta filtra por la
 * tienda activa (`storeId`).
 */

export const EXPORTS = {
  productos: {
    label: "Productos y variantes",
    header: [
      "handle", "name", "status", "categories", "tags", "brand",
      "option1_name", "option1_value", "option2_name", "option2_value", "option3_name", "option3_value",
      "sku", "barcode", "price", "compare_at_price", "cost", "stock", "weight_grams",
      "image_url", "seo_title", "seo_description", "description_html",
    ],
  },
  inventario: {
    label: "Inventario",
    header: ["sku", "product", "variant", "stock", "threshold", "track_inventory", "cost"],
  },
  pedidos: {
    label: "Pedidos",
    header: [
      "number", "created_at", "status", "payment_status", "payment_method", "customer_name", "email", "phone", "doc",
      "subtotal", "promo_total", "coupon_code", "coupon_discount", "payment_discount", "shipping_cost", "total",
      "fulfillment", "shipping_zone", "address", "city", "province", "postal_code", "items_count", "tracking",
    ],
  },
  clientes: {
    label: "Clientes",
    header: ["email", "name", "phone", "doc", "orders_count", "total_spent", "tags", "created_at"],
  },
  auditoria: {
    label: "Auditoría",
    header: ["created_at", "actor_email", "action", "entity", "entity_id", "summary", "diff"],
  },
} as const;

export type ExportKind = keyof typeof EXPORTS;

export function isExportKind(value: string): value is ExportKind {
  return Object.hasOwn(EXPORTS, value);
}

const PAGE = 500;
const MAX_ROWS = 1000; // límite de filas por request de PostgREST

/** Trae todas las filas de una consulta paginando de a 1000. */
async function fetchAll<T>(run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += MAX_ROWS) {
    const { data, error } = await run(from, from + MAX_ROWS - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < MAX_ROWS) return out;
  }
}

/** Convierte un generador de filas en un stream CSV. */
export function csvStream(header: readonly string[], rows: AsyncIterable<CsvValue[]>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = rows[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(CSV_BOM + csvLine(header)));
    },
    async pull(controller) {
      try {
        let chunk = "";
        for (let i = 0; i < 200; i++) {
          const next = await iterator.next();
          if (next.done) {
            if (chunk) controller.enqueue(encoder.encode(chunk));
            controller.close();
            return;
          }
          chunk += csvLine(next.value);
        }
        controller.enqueue(encoder.encode(chunk));
      } catch (err) {
        console.error("[export]", err);
        controller.error(err);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

// ---------------------------------------------------------------------
// Productos: una fila por variante (formato del importador CSV de G)
// ---------------------------------------------------------------------

interface CategoryNode {
  id: string;
  name: string;
  parent_id: string | null;
}

function categoryPath(id: string, byId: Map<string, CategoryNode>): string {
  const names: string[] = [];
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name.replace(/[>|]/g, " ").trim());
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return names.join(" > ");
}

function optionNames(options: Json): string[] {
  return asArray(options)
    .map((o) => asString(asObject(o).name).trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function* productRows(supabase: ServerSupabase, storeId: string): AsyncGenerator<CsvValue[]> {
  const categories = await fetchAll<CategoryNode>((a, b) =>
    supabase.from("categories").select("id, name, parent_id").eq("store_id", storeId).order("id").range(a, b),
  );
  const catById = new Map(categories.map((c) => [c.id, c]));

  for (let offset = 0; ; offset += 100) {
    const { data: products, error } = await supabase
      .from("products")
      .select("id, slug, name, status, tags, brand, options, seo, description_html")
      .eq("store_id", storeId)
      .order("created_at")
      .order("id")
      .range(offset, offset + 99);
    if (error) throw new Error(error.message);
    if (!products?.length) return;

    const ids = products.map((p) => p.id);
    const [variants, images, links] = await Promise.all([
      fetchAll((a, b) =>
        supabase
          .from("product_variants")
          .select("id, product_id, option_values, sku, barcode, price, compare_at_price, cost, stock, weight_grams, image_id, position")
          .eq("store_id", storeId)
          .in("product_id", ids)
          .order("product_id")
          .order("position")
          .range(a, b),
      ),
      fetchAll((a, b) =>
        supabase
          .from("product_images")
          .select("id, product_id, url, position")
          .eq("store_id", storeId)
          .in("product_id", ids)
          .order("position")
          .range(a, b),
      ),
      fetchAll((a, b) =>
        supabase
          .from("product_categories")
          .select("product_id, category_id, position")
          .eq("store_id", storeId)
          .in("product_id", ids)
          .order("position")
          .range(a, b),
      ),
    ]);

    const imageById = new Map(images.map((i) => [i.id, i.url]));
    const firstImage = new Map<string, string>();
    for (const img of images) if (!firstImage.has(img.product_id)) firstImage.set(img.product_id, img.url);
    const catsByProduct = new Map<string, string[]>();
    for (const l of links) {
      const path = categoryPath(l.category_id, catById);
      if (path) (catsByProduct.get(l.product_id) ?? catsByProduct.set(l.product_id, []).get(l.product_id)!).push(path);
    }
    const variantsByProduct = new Map<string, typeof variants>();
    for (const v of variants) (variantsByProduct.get(v.product_id) ?? variantsByProduct.set(v.product_id, []).get(v.product_id)!).push(v);

    for (const p of products) {
      const names = optionNames(p.options);
      const seo = asObject(p.seo);
      const common = {
        categories: (catsByProduct.get(p.id) ?? []).join("|"),
        tags: (p.tags ?? []).map((t) => t.replace(/\|/g, " ")).join("|"),
      };
      for (const v of variantsByProduct.get(p.id) ?? []) {
        const values = asObject(v.option_values);
        const opt = (i: number): [string, string] => (names[i] ? [names[i], asString(values[names[i]])] : ["", ""]);
        const [o1n, o1v] = opt(0);
        const [o2n, o2v] = opt(1);
        const [o3n, o3v] = opt(2);
        yield [
          p.slug, p.name, p.status, common.categories, common.tags, p.brand,
          o1n, o1v, o2n, o2v, o3n, o3v,
          v.sku, v.barcode, Number(v.price), v.compare_at_price === null ? null : Number(v.compare_at_price),
          v.cost === null ? null : Number(v.cost), v.stock, v.weight_grams,
          (v.image_id ? imageById.get(v.image_id) : null) ?? firstImage.get(p.id) ?? null,
          asString(seo.title), asString(seo.description), p.description_html,
        ];
      }
    }
    if (products.length < 100) return;
  }
}

// ---------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------

export async function* inventoryRows(supabase: ServerSupabase, storeId: string): AsyncGenerator<CsvValue[]> {
  for (let offset = 0; ; offset += MAX_ROWS) {
    const { data, error } = await supabase
      .from("admin_inventory")
      .select("sku, product_name, variant_title, stock, threshold, track_inventory, cost, product_id, position")
      .eq("store_id", storeId)
      .order("product_name")
      .order("product_id")
      .order("position")
      .range(offset, offset + MAX_ROWS - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      yield [r.sku, r.product_name, r.variant_title, r.stock, r.threshold, r.track_inventory, r.cost === null ? null : Number(r.cost)];
    }
    if (!data || data.length < MAX_ROWS) return;
  }
}

// ---------------------------------------------------------------------
// Pedidos (columnas contables)
// ---------------------------------------------------------------------

export interface OrderExportFilters {
  from?: string | null;
  to?: string | null;
  status?: string | null;
  payment?: string | null;
}

const ORDER_STATUSES = ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "partial", "refunded"];

export async function* orderRows(
  supabase: ServerSupabase,
  storeId: string,
  filters: OrderExportFilters,
  timeZone: string,
): AsyncGenerator<CsvValue[]> {
  const { data: methods } = await supabase.from("payment_methods").select("code, name").eq("store_id", storeId);
  const methodName = new Map((methods ?? []).map((m) => [m.code, m.name]));
  const range = zonedDayRange(filters.from, filters.to, timeZone);

  for (let offset = 0; ; offset += PAGE) {
    let query = supabase
      .from("orders")
      .select(
        "number, created_at, status, payment_status, payment_method_code, customer, subtotal, promo_total, coupon_code, coupon_discount, payment_discount, shipping_cost, total, fulfillment, shipping_zone_name, shipping_address, tracking_carrier, tracking_number, tracking_url, order_items(qty)",
      )
      .eq("store_id", storeId);
    if (range.fromIso) query = query.gte("created_at", range.fromIso);
    if (range.toIso) query = query.lt("created_at", range.toIso);
    if (filters.status && ORDER_STATUSES.includes(filters.status)) query = query.eq("status", filters.status);
    if (filters.payment && PAYMENT_STATUSES.includes(filters.payment)) query = query.eq("payment_status", filters.payment);
    const { data, error } = await query.order("number").range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);

    for (const o of data ?? []) {
      const c = asObject(o.customer);
      const a = asObject(o.shipping_address);
      const street = [asString(a.street), asString(a.number)].filter(Boolean).join(" ");
      const address = [street, asString(a.floor)].filter(Boolean).join(", ");
      const itemsCount = (o.order_items ?? []).reduce((acc, i) => acc + (i.qty ?? 0), 0);
      const tracking = [o.tracking_carrier, o.tracking_number].filter(Boolean).join(" ") || o.tracking_url || "";
      yield [
        o.number, isoDate(o.created_at), o.status, o.payment_status,
        o.payment_method_code ? (methodName.get(o.payment_method_code) ?? o.payment_method_code) : "",
        asString(c.name), asString(c.email), asString(c.phone), asString(c.doc) || asString(c.doc_number),
        Number(o.subtotal), Number(o.promo_total), o.coupon_code, Number(o.coupon_discount), Number(o.payment_discount),
        Number(o.shipping_cost), Number(o.total),
        o.fulfillment, o.shipping_zone_name, address, asString(a.city), asString(a.province), asString(a.postal_code),
        itemsCount, tracking,
      ];
    }
    if (!data || data.length < PAGE) return;
  }
}

// ---------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------

export async function* customerRows(supabase: ServerSupabase, storeId: string): AsyncGenerator<CsvValue[]> {
  for (let offset = 0; ; offset += MAX_ROWS) {
    const { data, error } = await supabase
      .from("customers")
      .select("email, name, phone, doc_number, orders_count, total_spent, tags, created_at, id")
      .eq("store_id", storeId)
      .order("created_at")
      .order("id")
      .range(offset, offset + MAX_ROWS - 1);
    if (error) throw new Error(error.message);
    for (const c of data ?? []) {
      yield [c.email, c.name, c.phone, c.doc_number, c.orders_count, Number(c.total_spent), (c.tags ?? []).join("|"), isoDate(c.created_at)];
    }
    if (!data || data.length < MAX_ROWS) return;
  }
}

// ---------------------------------------------------------------------
// Auditoría (mismos filtros que la pantalla)
// ---------------------------------------------------------------------

export interface AuditExportFilters {
  actor?: string | null;
  action?: string | null;
  entity?: string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
}

export async function* auditRows(
  supabase: ServerSupabase,
  storeId: string,
  filters: AuditExportFilters,
  timeZone: string,
): AsyncGenerator<CsvValue[]> {
  const range = zonedDayRange(filters.from, filters.to, timeZone);
  const q = filters.q?.trim() ? escapeLike(filters.q.trim()) : null;
  for (let offset = 0; ; offset += MAX_ROWS) {
    let query = supabase
      .from("audit_log")
      .select("created_at, actor_email, action, entity, entity_id, summary, diff")
      .eq("store_id", storeId);
    if (filters.actor) query = query.eq("actor_id", filters.actor);
    if (filters.action?.trim()) query = query.ilike("action", `${escapeLike(filters.action.trim())}%`);
    if (filters.entity) query = query.eq("entity", filters.entity);
    if (range.fromIso) query = query.gte("created_at", range.fromIso);
    if (range.toIso) query = query.lt("created_at", range.toIso);
    if (q) query = query.or(`summary.ilike.%${q}%,entity_id.ilike.%${q}%,actor_email.ilike.%${q}%,action.ilike.%${q}%`);
    const { data, error } = await query.order("created_at", { ascending: false }).range(offset, offset + MAX_ROWS - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      yield [isoDate(r.created_at), r.actor_email, r.action, r.entity, r.entity_id, r.summary, r.diff === null ? "" : JSON.stringify(r.diff)];
    }
    if (!data || data.length < MAX_ROWS) return;
  }
}

import "server-only";

import { after } from "next/server";

import type { AdminContext } from "@/lib/auth";
import { emailEnabled, isEmail, maskEmails, sendEmail, storeFrom, wasSent, warnEmailDisabled } from "@/lib/email/send";
import { stockBackEmail } from "@/lib/email/templates/stock";
import { applyPromotions, type Promotion } from "@/lib/pricing";
import { fetchActivePromotionsFresh } from "@/lib/store/promotions";
import { waLink } from "@/lib/store/whatsapp";
import { storeUrl } from "@/lib/tenant/urls";
import { parseTheme } from "@/lib/theme";

import {
  deliverNotices,
  isMissingSchema,
  MAX_ALERT_EMAILS_PER_RUN,
  pickAlertsToNotify,
  variantLabel,
  type AlertNotice,
  type AlertVariant,
  type PendingAlert,
} from "./inventory-alerts-utils";

/*
 * "Avisame cuando haya stock" del lado del admin (migración 0016).
 *
 * `afterStockIncrease(ctx, variantIds, productIds?)` es el ÚNICO punto de
 * disparo: lo llaman las actions del panel que pueden dejar una variante con
 * stock (ajuste manual y masivo en Inventario, ficha y edición rápida en
 * Productos, cancelación de pedidos). Acepta ids de variante y/o de producto
 * (la ficha pasa el producto: si regeneró variantes, las nuevas no tienen
 * avisos propios pero sí los del producto). Después de responder (`after()`):
 *   1. lee los avisos pendientes de esos productos y el estado actual de
 *      sus variantes;
 *   2. decide a quién avisar (`pickAlertsToNotify`, puro y testeado), como
 *      mucho MAX_ALERT_EMAILS_PER_RUN mails; el resto sale en la próxima
 *      reposición;
 *   3. por cada mail (`deliverNotices`): marca `notified_at` con un update
 *      condicional (`notified_at is null`: si dos ajustes corren a la vez,
 *      cada aviso lo reclama uno solo), lo manda desde `storeFrom(tienda)` y,
 *      si Resend lo rechaza, lo vuelve a dejar pendiente.
 * Corre como el admin logueado (RLS de 0016). Sin `RESEND_API_KEY` no hace
 * nada (los avisos quedan pendientes); sin la migración, tampoco.
 *
 * NO disparan avisos: el vencimiento automático de pedidos impagos del cron
 * (`expire_unpaid_orders`, devuelve stock en SQL) ni los cambios hechos
 * directo en la base. Esos avisos salen en la próxima reposición desde el panel.
 */

type Ctx = Pick<AdminContext, "supabase" | "store">;

let warnedMissing = false;
function warnMissing(): void {
  if (warnedMissing) return;
  warnedMissing = true;
  console.info("[stock-alerts] Falta aplicar la migración 0016: los avisos de stock están apagados.");
}

/** Agenda el envío para después de responder (fuera de un request, en segundo plano). */
function schedule(task: () => Promise<void>): void {
  const run = async () => {
    try {
      await task();
    } catch (err) {
      console.error("[stock-alerts]", maskEmails(err instanceof Error ? err.message : String(err)));
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * Después de subir (o poder haber subido) stock: avisa a quienes lo estaban
 * esperando. No lanza, no demora la respuesta y no hace nada si no hay avisos.
 */
export function afterStockIncrease(
  ctx: Ctx,
  variantIds: readonly (string | null | undefined)[],
  productIds: readonly (string | null | undefined)[] = [],
): void {
  const clean = (list: readonly (string | null | undefined)[]) => [...new Set(list.filter((id): id is string => Boolean(id)))];
  const variants = clean(variantIds);
  const products = clean(productIds);
  if (!variants.length && !products.length) return;
  if (!emailEnabled()) {
    warnEmailDisabled();
    return;
  }
  schedule(() => notifyBackInStock(ctx, variants, products));
}

interface VariantRow {
  id: string;
  product_id: string;
  title: string;
  price: number | string;
  compare_at_price: number | string | null;
  stock: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  is_active: boolean;
  position: number;
  products: { id: string; name: string; slug: string; status: string } | null;
}

function toAlertVariant(v: VariantRow): AlertVariant | null {
  if (!v.products) return null;
  return {
    id: v.id,
    productId: v.product_id,
    title: v.title,
    price: Number(v.price),
    compareAtPrice: v.compare_at_price === null ? null : Number(v.compare_at_price),
    stock: v.stock,
    trackInventory: v.track_inventory,
    allowBackorder: v.allow_backorder,
    isActive: v.is_active,
    position: v.position,
    product: v.products,
  };
}

async function notifyBackInStock(ctx: Ctx, variantIds: string[], directProductIds: string[]): Promise<void> {
  const { supabase, store } = ctx;

  // Productos de las variantes tocadas (más los que llegaron directo).
  let touched: { product_id: string }[] = [];
  if (variantIds.length) {
    const { data, error: touchedError } = await supabase
      .from("product_variants")
      .select("product_id")
      .eq("store_id", store.id)
      .in("id", variantIds);
    if (touchedError) throw new Error(touchedError.message);
    touched = data ?? [];
  }
  const productIds = [...new Set([...directProductIds, ...touched.map((v) => v.product_id)])];
  if (!productIds.length) return;

  // Avisos pendientes de esos productos (por variante y por producto).
  const { data: alertRows, error: alertsError } = await supabase
    .from("stock_alerts")
    .select("id, email, product_id, variant_id, created_at")
    .eq("store_id", store.id)
    .is("notified_at", null)
    .in("product_id", productIds)
    .order("created_at")
    .limit(2000);
  if (alertsError) {
    if (isMissingSchema(alertsError)) return warnMissing();
    throw new Error(alertsError.message);
  }
  if (!alertRows?.length) return;
  const alerts: PendingAlert[] = alertRows.map((a) => ({
    id: a.id,
    email: a.email,
    productId: a.product_id,
    variantId: a.variant_id,
    createdAt: a.created_at,
  }));

  // Estado actual de TODAS las variantes de esos productos.
  const { data: variantRows, error: variantsError } = await supabase
    .from("product_variants")
    .select(
      "id, product_id, title, price, compare_at_price, stock, track_inventory, allow_backorder, is_active, position, products(id, name, slug, status)",
    )
    .eq("store_id", store.id)
    .in("product_id", [...new Set(alerts.map((a) => a.productId))]);
  if (variantsError) throw new Error(variantsError.message);
  const variants = ((variantRows ?? []) as VariantRow[]).map(toAlertVariant).filter((v): v is AlertVariant => v !== null);

  const notices = pickAlertsToNotify(alerts, variants, MAX_ALERT_EMAILS_PER_RUN).filter((n) => isEmail(n.email));
  if (!notices.length) return;

  const context = await loadMailContext(ctx, [...new Set(notices.map((n) => n.product.id))]);
  const result = await deliverNotices(notices, {
    // Reclamar: sólo se avisa lo que este proceso marcó.
    claim: async (ids) => {
      const { data, error } = await supabase
        .from("stock_alerts")
        .update({ notified_at: new Date().toISOString() })
        .eq("store_id", store.id)
        .is("notified_at", null)
        .in("id", ids)
        .select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.id);
    },
    send: (notice) => sendNotice(ctx, notice, context),
    // Los que Resend no aceptó vuelven a quedar pendientes (salen en la próxima reposición).
    release: async (ids) => {
      const { error } = await supabase.from("stock_alerts").update({ notified_at: null }).eq("store_id", store.id).in("id", ids);
      if (error) console.error("[stock-alerts] No se pudieron liberar avisos:", error.message);
    },
  });
  if (result.failed) console.error(`[stock-alerts] ${store.slug}: ${result.failed} mail(s) no salieron; quedan pendientes.`);
}

interface MailContext {
  name: string;
  logoUrl: string | null;
  primary: string | null;
  primaryText: string | null;
  contactEmail: string | null;
  whatsappPhone: string | null;
  currency: string;
  locale: string;
  promotions: Promotion[];
  categoriesByProduct: Map<string, string[]>;
}

async function loadMailContext(ctx: Ctx, productIds: string[]): Promise<MailContext> {
  const { supabase, store } = ctx;
  const [settingsRes, categoriesRes, promotions] = await Promise.all([
    supabase
      .from("store_settings")
      .select("name, logo_url, theme, contact_email, whatsapp_phone, currency, locale")
      .eq("store_id", store.id)
      .maybeSingle(),
    supabase.from("product_categories").select("product_id, category_id").eq("store_id", store.id).in("product_id", productIds),
    fetchActivePromotionsFresh(store.id).catch((err: unknown) => {
      console.error("[stock-alerts] promociones:", err instanceof Error ? err.message : String(err));
      return [] as Promotion[];
    }),
  ]);
  const s = settingsRes.data;
  const theme = s ? parseTheme(s.theme) : null;
  const categoriesByProduct = new Map<string, string[]>();
  for (const row of categoriesRes.data ?? []) {
    const list = categoriesByProduct.get(row.product_id) ?? [];
    list.push(row.category_id);
    categoriesByProduct.set(row.product_id, list);
  }
  const contact = s?.contact_email?.trim() ?? "";
  return {
    name: s?.name || store.name,
    logoUrl: s?.logo_url ?? null,
    primary: theme?.colors.primary ?? null,
    primaryText: theme?.colors.primaryText ?? null,
    contactEmail: isEmail(contact) ? contact : null,
    whatsappPhone: s?.whatsapp_phone ?? null,
    currency: s?.currency || "ARS",
    locale: s?.locale || "es-AR",
    promotions,
    categoriesByProduct,
  };
}

async function sendNotice(ctx: Ctx, notice: AlertNotice, mail: MailContext): Promise<boolean> {
  const { store } = ctx;
  const product = notice.product;
  const single = notice.variants.length === 1 ? notice.variants[0] : null;
  const productUrl = storeUrl(store, `/producto/${product.slug}${single && variantLabel(single.title) ? `?variant=${single.id}` : ""}`);
  const pricingProduct = { id: product.id, categoryIds: mail.categoriesByProduct.get(product.id) ?? [] };

  const content = stockBackEmail(
    {
      productName: product.name,
      productUrl,
      currency: mail.currency,
      locale: mail.locale,
      variants: notice.variants.map((v) => {
        const priced = applyPromotions({ id: v.id, price: v.price, compareAtPrice: v.compareAtPrice }, pricingProduct, mail.promotions);
        return { label: variantLabel(v.title), price: priced.price, compareAt: priced.compareAt };
      }),
    },
    {
      name: mail.name,
      url: storeUrl(store),
      logoUrl: mail.logoUrl,
      primary: mail.primary,
      primaryText: mail.primaryText,
      contactEmail: mail.contactEmail,
      whatsappUrl: mail.whatsappPhone ? waLink(mail.whatsappPhone, `Hola. Consulto por ${product.name}. ${productUrl}`) : null,
    },
  );

  const result = await sendEmail({
    to: notice.email,
    from: storeFrom(mail.name),
    replyTo: mail.contactEmail,
    ...content,
    tags: [
      { name: "kind", value: "stock_back" },
      { name: "store", value: store.slug },
    ],
    idempotencyKey: `stock-back/${[...notice.alertIds].sort()[0]}`,
  });
  return wasSent(result);
}

// ---------------------------------------------------------------------------
// Bandeja del admin (/admin/inventario/avisos)
// ---------------------------------------------------------------------------

export const STOCK_ALERTS_PER_PAGE = 50;

export type StockAlertFilter = "pendientes" | "avisados" | "todos";

export interface StockAlertRow {
  id: string;
  email: string;
  createdAt: string;
  notifiedAt: string | null;
  product: { id: string; name: string } | null;
  variant: { id: string; title: string; sku: string | null; stock: number; trackInventory: boolean } | null;
}

export interface StockAlertList {
  /** false: la migración 0016 todavía no se aplicó. */
  available: boolean;
  items: StockAlertRow[];
  total: number;
  pending: number;
}

export async function listStockAlerts(ctx: Ctx, filter: StockAlertFilter, page: number): Promise<StockAlertList> {
  const { supabase, store } = ctx;
  const from = (page - 1) * STOCK_ALERTS_PER_PAGE;
  let query = supabase
    .from("stock_alerts")
    .select(
      "id, email, created_at, notified_at, products(id, name), product_variants(id, title, sku, stock, track_inventory)",
      { count: "exact" },
    )
    .eq("store_id", store.id);
  if (filter === "pendientes") query = query.is("notified_at", null);
  else if (filter === "avisados") query = query.not("notified_at", "is", null);
  query =
    filter === "avisados"
      ? query.order("notified_at", { ascending: false })
      : query.order("created_at", { ascending: false });
  const [list, pending] = await Promise.all([
    query.order("id").range(from, from + STOCK_ALERTS_PER_PAGE - 1),
    supabase.from("stock_alerts").select("id", { count: "exact", head: true }).eq("store_id", store.id).is("notified_at", null),
  ]);
  if (list.error) {
    if (isMissingSchema(list.error)) return { available: false, items: [], total: 0, pending: 0 };
    throw new Error(list.error.message);
  }
  const items: StockAlertRow[] = (list.data ?? []).map((a) => ({
    id: a.id,
    email: a.email,
    createdAt: a.created_at,
    notifiedAt: a.notified_at,
    product: a.products ? { id: a.products.id, name: a.products.name } : null,
    variant: a.product_variants
      ? {
          id: a.product_variants.id,
          title: a.product_variants.title,
          sku: a.product_variants.sku,
          stock: a.product_variants.stock,
          trackInventory: a.product_variants.track_inventory,
        }
      : null,
  }));
  return { available: true, items, total: list.count ?? 0, pending: pending.count ?? 0 };
}

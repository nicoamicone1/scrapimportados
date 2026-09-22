/**
 * Validación del carrito (localStorage) contra datos frescos de la DB.
 * Puro: lo usan la server action del checkout y el carrito (client).
 */

export interface CartLineInput {
  variantId: string;
  name: string;
  variantTitle?: string | null;
  unitPrice: number;
  qty: number;
}

/** Estado actual de la variante en la DB (`null`/ausente = ya no existe o no se vende). */
export interface FreshVariant {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantTitle: string | null;
  sku: string | null;
  image: string | null;
  price: number;
  compareAtPrice: number | null;
  categoryIds: string[];
  vatPercent: number | null;
  stock: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  /** Variante activa de un producto activo. */
  active: boolean;
}

export type CartIssue =
  | { type: "removed"; variantId: string; name: string }
  | { type: "out_of_stock"; variantId: string; name: string }
  | { type: "qty_reduced"; variantId: string; name: string; from: number; to: number }
  | { type: "price_changed"; variantId: string; name: string; from: number; to: number };

export interface CartPatch {
  variantId: string;
  /** 0 = quitar. */
  qty: number;
  unitPrice: number;
  maxQty: number | null;
  name: string;
  variantTitle: string | null;
  sku: string | null;
  image: string | null;
  slug: string;
  categoryIds: string[];
  vatPercent?: number | null;
}

/** Tope de unidades por stock (`null` = sin tope). */
export function stockLimit(v: Pick<FreshVariant, "stock" | "trackInventory" | "allowBackorder">): number | null {
  return v.trackInventory && !v.allowBackorder ? Math.max(v.stock, 0) : null;
}

export function describeIssue(issue: CartIssue): string {
  switch (issue.type) {
    case "removed":
      return `«${issue.name}» ya no está disponible y lo sacamos del carrito.`;
    case "out_of_stock":
      return `«${issue.name}» se quedó sin stock y lo sacamos del carrito.`;
    case "qty_reduced":
      return `De «${issue.name}» quedan ${issue.to}: ajustamos la cantidad (tenías ${issue.from}).`;
    case "price_changed":
      return `«${issue.name}» cambió de precio.`;
  }
}

/**
 * Compara el carrito con la DB: quita lo que no existe o no tiene stock,
 * acota cantidades y actualiza precios. Devuelve los parches a aplicar y los
 * avisos para mostrar.
 */
export function validateCart(items: CartLineInput[], fresh: Map<string, FreshVariant>): { patches: CartPatch[]; issues: CartIssue[] } {
  const patches: CartPatch[] = [];
  const issues: CartIssue[] = [];
  for (const item of items) {
    const v = fresh.get(item.variantId);
    const label = item.variantTitle ? `${item.name} (${item.variantTitle})` : item.name;
    if (!v || !v.active) {
      issues.push({ type: "removed", variantId: item.variantId, name: label });
      patches.push({
        variantId: item.variantId,
        qty: 0,
        unitPrice: item.unitPrice,
        maxQty: null,
        name: item.name,
        variantTitle: item.variantTitle ?? null,
        sku: null,
        image: null,
        slug: "",
        categoryIds: [],
      });
      continue;
    }
    const limit = stockLimit(v);
    let qty = item.qty;
    if (limit !== null && limit <= 0) {
      issues.push({ type: "out_of_stock", variantId: item.variantId, name: label });
      qty = 0;
    } else if (limit !== null && qty > limit) {
      issues.push({ type: "qty_reduced", variantId: item.variantId, name: label, from: qty, to: limit });
      qty = limit;
    }
    if (qty > 0 && Math.abs(v.price - item.unitPrice) >= 0.01) {
      issues.push({ type: "price_changed", variantId: item.variantId, name: label, from: item.unitPrice, to: v.price });
    }
    patches.push({
      variantId: item.variantId,
      qty,
      unitPrice: v.price,
      maxQty: limit,
      name: v.name,
      variantTitle: v.variantTitle,
      sku: v.sku,
      image: v.image,
      slug: v.slug,
      categoryIds: v.categoryIds,
      vatPercent: v.vatPercent,
    });
  }
  return { patches, issues };
}

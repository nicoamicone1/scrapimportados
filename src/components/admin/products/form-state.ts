import type { AdminProductDetail, ProductSummary } from "@/lib/admin/products";
import { cleanOptions, type OptionValues } from "@/lib/admin/variant-matrix";
import type { ProductInput, ProductStatus } from "@/lib/schemas/product";

/*
 * Estado del form de producto (client) y conversión desde/hacia el detalle
 * del server y el payload de `saveProduct`.
 */

export interface FormOption {
  key: string;
  name: string;
  /** Nombre con el que la opción está aplicada en las variantes (sobrevive a borrar el input). */
  applied: string;
  values: string[];
}

export interface FormVariant {
  key: string;
  id: string | null;
  title: string;
  option_values: OptionValues;
  sku: string;
  barcode: string;
  /** Texto de los inputs numéricos (se parsean al guardar). */
  price: string;
  compare_at_price: string;
  cost: string;
  stock: string;
  stock_original: number | null;
  track_inventory: boolean;
  allow_backorder: boolean;
  low_stock_threshold: string;
  weight_grams: string;
  image_id: string | null;
  is_active: boolean;
}

/** Tramo de precio por cantidad (texto de los inputs; se parsea al guardar). */
export interface FormTier {
  key: string;
  min_qty: string;
  price: string;
}

export interface FormSpec {
  key: string;
  label: string;
  value: string;
}

export interface ProductFormState {
  name: string;
  slug: string;
  description_html: string;
  short_description: string;
  status: ProductStatus;
  brand: string;
  tags: string[];
  featured: boolean;
  vat_percent: string;
  options: FormOption[];
  variants: FormVariant[];
  category_ids: string[];
  specs: FormSpec[];
  related: ProductSummary[];
  seo: { title: string; description: string };
  stock_note: string;
  /** Precios por cantidad. Opcional: los borradores locales de antes no lo tienen. */
  price_tiers?: FormTier[];
}

let counter = 0;
export const newKey = (prefix = "k") => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

export function emptyVariant(template?: Partial<FormVariant>): FormVariant {
  return {
    key: newKey("v"),
    id: null,
    title: "Default",
    option_values: {},
    sku: "",
    barcode: "",
    price: template?.price ?? "",
    compare_at_price: template?.compare_at_price ?? "",
    cost: template?.cost ?? "",
    stock: "0",
    stock_original: null,
    track_inventory: template?.track_inventory ?? true,
    allow_backorder: template?.allow_backorder ?? false,
    low_stock_threshold: template?.low_stock_threshold ?? "",
    weight_grams: template?.weight_grams ?? "",
    image_id: null,
    is_active: true,
  };
}

export function emptyFormState(): ProductFormState {
  return {
    name: "",
    slug: "",
    description_html: "",
    short_description: "",
    status: "draft",
    brand: "",
    tags: [],
    featured: false,
    vat_percent: "",
    options: [],
    variants: [emptyVariant()],
    category_ids: [],
    specs: [],
    related: [],
    seo: { title: "", description: "" },
    stock_note: "",
    price_tiers: [],
  };
}

export function formStateFromProduct(p: AdminProductDetail): ProductFormState {
  return {
    name: p.name,
    slug: p.slug,
    description_html: p.description_html,
    short_description: p.short_description ?? "",
    status: p.status,
    brand: p.brand ?? "",
    tags: p.tags,
    featured: p.featured,
    vat_percent: p.vat_percent === null ? "" : String(p.vat_percent),
    options: p.options.map((o) => ({ key: newKey("o"), name: o.name, applied: o.name, values: o.values })),
    variants: p.variants.map((v) => ({
      key: v.id,
      id: v.id,
      title: v.title,
      option_values: v.option_values,
      sku: v.sku ?? "",
      barcode: v.barcode ?? "",
      price: num(v.price),
      compare_at_price: num(v.compare_at_price),
      cost: num(v.cost),
      stock: String(v.stock),
      stock_original: v.stock,
      track_inventory: v.track_inventory,
      allow_backorder: v.allow_backorder,
      low_stock_threshold: v.low_stock_threshold === null ? "" : String(v.low_stock_threshold),
      weight_grams: v.weight_grams === null ? "" : String(v.weight_grams),
      image_id: v.image_id,
      is_active: v.is_active,
    })),
    category_ids: p.category_ids,
    specs: p.specs.map((s) => ({ key: newKey("s"), ...s })),
    related: p.related,
    seo: p.seo,
    stock_note: "",
    price_tiers: (p.price_tiers ?? []).map((t) => ({ key: newKey("t"), min_qty: String(t.minQty), price: num(t.price) })),
  };
}

/** "12.500,50" / "12500.5" → número; "" → null; basura → NaN. */
export function parseDecimal(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  // Sólo se toleran "$", espacios y separadores; cualquier otra letra es un error.
  if (/[^\d,.\-$\s]/.test(t)) return Number.NaN;
  const clean = t.replace(/[^\d,.-]/g, "");
  if (!/\d/.test(clean)) return Number.NaN;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/\.(?=\d{3}(?:\D|$))/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

export function parseInteger(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  return /^-?\d+$/.test(t) ? Number.parseInt(t, 10) : Number.NaN;
}

/** Estado → payload de `saveProduct`. Los NaN los rechaza zod con su mensaje. */
export function toPayload(state: ProductFormState, id: string | null): ProductInput {
  const options = cleanOptions(state.options);
  return {
    id,
    name: state.name,
    slug: state.slug,
    description_html: state.description_html,
    short_description: state.short_description,
    status: state.status,
    brand: state.brand,
    tags: state.tags,
    featured: state.featured,
    vat_percent: state.vat_percent === "" ? null : Number(state.vat_percent),
    options,
    variants: state.variants.map((v) => ({
      id: v.id,
      title: v.title,
      option_values: v.option_values,
      sku: v.sku,
      barcode: v.barcode,
      price: parseDecimal(v.price) ?? Number.NaN,
      compare_at_price: parseDecimal(v.compare_at_price),
      cost: parseDecimal(v.cost),
      stock: v.track_inventory ? (parseInteger(v.stock) ?? 0) : (v.stock_original ?? 0),
      stock_original: v.stock_original,
      track_inventory: v.track_inventory,
      allow_backorder: v.allow_backorder,
      low_stock_threshold: parseInteger(v.low_stock_threshold),
      weight_grams: parseInteger(v.weight_grams),
      image_id: v.image_id,
      is_active: v.is_active,
    })),
    category_ids: state.category_ids,
    specs: state.specs.map((s) => ({ label: s.label, value: s.value })).filter((s) => s.label.trim() || s.value.trim()),
    related_ids: state.related.map((r) => r.id),
    price_tiers: (state.price_tiers ?? [])
      .filter((t) => t.min_qty.trim() || t.price.trim())
      .map((t) => ({ min_qty: parseInteger(t.min_qty) ?? Number.NaN, price: parseDecimal(t.price) ?? Number.NaN })),
    seo: state.seo,
    stock_note: state.stock_note,
  };
}

/** Comparación estable para "Cambios sin guardar" (ignora keys internas). */
export function snapshot(state: ProductFormState): string {
  return JSON.stringify({
    ...state,
    options: state.options.map((o) => ({ name: o.name, values: o.values })),
    variants: state.variants.map((v) => Object.fromEntries(Object.entries(v).filter(([k]) => k !== "key"))),
    specs: state.specs.map((s) => ({ label: s.label, value: s.value })),
    related: state.related.map((r) => r.id),
    stock_note: "",
    price_tiers: (state.price_tiers ?? []).map((t) => ({ min_qty: t.min_qty, price: t.price })),
  });
}

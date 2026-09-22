/**
 * CSV del importador (P0-04): parser (papaparse, `,` o `;`, UTF-8 con BOM),
 * validación por fila y diff contra la base. Dos modos:
 *  - "update": actualizar por SKU (precio, tachado, costo, stock, estado).
 *  - "create": crear productos con el formato de exportación de H
 *    (una fila por variante, agrupadas por `handle`).
 * Puro: sin acceso a la base (el diff recibe las variantes existentes).
 */
import Papa from "papaparse";

import { slugify } from "@/lib/slug";

import { parseArsAmount } from "./text";
import type { NormalizedCategory, NormalizedProduct, NormalizedVariant } from "./types";

// ---------------------------------------------------------------------------
// Columnas
// ---------------------------------------------------------------------------

import { CSV_CREATE_COLUMNS, CSV_UPDATE_COLUMNS } from "./columns";

export { CSV_CREATE_COLUMNS, CSV_UPDATE_COLUMNS };

/** Alias aceptados en el encabezado (planillas en castellano). */
const HEADER_ALIASES: Record<string, string> = {
  slug: "handle",
  nombre: "name",
  titulo: "name",
  title: "name",
  estado: "status",
  categorias: "categories",
  categoria: "categories",
  etiquetas: "tags",
  codigo: "sku",
  codigo_barras: "barcode",
  ean: "barcode",
  precio: "price",
  precio_tachado: "compare_at_price",
  precio_anterior: "compare_at_price",
  precio_de_lista: "compare_at_price",
  costo: "cost",
  existencias: "stock",
  cantidad: "stock",
  peso: "weight_grams",
  peso_gramos: "weight_grams",
  imagen: "image_url",
  imagen_url: "image_url",
  image: "image_url",
  images: "image_url",
  marca: "brand",
  descripcion: "description_html",
  descripcion_html: "description_html",
  description: "description_html",
  seo_titulo: "seo_title",
  seo_descripcion: "seo_description",
};

export function normalizeHeader(h: string): string {
  const key = h
    .replace(/^﻿/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return HEADER_ALIASES[key] ?? key;
}

export type CsvRecord = Record<string, string>;

export interface ParsedCsv {
  headers: string[];
  records: CsvRecord[];
  delimiter: string;
  errors: string[];
}

/** Parsea el texto del archivo. Detecta `,`, `;` o tabulador; quita el BOM. */
export function parseCsvText(text: string): ParsedCsv {
  const clean = text.replace(/^﻿/, "");
  const result = Papa.parse<CsvRecord>(clean, {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
    transformHeader: normalizeHeader,
    transform: (v) => v.trim(),
  });
  const errors = result.errors
    .filter((e) => e.code !== "UndetectableDelimiter")
    .slice(0, 20)
    .map((e) => (typeof e.row === "number" ? `Fila ${e.row + 2}: ${e.message}` : e.message));
  return {
    headers: result.meta.fields ?? [],
    records: result.data,
    delimiter: result.meta.delimiter,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

export type ProductStatus = "draft" | "active" | "archived";

const STATUS_ALIASES: Record<string, ProductStatus> = {
  draft: "draft",
  borrador: "draft",
  active: "active",
  activo: "active",
  activa: "active",
  publicado: "active",
  archived: "archived",
  archivado: "archived",
  archivada: "archived",
};

export function parseStatus(v: string | undefined): ProductStatus | null | undefined {
  if (v === undefined || v === "") return undefined;
  return STATUS_ALIASES[v.trim().toLowerCase()] ?? null;
}

/** Monto: vacío → undefined (no cambia); inválido → NaN. */
function parseAmountCell(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  const n = parseArsAmount(v);
  return n === null ? Number.NaN : n;
}

function parseIntCell(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  const n = parseArsAmount(v);
  return n === null || !Number.isInteger(n) ? Number.NaN : n;
}

// ---------------------------------------------------------------------------
// Modo "actualizar por SKU"
// ---------------------------------------------------------------------------

export interface CsvUpdateRow {
  /** Línea del archivo (el encabezado es la 1). */
  line: number;
  sku: string;
  price?: number;
  /** `null` = quitar el precio tachado (celda "0"). */
  compare_at_price?: number | null;
  cost?: number | null;
  stock?: number;
  status?: ProductStatus;
}

export interface CsvRowError {
  line: number;
  key: string;
  message: string;
}

export function missingColumns(headers: string[], mode: "update" | "create"): string[] {
  const required = mode === "update" ? ["sku"] : ["name", "price"];
  return required.filter((c) => !headers.includes(c));
}

export function parseUpdateRows(records: CsvRecord[]): { rows: CsvUpdateRow[]; errors: CsvRowError[] } {
  const rows: CsvUpdateRow[] = [];
  const errors: CsvRowError[] = [];
  const seen = new Map<string, number>();

  records.forEach((r, i) => {
    const line = i + 2;
    const sku = (r.sku ?? "").trim();
    if (!sku) {
      errors.push({ line, key: "", message: "Falta el SKU." });
      return;
    }
    const prev = seen.get(sku.toLowerCase());
    if (prev) {
      errors.push({ line, key: sku, message: `SKU repetido en el archivo (ya está en la fila ${prev}).` });
      return;
    }
    seen.set(sku.toLowerCase(), line);

    const row: CsvUpdateRow = { line, sku };
    const problems: string[] = [];

    const price = parseAmountCell(r.price);
    if (price !== undefined) {
      if (Number.isNaN(price) || price < 0) problems.push("Precio inválido.");
      else row.price = price;
    }
    const compare = parseAmountCell(r.compare_at_price);
    if (compare !== undefined) {
      if (Number.isNaN(compare) || compare < 0) problems.push("Precio tachado inválido.");
      else row.compare_at_price = compare === 0 ? null : compare;
    }
    const cost = parseAmountCell(r.cost);
    if (cost !== undefined) {
      if (Number.isNaN(cost) || cost < 0) problems.push("Costo inválido.");
      else row.cost = cost === 0 ? null : cost;
    }
    const stock = parseIntCell(r.stock);
    if (stock !== undefined) {
      if (Number.isNaN(stock) || stock < 0) problems.push("Stock inválido (tiene que ser un entero ≥ 0).");
      else row.stock = stock;
    }
    const status = parseStatus(r.status);
    if (status === null) problems.push("Estado inválido (usá draft, active o archived).");
    else if (status) row.status = status;

    if (problems.length) errors.push({ line, key: sku, message: problems.join(" ") });
    else rows.push(row);
  });

  return { rows, errors };
}

/** Variante existente (lo que el diff necesita de la base). */
export interface ExistingVariant {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_status: string;
  variant_title: string;
  sku: string;
  price: number;
  compare_at_price: number | null;
  cost: number | null;
  stock: number;
  track_inventory: boolean;
}

export type ChangeField = "price" | "compare_at_price" | "cost" | "stock" | "status";

export interface FieldChange {
  field: ChangeField;
  from: number | string | null;
  to: number | string | null;
}

export interface CsvUpdateDiff {
  line: number;
  sku: string;
  kind: "change" | "same" | "error";
  error?: string;
  variant?: ExistingVariant;
  changes: FieldChange[];
  /** Valores pedidos (se re-evalúan contra la base al aplicar). */
  target?: Omit<CsvUpdateRow, "line" | "sku">;
}

const eqMoney = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : Math.abs(a - b) < 0.005;

/** Diff por fila contra las variantes existentes (indexadas por SKU en minúsculas). */
export function diffUpdateRows(
  rows: CsvUpdateRow[],
  errors: CsvRowError[],
  existing: Map<string, ExistingVariant[]>,
): CsvUpdateDiff[] {
  const out: CsvUpdateDiff[] = errors.map((e) => ({ line: e.line, sku: e.key, kind: "error" as const, error: e.message, changes: [] }));

  for (const row of rows) {
    const matches = existing.get(row.sku.toLowerCase()) ?? [];
    if (matches.length === 0) {
      out.push({ line: row.line, sku: row.sku, kind: "error", error: "SKU no encontrado.", changes: [] });
      continue;
    }
    if (matches.length > 1) {
      out.push({ line: row.line, sku: row.sku, kind: "error", error: `El SKU está en ${matches.length} variantes de la tienda.`, changes: [] });
      continue;
    }
    const v = matches[0];
    const changes: FieldChange[] = [];
    const nextPrice = row.price ?? v.price;
    let nextCompare = row.compare_at_price !== undefined ? row.compare_at_price : v.compare_at_price;
    // Un tachado menor o igual al precio no tiene sentido: se quita.
    if (nextCompare !== null && nextCompare <= nextPrice) nextCompare = null;

    if (row.price !== undefined && !eqMoney(row.price, v.price)) changes.push({ field: "price", from: v.price, to: row.price });
    if (!eqMoney(nextCompare, v.compare_at_price)) changes.push({ field: "compare_at_price", from: v.compare_at_price, to: nextCompare });
    if (row.cost !== undefined && !eqMoney(row.cost, v.cost)) changes.push({ field: "cost", from: v.cost, to: row.cost });
    if (row.stock !== undefined && row.stock !== v.stock) changes.push({ field: "stock", from: v.stock, to: row.stock });
    if (row.status !== undefined && row.status !== v.product_status) changes.push({ field: "status", from: v.product_status, to: row.status });

    const target: CsvUpdateDiff["target"] = {};
    if (row.price !== undefined) target.price = row.price;
    if (row.compare_at_price !== undefined || nextCompare !== v.compare_at_price) target.compare_at_price = nextCompare;
    if (row.cost !== undefined) target.cost = row.cost;
    if (row.stock !== undefined) target.stock = row.stock;
    if (row.status !== undefined) target.status = row.status;

    out.push({ line: row.line, sku: row.sku, kind: changes.length ? "change" : "same", variant: v, changes, target });
  }
  return out.sort((a, b) => a.line - b.line);
}

// ---------------------------------------------------------------------------
// Modo "crear productos"
// ---------------------------------------------------------------------------

export interface CsvCreateGroup {
  handle: string;
  lines: number[];
  product: NormalizedProduct;
}

/** "Hogar > Cocina | Ofertas" → hojas + ancestros con external_id por ruta. */
export function parseCategoryPaths(value: string | undefined): { leaf: NormalizedCategory[]; defs: NormalizedCategory[] } {
  const leaf: NormalizedCategory[] = [];
  const defs = new Map<string, NormalizedCategory>();
  for (const path of (value ?? "").split("|")) {
    const parts = path.split(">").map((s) => s.trim()).filter(Boolean).slice(0, 4);
    if (!parts.length) continue;
    const slugs: string[] = [];
    let parent: string | null = null;
    parts.forEach((name, i) => {
      slugs.push(slugify(name));
      const cat: NormalizedCategory = { externalId: `path:${slugs.join("/")}`, name, slug: slugify(name), parentExternalId: parent };
      if (i === parts.length - 1) {
        if (!leaf.some((l) => l.externalId === cat.externalId)) leaf.push(cat);
      } else {
        defs.set(cat.externalId, cat);
      }
      parent = cat.externalId;
    });
  }
  return { leaf, defs: [...defs.values()] };
}

function splitList(v: string | undefined): string[] {
  return (v ?? "")
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Agrupa las filas por `handle` (o slug del nombre) y arma un producto
 * normalizado por grupo. La primera fila del grupo trae los datos del
 * producto; cada fila es una variante.
 */
export function parseCreateRows(records: CsvRecord[]): { groups: CsvCreateGroup[]; errors: CsvRowError[] } {
  const errors: CsvRowError[] = [];
  const groups = new Map<string, CsvCreateGroup>();
  const optionOrder = new Map<string, string[]>();

  records.forEach((r, i) => {
    const line = i + 2;
    const handle = slugify(r.handle || r.name || "");
    if (!handle) {
      errors.push({ line, key: "", message: "Falta el nombre (o el handle)." });
      return;
    }
    let group = groups.get(handle);
    const problems: string[] = [];

    if (!group) {
      if (!r.name) {
        errors.push({ line, key: handle, message: "La primera fila de cada producto necesita el nombre." });
        return;
      }
      const status = parseStatus(r.status);
      if (status === null) problems.push("Estado inválido (usá draft, active o archived).");
      const cats = parseCategoryPaths(r.categories);
      const product: NormalizedProduct = {
        externalId: handle,
        name: r.name.trim(),
        slug: handle,
        description_html: r.description_html || null,
        short_description: null,
        brand: r.brand || null,
        tags: splitList(r.tags),
        categories: cats.leaf,
        categoryDefs: cats.defs,
        images: [],
        options: [],
        variants: [],
        source_url: "",
        status: status ?? null,
        seo: r.seo_title || r.seo_description ? { title: r.seo_title || undefined, description: r.seo_description || undefined } : null,
      };
      group = { handle, lines: [], product };
      optionOrder.set(handle, [r.option1_name, r.option2_name, r.option3_name].map((s) => (s ?? "").trim()).filter(Boolean));
    }

    const optionNames = optionOrder.get(handle) ?? [];
    const optionValues: Record<string, string> = {};
    [r.option1_value, r.option2_value, r.option3_value].forEach((val, idx) => {
      const n = optionNames[idx];
      const v = (val ?? "").trim();
      if (n && v) optionValues[n] = v;
      else if (n && !v) problems.push(`Falta el valor de "${n}".`);
      else if (!n && v) problems.push(`Hay un valor en la opción ${idx + 1} sin nombre de opción.`);
    });

    const price = parseAmountCell(r.price);
    if (price === undefined || Number.isNaN(price) || price < 0) problems.push("Precio inválido.");
    const compare = parseAmountCell(r.compare_at_price);
    if (compare !== undefined && (Number.isNaN(compare) || compare < 0)) problems.push("Precio tachado inválido.");
    const cost = parseAmountCell(r.cost);
    if (cost !== undefined && (Number.isNaN(cost) || cost < 0)) problems.push("Costo inválido.");
    const stock = parseIntCell(r.stock);
    if (stock !== undefined && (Number.isNaN(stock) || stock < 0)) problems.push("Stock inválido.");
    const weight = parseIntCell(r.weight_grams);
    if (weight !== undefined && (Number.isNaN(weight) || weight < 0)) problems.push("Peso inválido.");

    const key = JSON.stringify(optionValues);
    if (group.product.variants.some((v) => JSON.stringify(v.option_values) === key)) {
      problems.push(optionNames.length ? "Combinación de opciones repetida." : "Producto sin opciones con más de una fila.");
    }

    if (problems.length) {
      errors.push({ line, key: handle, message: problems.join(" ") });
      if (!groups.has(handle) && group.product.variants.length === 0) {
        // La primera fila falló: igual registramos el grupo para que las
        // siguientes filas no creen otro producto con el mismo handle.
        groups.set(handle, group);
      }
      return;
    }

    const images = splitList(r.image_url).filter((u) => /^https?:\/\//i.test(u));
    for (const img of images) if (!group.product.images.includes(img)) group.product.images.push(img);

    const variant: NormalizedVariant = {
      externalId: r.sku || null,
      sku: r.sku || null,
      barcode: r.barcode || null,
      title: Object.values(optionValues).join(" / ") || "Default",
      option_values: optionValues,
      price: price!,
      compare_at_price: compare !== undefined && compare > 0 && compare > price! ? compare : null,
      cost: cost !== undefined && cost > 0 ? cost : null,
      stock: stock ?? 0,
      in_stock: (stock ?? 0) > 0,
      image_url: images[0] ?? null,
      weight_grams: weight ?? null,
    };
    group.product.variants.push(variant);
    group.lines.push(line);
    groups.set(handle, group);
  });

  // Opciones del producto a partir de las variantes válidas.
  for (const [handle, g] of groups) {
    const names = optionOrder.get(handle) ?? [];
    g.product.options = names.map((n) => ({
      name: n,
      values: [...new Set(g.product.variants.map((v) => v.option_values[n]).filter((x): x is string => Boolean(x)))],
    }));
    g.product.in_stock = g.product.variants.some((v) => (v.stock ?? 0) > 0);
  }

  return { groups: [...groups.values()].filter((g) => g.product.variants.length > 0), errors };
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c);
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

/** Plantilla descargable (UTF-8 con BOM para que Excel respete los acentos). */
export function csvTemplate(mode: "update" | "create"): string {
  if (mode === "update") {
    return (
      "﻿" +
      toCsv([
        [...CSV_UPDATE_COLUMNS],
        ["ABC-001", "12990", "15990", "8000", "25", "active"],
        ["ABC-002", "", "", "", "0", ""],
      ]) +
      "\r\n"
    );
  }
  return (
    "﻿" +
    toCsv([
      [...CSV_CREATE_COLUMNS],
      ["remera-lisa", "Remera lisa", "draft", "Indumentaria > Remeras", "algodón|verano", "Color", "Negro", "Talle", "M", "", "", "REM-NEG-M", "", "9990", "12990", "4500", "10", "200", "https://ejemplo.com/remera-negra.jpg", "", "", "Mi marca", "<p>Remera de algodón peinado.</p>"],
      ["remera-lisa", "", "", "", "", "", "Negro", "", "L", "", "", "REM-NEG-L", "", "9990", "12990", "4500", "8", "210", "", "", "", "", ""],
      ["taza-ceramica", "Taza de cerámica", "active", "Hogar > Cocina", "", "", "", "", "", "", "", "TAZ-001", "7791234567890", "5500", "", "2100", "30", "350", "https://ejemplo.com/taza.jpg", "Taza de cerámica 350 ml", "Taza apta microondas.", "", ""],
    ]) +
    "\r\n"
  );
}

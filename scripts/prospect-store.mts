/**
 * Tienda de una prospecta en minutos, desde un JSON mínimo (nombre, precio,
 * talles, colores) que se completa desde el celular mirando su Instagram.
 * Formato: data/prospectos/README.md. Pasos del fundador: docs/DEMO-PROSPECTA.md.
 *
 *   npx tsx scripts/prospect-store.mts data/prospectos/mycloset.json --dry-run   # valida y lista, sin tocar la base
 *   SEED_EMAIL=… SEED_PASSWORD=… npx tsx scripts/prospect-store.mts data/prospectos/mycloset.json
 *   … --force-images   # vuelve a generar las imágenes de ejemplo (borra también las fotos que hayas subido)
 *
 * 1. Convierte el JSON mínimo al formato completo de seed-from-json
 *    (data/SCHEMA.md): variantes color × talle con `stock` por variante
 *    (default 3), categorías (la del JSON o inferida del nombre), colores con
 *    el mapa de la demo de ropa (data/demo-ropa.json) más los que falten.
 * 2. Tienda y configuración con scripts/lib/store-setup.mts, lo mismo que la
 *    demo de ropa: create_store() rubro moda (preset atelier), WhatsApp de
 *    ella, transferencia con su descuento, envío CABA o «A coordinar», retiro
 *    opcional y Pro activo si SEED_EMAIL es admin de plataforma.
 * 3. Catálogo con seedCatalog() e imágenes de ejemplo (SVG por color).
 *    Re-correrlo no pisa el stock ni las imágenes: es seguro sumar productos
 *    al JSON y volver a correrlo.
 * 4. Imprime la URL de la tienda, el link del panel y el mensaje para mandarle.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { isValidE164, normalizePhone } from "../src/lib/schemas/settings";
import { slugify } from "../src/lib/slug";
import { presetForKind, STORE_KINDS } from "../src/lib/tenant/kinds";
import { STORE_SLUG_MESSAGES, storeSlugProblem } from "../src/lib/tenant/slug";
import { platformOrigin, storeUrl } from "../src/lib/tenant/urls";

import { applySettings, ensureStore, keepPro, parseStoreConfig, printStorePlan, type StoreConfigInput } from "./lib/store-setup.mjs";
import { cliFlags, connect, isEntry, log, money, parseSource, printPlan, seedCatalog, type SourceFile } from "./seed-from-json.mjs";

// ---------------------------------------------------------------------------
// Formato mínimo (data/prospectos/README.md)
// ---------------------------------------------------------------------------

const DEFAULT_STOCK = 3;
const MAX_PRODUCTS = 25;
/** Con 3 por variante no aparece «quedan 3» en todo; después del pedido de prueba, la variante dice «Quedan 2». */
const LOW_STOCK_THRESHOLD = 2;
const CABA_SHIPPING_COST = 4500;
const DEMO_FILE = "data/demo-ropa.json";
/** El de los ejemplos (data/demo-ropa.json, ejemplo-mycloset.json). */
const PLACEHOLDER_WHATSAPP = "5491100000000";

/** "28000", "28.000" o "$ 28.000" → 28000. */
const price = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/,\d{1,2}$/, "").replace(/\D/g, "")) || undefined : v),
    z
      .number({ required_error: `Falta ${label}.`, invalid_type_error: `${label}: poné un número (ej. 28000).` })
      .int(`${label}: sin centavos.`)
      .positive(`${label}: tiene que ser mayor a 0.`)
      .max(99_999_999, `${label}: es demasiado alto.`),
  );

const textList = z
  .array(z.union([z.string(), z.number()]).transform((v) => String(v).trim()))
  .transform((list) => list.filter(Boolean))
  .default([]);

const PRODUCT_KEYS = ["nombre", "precio", "talles", "colores", "stock", "categoria", "descripcion", "precio_antes", "destacado"];
const PROSPECT_KEYS = [
  "slug",
  "nombre",
  "instagram",
  "whatsapp",
  "ciudad",
  "rubro",
  "transferencia_descuento",
  "alias",
  "titular",
  "banco",
  "envio_costo",
  "retiro",
  "productos",
];

/** Campos que no conoce (un typo como «talle» por «talles» se perdería en silencio). Los que empiezan con `_` son notas. */
function unknownKeys(value: unknown, known: string[]): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).filter((k) => !k.startsWith("_") && !known.includes(k));
}

const prospectProductSchema = z
  .object({
    nombre: z.string({ required_error: "Falta el nombre." }).trim().min(2, "El nombre es muy corto.").max(120),
    precio: price("el precio"),
    talles: textList,
    colores: textList,
    stock: z.number({ invalid_type_error: "stock: poné un número." }).int().min(0).max(9999).default(DEFAULT_STOCK),
    categoria: z.string().trim().max(60).optional(),
    descripcion: z.string().trim().max(1000).optional(),
    precio_antes: price("precio_antes").optional(),
    destacado: z.boolean().optional(),
  })
  .passthrough()
  .superRefine((p, ctx) => {
    for (const k of unknownKeys(p, PRODUCT_KEYS)) {
      ctx.addIssue({ code: "custom", path: [k], message: `campo desconocido (los que van: ${PRODUCT_KEYS.join(", ")})` });
    }
    if (p.precio_antes !== undefined && p.precio_antes <= p.precio) {
      ctx.addIssue({ code: "custom", path: ["precio_antes"], message: "tiene que ser mayor que el precio (es el precio tachado)." });
    }
  });

const prospectSchema = z
  .object({
    slug: z
      .string({ required_error: "Falta el slug (la dirección de la tienda)." })
      .trim()
      .toLowerCase()
      .superRefine((slug, ctx) => {
        const problem = storeSlugProblem(slug);
        if (problem) ctx.addIssue({ code: "custom", message: STORE_SLUG_MESSAGES[problem] });
      }),
    nombre: z.string({ required_error: "Falta el nombre de la marca." }).trim().min(2).max(60),
    instagram: z.string().trim().default(""),
    whatsapp: z
      .string({ required_error: "Falta el WhatsApp." })
      .transform(normalizePhone)
      .refine(isValidE164, "WhatsApp con código de país y área, sin 0 ni 15 (ej. 5491122334455)."),
    ciudad: z.string().trim().max(120).default(""),
    rubro: z
      .string()
      .trim()
      .toLowerCase()
      .default("moda")
      .refine((k) => STORE_KINDS.some((s) => s.id === k), `Rubro desconocido (${STORE_KINDS.map((k) => k.id).join(", ")}).`),
    transferencia_descuento: z.number({ invalid_type_error: "Poné un número (ej. 10)." }).min(0).max(50).default(0),
    alias: z.string().trim().max(80).default(""),
    titular: z.string().trim().max(120).default(""),
    banco: z.string().trim().max(80).default(""),
    envio_costo: z.number().min(0).max(9_999_999).optional(),
    retiro: z
      .object({
        nombre: z.string().trim().max(80).default(""),
        direccion: z.string().trim().max(200).default(""),
        horarios: z.string().trim().max(200).default(""),
      })
      .nullish(),
    productos: z
      .array(prospectProductSchema, { required_error: "Faltan los productos." })
      .min(1, "Cargá al menos un producto.")
      .max(MAX_PRODUCTS, `Hasta ${MAX_PRODUCTS} productos (el límite de Free si la tienda no queda en Pro).`),
  })
  .passthrough()
  .superRefine((p, ctx) => {
    for (const k of unknownKeys(p, PROSPECT_KEYS)) {
      ctx.addIssue({ code: "custom", path: [k], message: `campo desconocido (los que van: ${PROSPECT_KEYS.join(", ")})` });
    }
  });

type Prospect = z.output<typeof prospectSchema>;
type ProspectProduct = Prospect["productos"][number];

async function loadProspect(file: string): Promise<Prospect> {
  const raw = await readFile(path.resolve(process.cwd(), file), "utf8");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${file} no es un JSON válido (¿una coma de más o comillas sin cerrar?): ${err instanceof Error ? err.message : String(err)}`);
  }
  const parsed = prospectSchema.safeParse(json);
  if (!parsed.success) {
    const lines = parsed.error.issues.slice(0, 30).map((i) => `  · ${describePath(json, i.path)}: ${i.message}`);
    throw new Error(`${file} tiene ${parsed.error.issues.length} error(es):\n${lines.join("\n")}`);
  }
  return parsed.data;
}

/** `productos.2.precio` → `productos[3] «Jean mom».precio` (numerado desde 1, como lo ve el fundador). */
function describePath(json: unknown, issuePath: (string | number)[]): string {
  if (issuePath[0] === "productos" && typeof issuePath[1] === "number") {
    const list = (json as { productos?: { nombre?: unknown }[] }).productos;
    const name = list?.[issuePath[1]]?.nombre;
    const label = `productos[${issuePath[1] + 1}]${typeof name === "string" && name.trim() ? ` «${name.trim()}»` : ""}`;
    return [label, ...issuePath.slice(2)].join(".");
  }
  return issuePath.join(".") || "(archivo)";
}

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

function norm(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "s" → "S", "xl" → "XL"; "38" y "Único" quedan como están. */
function sizeLabel(text: string): string {
  const t = text.trim();
  return /^[a-z]{1,4}$/i.test(t) && !/^unic/i.test(t) ? t.toUpperCase() : capitalize(t);
}

/** Id estable (32 bits, FNV-1a): el mismo producto conserva su id aunque cambie el orden del JSON. */
function stableId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 900_000_000) + 100_000_000;
}

function instagramUrl(value: string): { url: string; handle: string } | null {
  const handle = value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  return /^[a-z0-9._]{1,30}$/i.test(handle) ? { url: `https://www.instagram.com/${handle}/`, handle } : null;
}

const CABA_NAMES = ["caba", "capital", "capital federal", "ciudad de buenos aires", "ciudad autonoma de buenos aires", "buenos aires", "bs as", "bsas", "baires"];

/** ¿CABA? «Buenos Aires» a secas cuenta como CABA (es como lo escriben casi todas); provincia: poné la ciudad (La Plata, Quilmes…). */
function isCaba(city: string): boolean {
  const c = norm(city).replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  return CABA_NAMES.includes(c) || /\bcaba\b|capital federal|ciudad autonoma/.test(c);
}

// ---------------------------------------------------------------------------
// Categorías inferidas del nombre
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: { name: string; keywords: string[] }[] = [
  { name: "Remeras", keywords: ["remera", "remeron", "musculosa", "top", "crop", "body", "polera", "camiseta"] },
  { name: "Buzos", keywords: ["buzo", "hoodie", "canguro", "sweater", "sweter", "sueter", "cardigan", "polar"] },
  { name: "Pantalones", keywords: ["pantalon", "jean", "jogger", "calza", "short", "bermuda", "palazzo", "cargo", "babucha", "oxford"] },
  { name: "Vestidos", keywords: ["vestido", "solero", "enterito", "mono"] },
  { name: "Polleras", keywords: ["pollera", "falda", "minifalda"] },
  { name: "Camisas", keywords: ["camisa", "blusa", "camisola"] },
  { name: "Camperas", keywords: ["campera", "tapado", "chaqueta", "blazer", "saco", "chaleco", "piloto", "trench", "parka", "puffer", "abrigo"] },
  {
    name: "Accesorios",
    keywords: [
      "accesorio",
      "cartera",
      "bolso",
      "mochila",
      "rinonera",
      "cinto",
      "cinturon",
      "gorro",
      "gorra",
      "bufanda",
      "panuelo",
      "medias",
      "aros",
      "collar",
      "pulsera",
      "anillo",
      "lentes",
      "billetera",
      "scrunchie",
      "vincha",
    ],
  },
];
const FALLBACK_CATEGORY = "Catálogo";

/** La palabra clave que aparece primero en el nombre gana («Vestido camisero» → Vestidos). */
function inferCategory(name: string): string | null {
  const n = norm(name);
  let best: { name: string; at: number } | null = null;
  for (const c of CATEGORY_KEYWORDS) {
    for (const kw of c.keywords) {
      const m = new RegExp(`\\b${kw}(?:s|es)?\\b`).exec(n);
      if (m && (!best || m.index < best.at)) best = { name: c.name, at: m.index };
    }
  }
  return best?.name ?? null;
}

// ---------------------------------------------------------------------------
// Colores: mapa de la demo de ropa + los que falten
// ---------------------------------------------------------------------------

/** Colores que no están en data/demo-ropa.json (claves normalizadas: minúsculas, sin acentos). */
const EXTRA_SWATCHES: Record<string, string> = {
  rojo: "#B3261E",
  borravino: "#5E1A24",
  bordo: "#6B1E2A",
  rosa: "#E8B4B8",
  "rosa chicle": "#F08DB0",
  fucsia: "#C2185B",
  coral: "#E9806E",
  salmon: "#F0A58F",
  naranja: "#E07B39",
  amarillo: "#E8C547",
  mostaza: "#C9A227",
  manteca: "#F1E3B5",
  vainilla: "#F3E9C6",
  beige: "#D9C7AE",
  nude: "#D8B8A0",
  camel: "#B98A57",
  tostado: "#A9784E",
  chocolate: "#5A3A29",
  marron: "#6F4A33",
  suela: "#8B5A2B",
  vison: "#A08C7D",
  topo: "#857B72",
  hueso: "#EDE6D6",
  natural: "#E9E1D0",
  crema: "#F2EAD8",
  "blanco roto": "#F1EDE4",
  "off white": "#F1EDE4",
  gris: "#9B9893",
  "gris melange": "#A6A39E",
  melange: "#A6A39E",
  "gris oscuro": "#4A4845",
  "gris claro": "#C9C6C1",
  plomo: "#6E6D6A",
  grafito: "#3F3F3D",
  azul: "#2F4C8A",
  azulino: "#3A5BA9",
  francia: "#2D4FA3",
  marino: "#1F2A44",
  jean: "#5B7393",
  denim: "#4B6585",
  "jean claro": "#8EA3BE",
  "jean oscuro": "#34465F",
  turquesa: "#3AAFA9",
  verde: "#4C7A4F",
  "verde militar": "#556B3A",
  militar: "#556B3A",
  oliva: "#66683F",
  "verde agua": "#9FD3C7",
  "verde manzana": "#9CC65A",
  "verde esmeralda": "#1F7A5A",
  esmeralda: "#1F7A5A",
  salvia: "#A3B39A",
  menta: "#B7DEC8",
  petroleo: "#1F4E5A",
  lila: "#C3A8D1",
  lavanda: "#B9A9D6",
  violeta: "#6D4C8C",
  uva: "#5B2A4E",
  caqui: "#A8996B",
  khaki: "#A8996B",
  plateado: "#C0C0C0",
  plata: "#C0C0C0",
  dorado: "#C9A54A",
  oro: "#C9A54A",
  estampado: "#8E7E6E",
  "animal print": "#B08A5A",
  leopardo: "#B08A5A",
  multicolor: "#9C8C7C",
};

type SwatchSource = "demo" | "agregado" | "aproximado" | "inventado";

interface Swatch {
  hex: string;
  from: SwatchSource;
  /** Para «aproximado»: el color conocido que se usó. */
  via?: string;
}

/** Hex suave y estable para un color que no está en ningún mapa. */
function inventedHex(key: string): string {
  const h = (stableId(key) % 360) / 360;
  const s = 0.28;
  const l = 0.62;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    const v = x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(h + 1 / 3)}${channel(h)}${channel(h - 1 / 3)}`.toUpperCase();
}

function resolveSwatch(color: string, demo: Map<string, string>): Swatch {
  const key = norm(color);
  const exact = demo.get(key);
  if (exact) return { hex: exact, from: "demo" };
  if (EXTRA_SWATCHES[key]) return { hex: EXTRA_SWATCHES[key], from: "agregado" };
  // «Verde oliva claro» → «verde oliva» → «verde»; «Negro con blanco» → «negro».
  const words = key.split(" ");
  for (let n = words.length - 1; n >= 1; n--) {
    const prefix = words.slice(0, n).join(" ");
    const hex = demo.get(prefix) ?? EXTRA_SWATCHES[prefix];
    if (hex) return { hex, from: "aproximado", via: prefix };
  }
  for (const word of words) {
    const hex = demo.get(word) ?? EXTRA_SWATCHES[word];
    if (hex) return { hex, from: "aproximado", via: word };
  }
  return { hex: inventedHex(key), from: "inventado" };
}

/** El mapa de colores de la demo de ropa (data/demo-ropa.json), con claves normalizadas. */
async function demoSwatches(): Promise<Map<string, string>> {
  const raw = JSON.parse(await readFile(path.resolve(process.cwd(), DEMO_FILE), "utf8"));
  const swatches = z.object({ swatches: z.record(z.string()) }).parse(raw).swatches;
  return new Map(Object.entries(swatches).map(([name, hex]) => [norm(name), hex]));
}

// ---------------------------------------------------------------------------
// JSON mínimo → formato completo (seed-from-json) + bloque `store`
// ---------------------------------------------------------------------------

interface ConvertedProduct {
  input: ProspectProduct;
  name: string;
  slug: string;
  category: string;
  inferred: boolean;
  colors: string[];
  sizes: string[];
}

interface Conversion {
  source: SourceFile;
  store: StoreConfigInput;
  products: ConvertedProduct[];
  swatches: Map<string, Swatch>;
  caba: boolean;
  instagram: string | null;
  warnings: string[];
}

function dedupe(values: string[], label: string, product: string, errors: string[]): string[] {
  const seen = new Map<string, string>();
  for (const v of values) {
    const k = norm(v);
    if (seen.has(k)) errors.push(`${product}: ${label} «${v}» repetido`);
    else seen.set(k, v);
  }
  return [...seen.values()];
}

function convert(prospect: Prospect, demo: Map<string, string>, file: string): Conversion {
  const warnings: string[] = [];
  const errors: string[] = [];

  // ---------------- Productos ----------------
  const products: ConvertedProduct[] = prospect.productos.map((p) => {
    const name = capitalize(p.nombre);
    const explicit = p.categoria ? capitalize(p.categoria) : null;
    const inferredName = explicit ? null : inferCategory(name);
    return {
      input: p,
      name,
      slug: slugify(name),
      category: explicit ?? inferredName ?? FALLBACK_CATEGORY,
      inferred: !explicit,
      colors: dedupe(p.colores.map(capitalize), "color", name, errors),
      sizes: dedupe(p.talles.map(sizeLabel), "talle", name, errors),
    };
  });
  const bySlug = new Map<string, string>();
  for (const p of products) {
    const prev = bySlug.get(p.slug);
    if (prev) errors.push(`«${p.name}» y «${prev}» quedan con la misma dirección (${p.slug}): cambiale el nombre a uno`);
    bySlug.set(p.slug, p.name);
  }
  if (errors.length) throw new Error(`${file} tiene ${errors.length} error(es):\n${errors.map((e) => `  · ${e}`).join("\n")}`);

  // ---------------- Categorías (orden de aparición; «Catálogo» al final) ----------------
  const names = [...new Set(products.map((p) => p.category))].sort(
    (a, b) => Number(a === FALLBACK_CATEGORY) - Number(b === FALLBACK_CATEGORY),
  );
  const categories = names.map((name) => ({ id: stableId(`c:${slugify(name)}`), name, slug: slugify(name), parent: 0 }));
  const categoryByName = new Map(categories.map((c) => [c.name, c]));

  // ---------------- Colores ----------------
  const swatches = new Map<string, Swatch>();
  for (const p of products) for (const c of p.colors) if (!swatches.has(c)) swatches.set(c, resolveSwatch(c, demo));
  for (const [color, s] of swatches) {
    if (s.from === "inventado") warnings.push(`Color «${color}» sin hex conocido: la imagen de ejemplo usa ${s.hex} (igual la vas a reemplazar por su foto)`);
  }

  // ---------------- Catálogo completo ----------------
  const source = {
    scrapedAt: new Date().toISOString(),
    source: `prospecto:${prospect.slug}`,
    swatches: Object.fromEntries([...swatches].map(([color, s]) => [color, s.hex])),
    categories,
    products: products.map((p) => {
      const category = categoryByName.get(p.category)!;
      const options = [
        ...(p.colors.length ? [{ name: "Color", values: p.colors }] : []),
        ...(p.sizes.length ? [{ name: "Talle", values: p.sizes }] : []),
      ];
      const colorAxis = p.colors.length ? p.colors : [null];
      const sizeAxis = p.sizes.length ? p.sizes : [null];
      const variants = colorAxis.flatMap((color) =>
        sizeAxis.map((size) => ({
          options: { ...(color ? { Color: color } : {}), ...(size ? { Talle: size } : {}) },
          stock: p.input.stock,
        })),
      );
      return {
        id: stableId(`p:${p.slug}`),
        sku: "",
        name: p.name,
        slug: p.slug,
        images: [],
        categories: [{ id: category.id, name: category.name, slug: category.slug }],
        shortDescription: p.input.descripcion || undefined,
        price: p.input.precio,
        compareAt: p.input.precio_antes,
        featured: p.input.destacado,
        options,
        variants,
      };
    }),
  };

  // ---------------- Tienda ----------------
  const caba = isCaba(prospect.ciudad);
  const ig = prospect.instagram ? instagramUrl(prospect.instagram) : null;
  if (prospect.instagram && !ig) warnings.push(`instagram «${prospect.instagram}» no parece un usuario de Instagram: no se carga`);
  if (prospect.whatsapp === PLACEHOLDER_WHATSAPP) {
    warnings.push(`WhatsApp ${PLACEHOLDER_WHATSAPP} es el de ejemplo: poné el de ella, ahí le llegan los pedidos`);
  } else if (!prospect.whatsapp.startsWith("549")) {
    warnings.push(`WhatsApp ${prospect.whatsapp} no empieza con 549 (Argentina, celular): revisalo, ahí le llegan los pedidos`);
  }
  if (!prospect.alias) warnings.push("Sin alias: la transferencia se ofrece igual y en el pedido dice «Pedir los datos por WhatsApp». Si te lo pasa, poné alias y titular");
  if (!prospect.ciudad) warnings.push("Sin ciudad: envío «A coordinar por WhatsApp»");
  if (!caba && prospect.envio_costo === undefined) {
    warnings.push("Envío «A coordinar» con costo $ 0: en el checkout se ve «Gratis» (en el pedido, «A coordinar»). Si sabés cuánto cobra, poné envio_costo");
  }
  if (prospect.productos.length < 10) warnings.push(`${prospect.productos.length} productos: para que se vea como su tienda conviene 10 a 15`);

  const retiro = prospect.retiro && prospect.retiro.direccion ? prospect.retiro : null;
  const store: StoreConfigInput = {
    name: prospect.nombre,
    tagline: "",
    kind: prospect.rubro,
    preset: presetForKind(prospect.rubro),
    whatsapp: prospect.whatsapp,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    city: caba ? "CABA" : prospect.ciudad,
    province: caba ? "Ciudad de Buenos Aires" : "",
    instagram: ig?.url ?? "",
    transfer: {
      discountPercent: prospect.transferencia_descuento,
      bankName: prospect.banco,
      holder: prospect.titular,
      alias: prospect.alias,
    },
    shippingZones: caba
      ? [
          {
            name: "CABA",
            type: "provinces",
            provinces: ["AR-C"],
            cost: prospect.envio_costo ?? CABA_SHIPPING_COST,
            etaText: "24 a 48 hs hábiles",
            notes: "Envío a domicilio en la Ciudad de Buenos Aires.",
          },
        ]
      : [
          {
            // «A coordinar…»: la página del pedido lo muestra como «A coordinar» y no como «Gratis».
            name: "A coordinar por WhatsApp",
            type: "everywhere",
            cost: prospect.envio_costo ?? 0,
            etaText: "Coordinamos día y costo por WhatsApp",
            notes: "Después de la compra te escribimos para coordinar el envío.",
          },
        ],
    pickupLocations: retiro
      ? [
          {
            name: retiro.nombre || "Punto de retiro",
            address: retiro.direccion,
            hoursText: retiro.horarios || null,
            instructions: "Te avisamos por WhatsApp cuando tu pedido está listo para retirar.",
          },
        ]
      : [],
  };

  return { source: parseSource(source, `${file} (convertido)`), store, products, swatches, caba, instagram: ig?.handle ?? null, warnings };
}

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------

function printConversion(c: Conversion, file: string) {
  log(`Prospecta: ${file} · ${c.products.length} productos · ${c.caba ? "CABA" : "fuera de CABA"}${c.instagram ? ` · @${c.instagram}` : ""}`);
  log("Conversión:");
  for (const p of c.products) {
    const shape =
      p.colors.length && p.sizes.length
        ? `${p.colors.length} color${p.colors.length === 1 ? "" : "es"} × ${p.sizes.length} talle${p.sizes.length === 1 ? "" : "s"}`
        : p.colors.length
          ? `${p.colors.length} color${p.colors.length === 1 ? "" : "es"}`
          : p.sizes.length
            ? `${p.sizes.length} talle${p.sizes.length === 1 ? "" : "s"}`
            : "producto simple";
    const variants = Math.max(p.colors.length, 1) * Math.max(p.sizes.length, 1);
    console.info(
      `    ${p.name} → ${p.category}${p.inferred ? (p.category === FALLBACK_CATEGORY ? " (sin palabra clave)" : " (inferida)") : ""} · ${money(p.input.precio)} · ${shape} = ${variants} variante${variants === 1 ? "" : "s"} · stock ${p.input.stock} c/u`,
    );
  }
  if (c.swatches.size) {
    log(`Colores (${c.swatches.size}):`);
    for (const [color, s] of c.swatches) {
      const note = s.from === "demo" ? "mapa de la demo" : s.from === "agregado" ? "agregado" : s.from === "aproximado" ? `aproximado, como «${s.via}»` : "inventado";
      console.info(`    ${color} ${s.hex} (${note})`);
    }
  }
  if (c.warnings.length) {
    log("Revisá:");
    for (const w of c.warnings) console.info(`    · ${w}`);
  }
}

function printHandoff(c: Conversion, slug: string, storeName: string, dryRun: boolean) {
  // ROOT_DOMAIN de urls.ts se lee al importar, antes de cargar .env.local: se pasa explícito.
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  const url = storeUrl({ slug }, "/", root);
  const sample = c.products.find((p) => p.sizes.length) ?? c.products[0];
  const message = `listo! te armé la tienda con ${c.products.length} productos para que la veas funcionando: ${url}. entrá desde el celu, elegí un talle y fijate como te llega el pedido al whatsapp. después te paso el acceso al panel asi la seguís vos`;

  console.info("");
  log(dryRun ? "Cuando la crees (--dry-run: todavía no existe):" : "Listo:");
  console.info(`    Tienda: ${url}`);
  console.info(`    Ficha para probar: ${storeUrl({ slug }, `/producto/${sample.slug}`, root)}`);
  console.info(`    Panel: ${platformOrigin(root)}/app → «${storeName}» (entrás con SEED_EMAIL)`);
  console.info("    Antes de mandarlo: reemplazá las fotos de ejemplo y hacé un pedido de prueba (docs/DEMO-PROSPECTA.md).");
  console.info("    Los cambios pueden tardar hasta 5 minutos en verse en la tienda (caché).");
  console.info("");
  console.info("Mensaje para mandarle:");
  console.info("------------------------------------------------------------");
  console.info(message);
  console.info("------------------------------------------------------------");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const flags = cliFlags(args);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    throw new Error("Pasá el JSON de la prospecta: npx tsx scripts/prospect-store.mts data/prospectos/<slug>.json [--dry-run]");
  }

  const prospect = await loadProspect(file);
  const conversion = convert(prospect, await demoSwatches(), file);
  const parsed = parseStoreConfig(conversion.store);
  const slug = prospect.slug;

  if (flags.dryRun) {
    printConversion(conversion, file);
    printStorePlan(parsed, slug, "el de ella: ahí le llegan los pedidos");
    printPlan(conversion.source, { file, storeSlug: slug, placeholders: true });
    printHandoff(conversion, slug, parsed.config.name, true);
    return;
  }

  for (const w of conversion.warnings) console.warn(`[seed] Revisá: ${w}`);
  const supabase = await connect();
  const { store, created } = await ensureStore(
    supabase,
    slug,
    parsed.config,
    "Si el slug ya es de otra cuenta, cambiá «slug» en el JSON; si llegaste a 3 tiendas, corrélo con tu admin de plataforma.",
  );
  log(created ? `Tienda creada: ${store.name} (${slug})` : `Tienda existente: ${store.name} (${slug})`);
  await applySettings(supabase, store, parsed, { overwriteWhatsapp: true });
  await keepPro(supabase, store);
  await seedCatalog(supabase, store, conversion.source, { skipImages: false, forceImages: flags.forceImages, placeholders: true });
  await supabase.auth.signOut();
  printHandoff(conversion, slug, store.name, false);
}

if (isEntry(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(`[seed] Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}

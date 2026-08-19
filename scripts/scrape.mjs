#!/usr/bin/env node
/**
 * Scraper de dazimportadora.com.ar via WooCommerce Store API (publica, sin auth).
 * Escribe data/products.json siguiendo el contrato de data/SCHEMA.md.
 *
 * Precios (a partir del "precio de lista" del proveedor = prices.price):
 *   costoWeb      = lista * (1 + WEB_SURCHARGE)      // valor real comprando por la web (default +15%)
 *   precioWeb     = round(costoWeb * (1 + MARKUP))   // ganancia (default +20%)
 *   precioEfectivo= round(precioWeb * (1 - CASH_DISCOUNT)) // descuento efectivo (default -10%)
 *
 * Uso:  node scripts/scrape.mjs [--markup=0.2] [--web-surcharge=0.15] [--cash-discount=0.1] [--out=data/products.json]
 *       MARKUP=0.25 WEB_SURCHARGE=0.15 CASH_DISCOUNT=0.1 node scripts/scrape.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://dazimportadora.com.ar';
const API = `${SITE}/wp-json/wc/store/v1`;
const PER_PAGE = 100;
const DELAY_MS = 700;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ utils */

const log = (...args) => process.stderr.write(`${args.join(' ')}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (m) out[m[1]] = m[2] === undefined ? 'true' : m[2];
  }
  return out;
}

function resolveRate(name, cliValue, envName, def) {
  const raw = cliValue ?? process.env[envName];
  if (raw === undefined || raw === '') return def;
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n >= 1) {
    throw new Error(`${name} invalido: ${JSON.stringify(raw)} (se espera un numero entre 0 y 1, ej ${def})`);
  }
  return n;
}

function resolvePricing(args) {
  return {
    webSurcharge: resolveRate('WEB_SURCHARGE', args['web-surcharge'], 'WEB_SURCHARGE', 0.15),
    markup: resolveRate('MARKUP', args.markup, 'MARKUP', 0.2),
    cashDiscount: resolveRate('CASH_DISCOUNT', args['cash-discount'], 'CASH_DISCOUNT', 0.1),
  };
}

/** Calcula los dos precios de venta a partir del precio de lista del proveedor. */
function computePrices(lista, pricing) {
  const l = toInt(lista);
  if (l === null) return { efectivo: null, web: null };
  const costoWeb = l * (1 + pricing.webSurcharge);
  const webFinal = Math.round(costoWeb * (1 + pricing.markup));
  const efectivoFinal = Math.round(webFinal * (1 - pricing.cashDiscount));
  return {
    efectivo: { base: l, final: efectivoFinal },
    web: { base: Math.round(costoWeb), final: webFinal },
  };
}

/* --------------------------------------------------------------- HTML/text */

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  laquo: '«', raquo: '»', ldquo: '“', rdquo: '”',
  lsquo: '‘', rsquo: '’', deg: '°', euro: '€',
  pound: '£', yen: '¥', cent: '¢', copy: '©',
  reg: '®', trade: '™', middot: '·', bull: '•',
  times: '×', divide: '÷', frac12: '½', frac14: '¼',
};

/** Decodifica entidades numericas (&#036; &#x24;) y las nombradas mas comunes. */
function decodeEntities(input) {
  if (!input) return '';
  return String(input)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z][a-z0-9]*);/gi, (full, name) => {
      const hit = NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()];
      return hit === undefined ? full : hit;
    });
}

function safeFromCodePoint(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Quita tags HTML, decodifica entidades y normaliza espacios. */
function htmlToText(html) {
  if (!html) return '';
  const withoutBlocks = String(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(withoutBlocks)
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ------------------------------------------------------------------ precios */

/**
 * Parsea un monto en formato argentino.
 * "31.993" -> 31993 | "1.234.567" -> 1234567 | "1.234,50" -> 1234.5 | "29900" -> 29900
 * Devuelve null si no hay digitos.
 */
function parseArsAmount(raw) {
  if (raw === null || raw === undefined) return null;
  const token = String(raw).replace(/[^\d.,-]/g, '').trim();
  if (!/\d/.test(token)) return null;

  const negative = token.startsWith('-');
  let body = token.replace(/-/g, '');
  const lastComma = body.lastIndexOf(',');
  const lastDot = body.lastIndexOf('.');

  if (lastComma !== -1) {
    // La coma manda como separador decimal (formato es-AR): "1.234,50"
    body = body.slice(0, lastComma).replace(/[.,]/g, '') + '.' + body.slice(lastComma + 1).replace(/[.,]/g, '');
  } else if (lastDot !== -1) {
    const dots = body.split('.').length - 1;
    const tail = body.length - lastDot - 1;
    // Varios puntos, o un punto con exactamente 3 digitos detras => separador de miles.
    if (dots > 1 || tail === 3) body = body.replace(/\./g, '');
  }

  const n = Number(body);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Convierte el string de la Store API a unidades mayores segun currency_minor_unit. */
function fromMinorUnit(value, minorUnit) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  const unit = Number.isFinite(Number(minorUnit)) ? Number(minorUnit) : 0;
  return n / Math.pow(10, unit);
}

/** Extrae todos los montos que aparecen en price_html, en orden de aparicion. */
function extractPriceHtmlAmounts(priceHtml) {
  if (!priceHtml) return [];

  const cleaned = String(priceHtml)
    // <del> = precio regular tachado en productos en oferta: no es ni web ni efectivo.
    .replace(/<del\b[^>]*>[\s\S]*?<\/del>/gi, ' ')
    // Sacamos el span del simbolo de moneda para que el span del monto no tenga anidados.
    .replace(/<span[^>]*class="[^"]*woocommerce-Price-currencySymbol[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');

  const amounts = [];

  // 1) Preferimos los spans de WooCommerce (evita capturar texto suelto).
  const spanRe = /<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let m;
  while ((m = spanRe.exec(cleaned)) !== null) {
    const n = parseArsAmount(htmlToText(m[1]));
    if (n !== null) amounts.push(n);
  }
  if (amounts.length) return amounts;

  // 2) Fallback: texto plano, montos precedidos por simbolo de moneda.
  const text = htmlToText(cleaned);
  const symRe = /(?:\$|ARS)\s*(-?[\d][\d.,]*)/g;
  while ((m = symRe.exec(text)) !== null) {
    const n = parseArsAmount(m[1]);
    if (n !== null) amounts.push(n);
  }
  if (amounts.length) return amounts;

  // 3) Ultimo recurso: cualquier numero del texto.
  const numRe = /-?\d[\d.,]*/g;
  while ((m = numRe.exec(text)) !== null) {
    const n = parseArsAmount(m[0]);
    if (n !== null) amounts.push(n);
  }
  return amounts;
}

const nearlyEqual = (a, b) => Math.abs(a - b) < 0.5;

/**
 * price_html trae dos montos: "Precio web" y "Efectivo".
 * El que coincide con prices.price es el efectivo; el otro es el web.
 * Si no se puede determinar, devuelve null.
 */
function extractWebBase(priceHtml, efectivoBase) {
  const amounts = extractPriceHtmlAmounts(priceHtml).filter((n) => n > 0);
  if (amounts.length < 2) return null;

  if (efectivoBase !== null && efectivoBase !== undefined) {
    const others = amounts.filter((n) => !nearlyEqual(n, efectivoBase));
    if (others.length) return Math.max(...others);
    return null; // todos iguales al efectivo => no hay precio web distinto
  }

  // Sin base de referencia: el web es el mayor de los dos.
  const max = Math.max(...amounts);
  const min = Math.min(...amounts);
  return nearlyEqual(max, min) ? null : max;
}

const toInt = (n) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n));


/* ----------------------------------------------------------------- fetching */

async function fetchJson(url, { label = url } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body = await res.json();
      return { body, headers: res.headers };
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS) break;
      const wait = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
      log(`  ! ${label}: ${err.message} — reintento ${attempt + 1}/${MAX_ATTEMPTS} en ${wait}ms`);
      await sleep(wait);
    }
  }
  throw new Error(`Fallaron ${MAX_ATTEMPTS} intentos en ${label}: ${lastErr?.message}`);
}

/** Recorre un endpoint paginado de la Store API de forma secuencial. */
async function fetchAllPages(path, { label }) {
  const items = [];
  let page = 1;
  let totalPages = null;
  let total = null;

  while (true) {
    const url = `${API}${path}${path.includes('?') ? '&' : '?'}per_page=${PER_PAGE}&page=${page}`;
    const { body, headers } = await fetchJson(url, { label: `${label} p${page}` });
    if (!Array.isArray(body)) throw new Error(`${label} p${page}: se esperaba un array`);

    if (page === 1) {
      total = Number(headers.get('x-wp-total')) || null;
      totalPages = Number(headers.get('x-wp-totalpages')) || null;
    }
    items.push(...body);
    log(`  · ${label} pagina ${page}${totalPages ? `/${totalPages}` : ''}: ${body.length} items (acum ${items.length})`);

    const more = totalPages ? page < totalPages : body.length === PER_PAGE;
    if (!more) break;
    page += 1;
    await sleep(DELAY_MS);
  }

  return { items, total: total ?? items.length };
}

/* ------------------------------------------------------------------ mapping */

function mapCategory(cat) {
  return {
    id: cat.id,
    name: htmlToText(cat.name),
    slug: cat.slug,
    parent: cat.parent ?? 0,
  };
}

function mapProduct(p, pricing) {
  const prices = p.prices ?? {};
  const minorUnit = prices.currency_minor_unit;

  let efectivoBase = fromMinorUnit(prices.price, minorUnit);
  if (efectivoBase === null || efectivoBase === 0) {
    // Variables / sin precio directo: usamos el minimo del rango.
    const min = fromMinorUnit(prices.price_range?.min_amount, minorUnit);
    if (min !== null && min > 0) efectivoBase = min;
  }

  const webBase = extractWebBase(p.price_html, efectivoBase === null ? null : Math.round(efectivoBase));

  const images = (p.images ?? []).map((img) => img?.src).filter(Boolean);
  const shortSource = String(p.short_description ?? '').trim()
    ? p.short_description
    : p.description;

  return {
    id: p.id,
    sku: p.sku ?? '',
    name: htmlToText(p.name),
    slug: p.slug ?? '',
    permalink: p.permalink ?? '',
    image: images[0] ?? null,
    images,
    categories: (p.categories ?? []).map((c) => ({
      id: c.id,
      name: htmlToText(c.name),
      slug: c.slug,
    })),
    inStock: p.is_in_stock === true,
    onSale: p.on_sale === true,
    type: p.type ?? 'simple',
    shortDescription: htmlToText(shortSource),
    prices: computePrices(efectivoBase, pricing),
    // Referencia: precio "web" que publica el propio proveedor (no se usa para vender).
    supplierWebPrice: toInt(webBase),
  };
}

/* --------------------------------------------------------------------- main */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pricing = resolvePricing(args);
  const outPath = resolve(ROOT, args.out ?? 'data/products.json');

  log(`> Scrape ${SITE}`);
  log(`> pricing: web = lista * ${(1 + pricing.webSurcharge).toFixed(2)} * ${(1 + pricing.markup).toFixed(2)}; efectivo = web * ${(1 - pricing.cashDiscount).toFixed(2)}`);
  const startedAt = Date.now();

  log('> Categorias...');
  const { items: rawCategories } = await fetchAllPages('/products/categories', { label: 'categorias' });
  await sleep(DELAY_MS);

  log('> Productos...');
  const { items: rawProducts, total } = await fetchAllPages('/products', { label: 'productos' });

  const products = rawProducts
    .map((p) => mapProduct(p, pricing))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true }));

  const categories = rawCategories
    .map(mapCategory)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  const currency = rawProducts.find((p) => p.prices?.currency_code)?.prices?.currency_code ?? 'ARS';

  const payload = {
    scrapedAt: new Date().toISOString(),
    source: SITE,
    markup: pricing.markup,
    pricing,
    currency,
    count: products.length,
    categories,
    products,
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  const noWeb = products.filter((p) => p.prices.web === null);
  const noEfectivo = products.filter((p) => p.prices.efectivo === null);
  const secs = ((Date.now() - startedAt) / 1000).toFixed(1);

  log('');
  log(`> Listo en ${secs}s -> ${outPath}`);
  log(`  productos: ${products.length}${total && total !== products.length ? ` (x-wp-total decia ${total})` : ''}`);
  log(`  categorias: ${categories.length}`);
  log(`  sin precio web (web === null): ${noWeb.length}`);
  log(`  sin precio efectivo (efectivo === null): ${noEfectivo.length}`);
  if (noWeb.length) {
    log(`  ejemplos sin web: ${noWeb.slice(0, 5).map((p) => `${p.id} ${p.name.slice(0, 45)}`).join(' | ')}`);
  }
}

main().catch((err) => {
  log(`ERROR: ${err.stack || err.message}`);
  process.exitCode = 1;
});

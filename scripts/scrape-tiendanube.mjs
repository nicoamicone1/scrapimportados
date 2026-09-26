#!/usr/bin/env node
/**
 * Scraper de una tienda Tiendanube (HTML público, sin API ni auth) para armar la
 * demo de un cliente. Recorre el listado `/productos/page/N/`, cada ficha de
 * producto (JSON-LD + `data-variants`) y cada categoría del menú (para saber en
 * qué categorías está cada producto), y escribe un JSON compatible con
 * data/SCHEMA.md más `store`, `options` y `variants`:
 *
 *   node scripts/scrape-tiendanube.mjs --url=https://ramas3.mitiendanube.com --out=data/clients/ramas.json
 *
 * Los precios son los del cliente, sin markup: `prices.web.final` = precio de
 * lista y `prices.efectivo.final` = precio con el descuento por medio de pago
 * que muestra la tienda (transferencia), si lo hay. No hay costo (`base` = null).
 * Las imágenes quedan como URLs del CDN de Tiendanube (`imagesRemote`, a 1024 px).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as cheerio from 'cheerio';

const DELAY_MS = 400;
const MAX_ATTEMPTS = 3;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

async function fetchText(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, 'accept-language': 'es-AR' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) throw new Error(`${url}: ${err instanceof Error ? err.message : err}`);
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }
}

/** `//dcdn…/foo-480-0.webp` → `https://dcdn…/foo-1024-1024.webp` (la versión grande del CDN). */
function bigImage(src) {
  if (!src) return null;
  const first = src.split(',')[0].trim().split(/\s+/)[0];
  const abs = first.startsWith('//') ? `https:${first}` : first;
  return abs.replace(/-(?:50|100|240|320|480|640|1024)-(?:0|1024)\.(webp|jpe?g|png)/, '-1024-1024.$1').replace(/\?.*$/, '');
}

/** Texto plano de un fragmento HTML (para `shortDescription`). */
function plain(html) {
  return cheerio.load(`<div>${html}</div>`)('div').text().replace(/\s+/g, ' ').trim();
}

/**
 * Recorte para `shortDescription`: por code points (con .slice() se puede partir
 * un emoji y Postgres rechaza el JSON) y en el último espacio, con "…".
 */
function excerpt(text, max) {
  const chars = [...text];
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max - 1).join('');
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,;:.]+$/, '')}…`;
}

/** Limpia la descripción de Tiendanube: sólo etiquetas de texto, sin estilos ni atributos. */
function cleanHtml(html) {
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  $('script, style, iframe, img, video').remove();
  $('#root *').each((_, el) => {
    for (const name of Object.keys(el.attribs ?? {})) {
      if (!(el.tagName === 'a' && name === 'href')) $(el).removeAttr(name);
    }
  });
  $('#root span, #root font').each((_, el) => {
    $(el).replaceWith($(el).html() ?? '');
  });
  // El tema antepone un título "Descripción" que en Ecommy sobra.
  $('#root > h1, #root > h2, #root > h3, #root > h4, #root > h5, #root > h6')
    .filter((_, el) => /^descripci[oó]n:?$/i.test($(el).text().trim()))
    .remove();
  $('#root p').each((_, el) => {
    if (!$(el).text().trim()) $(el).remove();
  });
  return ($('#root').html() ?? '').replace(/\s+/g, ' ').trim();
}

function decodeVariants(raw) {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ main */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const site = (args.url ?? process.env.TN_URL ?? '').replace(/\/+$/, '');
  if (!site) throw new Error('Definí --url=https://<tienda>.mitiendanube.com');
  const outFile = resolve(ROOT, args.out ?? 'data/clients/tiendanube.json');

  // ---------------- Home: datos de la tienda y árbol de categorías ----------------
  const homeHtml = await fetchText(`${site}/`);
  const $home = cheerio.load(homeHtml);
  const org = $home('script[type="application/ld+json"]')
    .map((_, el) => {
      try {
        return JSON.parse($home(el).text());
      } catch {
        return null;
      }
    })
    .get()
    .find((j) => j && j['@type'] === 'Organization');
  const whatsapp = /wa\.me\/(\d+)/.exec(homeHtml)?.[1] ?? null;
  const store = {
    name: org?.name ?? $home('meta[property="og:site_name"]').attr('content') ?? null,
    url: site,
    logo: org?.logo?.replace(/\?.*$/, '') ?? null,
    description: $home('meta[name="description"]').attr('content') ?? null,
    social: org?.sameAs ?? [],
    whatsapp,
    footer: $home('footer').text().replace(/\s+/g, ' ').trim(),
  };

  // Lo que la tienda muestra en la home ("Los más buscados", destacados): `featured`.
  const homeProducts = new Set(
    [...homeHtml.matchAll(/\/productos\/([a-z0-9-]+)\//g)].map((m) => m[1]),
  );

  const siteHost = new URL(site).host;
  const catUrls = new Set();
  $home('a[href]').each((_, el) => {
    const href = $home(el).attr('href');
    let u;
    try {
      u = new URL(href, site);
    } catch {
      return;
    }
    if (u.host !== siteHost) return;
    const parts = u.pathname.split('/').filter(Boolean);
    if (!parts.length || parts.length > 3) return;
    if (['productos', 'search', 'contacto', 'account', 'comprar', 'checkout', 'cart'].includes(parts[0])) return;
    if (!u.pathname.endsWith('/')) return;
    catUrls.add(`${site}/${parts.join('/')}/`);
  });

  // ---------------- Categorías: nombre (breadcrumb) y productos de cada una ----------------
  const categories = [];
  const productCats = new Map(); // slug de producto → [slug de categoría]
  let catId = 1;
  const catIdByPath = new Map();
  for (const catUrl of [...catUrls].sort()) {
    await sleep(DELAY_MS);
    const html = await fetchText(catUrl);
    if (!html) continue;
    const $ = cheerio.load(html);
    const name = $('h1').first().text().trim();
    if (!name || !$('.js-product-container, .js-item-product, [data-product-id]').length && !html.includes('/productos/')) continue;
    const path = new URL(catUrl).pathname.split('/').filter(Boolean);
    const id = catId++;
    catIdByPath.set(path.join('/'), id);
    const parent = path.length > 1 ? catIdByPath.get(path.slice(0, -1).join('/')) ?? 0 : 0;
    const slug = path[path.length - 1];
    categories.push({ id, name, slug, parent, url: catUrl });

    const members = new Set();
    for (let page = 1; page <= 30; page++) {
      const pageHtml = page === 1 ? html : await fetchText(`${catUrl}page/${page}/`);
      if (!pageHtml) break;
      const found = [...pageHtml.matchAll(new RegExp(`${site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/productos/([a-z0-9-]+)/`, 'g'))].map((m) => m[1]);
      // Tiendanube repite "los más vendidos" en el pie de cada listado: sólo cuentan
      // los productos de la grilla (las páginas vacías traen sólo esos).
      const $p = cheerio.load(pageHtml);
      const grid = $p('.js-product-table [data-product-id], .js-product-table .js-item-product, .js-product-table a[href*="/productos/"]')
        .map((_, el) => $p(el).find('a[href*="/productos/"]').addBack('a[href*="/productos/"]').attr('href'))
        .get()
        .map((h) => /\/productos\/([a-z0-9-]+)\//.exec(h ?? '')?.[1])
        .filter(Boolean);
      const items = grid.length ? grid : found;
      const before = members.size;
      for (const s of items) members.add(s);
      if (members.size === before) break;
      if (page > 1) await sleep(DELAY_MS);
    }
    for (const s of members) productCats.set(s, [...(productCats.get(s) ?? []), id]);
    log(`categoría ${name}: ${members.size} productos`);
  }

  // ---------------- Listado completo de productos ----------------
  const productSlugs = new Set();
  for (let page = 1; page <= 100; page++) {
    const html = await fetchText(`${site}/productos/page/${page}/`);
    if (!html) break;
    const $ = cheerio.load(html);
    const slugs = $('.js-product-table a[href*="/productos/"]')
      .map((_, el) => /\/productos\/([a-z0-9-]+)\//.exec($(el).attr('href') ?? '')?.[1])
      .get()
      .filter(Boolean);
    const before = productSlugs.size;
    for (const s of slugs) productSlugs.add(s);
    log(`listado página ${page}: ${slugs.length} (${productSlugs.size} únicos)`);
    if (productSlugs.size === before) break;
    await sleep(DELAY_MS);
  }

  // ---------------- Fichas ----------------
  const products = [];
  for (const slug of productSlugs) {
    await sleep(DELAY_MS);
    const url = `${site}/productos/${slug}/`;
    const html = await fetchText(url);
    if (!html) {
      log(`sin ficha: ${slug}`);
      continue;
    }
    const $ = cheerio.load(html);
    const ld = $('script[type="application/ld+json"]')
      .map((_, el) => {
        try {
          return JSON.parse($(el).text());
        } catch {
          return null;
        }
      })
      .get();
    const page = ld.find((j) => j?.mainEntity?.['@type'] === 'Product');
    const prod = page?.mainEntity;
    const container = $('#single-product, .js-product-container').first();
    const variants = decodeVariants(container.attr('data-variants') ?? $('[data-variants]').first().attr('data-variants'));
    const productId = variants[0]?.product_id ?? Number(container.attr('data-product-id')) ?? null;

    const images = [];
    $('#single-product .js-product-slide-img, .js-product-slide-img').each((_, el) => {
      const src = bigImage($(el).attr('data-srcset') ?? $(el).attr('srcset') ?? $(el).attr('data-src') ?? $(el).attr('src'));
      if (src && !images.includes(src)) images.push(src);
    });
    if (!images.length && prod?.image) images.push(bigImage(prod.image));

    // Nombres de las opciones (Color, Talle, …) en el orden de option0..2.
    // Sólo los grupos de la ficha: la página trae también los de los "relacionados" (quickshop).
    const optionNames = $('#single-product .js-product-variants-group')
      .map((_, el) => $(el).find('label, .form-label').first().text().replace(/:\s*.*$/, '').trim())
      .get()
      .filter(Boolean);

    const descHtml = cleanHtml($('.product-description.user-content, .js-product-description, .user-content').first().html() ?? '');
    const breadcrumb = page?.breadcrumb?.itemListElement ?? [];
    const crumbCat = breadcrumb.length > 2 ? new URL(breadcrumb[breadcrumb.length - 2].item).pathname.split('/').filter(Boolean).join('/') : null;
    const cats = new Set(productCats.get(slug) ?? []);
    if (crumbCat && catIdByPath.has(crumbCat)) cats.add(catIdByPath.get(crumbCat));

    const priced = variants.filter((v) => v.price_number != null);
    const min = priced.length ? Math.min(...priced.map((v) => v.price_number)) : Number(prod?.offers?.price ?? 0);
    const cheapest = priced.find((v) => v.price_number === min) ?? priced[0];
    const withDiscount = cheapest?.price_with_payment_discount_short
      ? Number(cheapest.price_with_payment_discount_short.replace(/[^\d,]/g, '').replace(',', '.'))
      : null;

    products.push({
      id: productId,
      sku: cheapest?.sku ?? '',
      name: (prod?.name ?? $('h1').first().text()).trim(),
      slug,
      permalink: url,
      images: [],
      imagesRemote: images,
      categories: [...cats].map((id) => {
        const c = categories.find((x) => x.id === id);
        return { id, name: c.name, slug: c.slug };
      }),
      featured: homeProducts.has(slug),
      inStock: variants.length ? variants.some((v) => v.available) : prod?.offers?.availability?.endsWith('InStock') ?? true,
      shortDescription: descHtml ? excerpt(plain(descHtml), 300) : '',
      descriptionHtml: descHtml,
      weightKg: prod?.weight?.value ? Number(prod.weight.value) : null,
      prices: {
        efectivo: { base: null, final: Math.round(withDiscount ?? min) },
        web: { base: null, final: Math.round(min) },
      },
      options: optionNames.length && variants.some((v) => v.option0) ? optionNames : [],
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku ?? null,
        price: v.price_number,
        compareAtPrice: v.compare_at_price_number ?? null,
        stock: v.stock,
        available: !!v.available,
        values: [v.option0, v.option1, v.option2].filter((x) => x != null),
        image: v.image_url ? bigImage(v.image_url) : null,
      })),
    });
    log(`producto ${products.length}/${productSlugs.size}: ${products[products.length - 1].name}`);
  }

  const out = {
    scrapedAt: new Date().toISOString(),
    source: site,
    platform: 'tiendanube',
    currency: 'ARS',
    count: products.length,
    store,
    categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, parent: c.parent })),
    products: products.sort((a, b) => a.name.localeCompare(b.name, 'es')),
  };
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  log(`Listo: ${products.length} productos, ${categories.length} categorías → ${outFile}`);
}

main().catch((err) => {
  log(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

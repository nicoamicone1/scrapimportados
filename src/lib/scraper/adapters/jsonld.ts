/**
 * Adaptador genérico: descubre URLs de producto (sitemap.xml, links de un
 * listado con paginación simple) y extrae cada ficha con JSON-LD /
 * microdata / Open Graph. Sirve para Tiendanube, VTEX, PrestaShop, Magento
 * y sitios propios que publiquen datos estructurados.
 */
import { fetchText, ScrapeError } from "../http";
import { extractListingLinks, extractProductFromHtml, looksLikeProductUrl, parseSitemap } from "../jsonld";
import { originOf, uniq } from "../text";
import type { FetchPageResult, NormalizedProduct, ScrapeAdapter } from "../types";

export interface JsonLdCursor {
  urls: string[];
  index: number;
}

/** URLs de producto por página de `fetchPage` (cada una es un request). */
const URLS_PER_PAGE = 6;
const MAX_LISTING_PAGES = 15;
const MAX_CHILD_SITEMAPS = 6;

async function fromSitemap(sitemapUrl: string, limit: number): Promise<string[]> {
  const out: string[] = [];
  let first: { isIndex: boolean; locs: string[] };
  try {
    first = parseSitemap((await fetchText(sitemapUrl, { attempts: 1 })).text);
  } catch {
    return [];
  }
  if (!first.isIndex) {
    const productish = /product/i.test(sitemapUrl);
    return first.locs.filter((u) => productish || looksLikeProductUrl(u)).slice(0, limit);
  }
  const children = first.locs.filter((u) => /product/i.test(u));
  const queue = (children.length ? children : first.locs).slice(0, MAX_CHILD_SITEMAPS);
  const productish = children.length > 0;
  for (const child of queue) {
    if (out.length >= limit) break;
    try {
      const sm = parseSitemap((await fetchText(child, { attempts: 1 })).text);
      out.push(...sm.locs.filter((u) => productish || looksLikeProductUrl(u)));
    } catch {
      // Sitemap hijo roto: seguimos con el resto.
    }
  }
  return uniq(out).slice(0, limit);
}

async function sitemapCandidates(origin: string): Promise<string[]> {
  const out = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  try {
    const robots = (await fetchText(`${origin}/robots.txt`, { attempts: 1 })).text;
    for (const m of robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)) out.unshift(m[1]);
  } catch {
    // Sin robots.txt.
  }
  return uniq(out);
}

async function fromListing(url: string, limit: number): Promise<string[]> {
  const out: string[] = [];
  const seenPages = new Set<string>();
  let page: string | null = url;
  let n = 1;
  while (page && !seenPages.has(page) && seenPages.size < MAX_LISTING_PAGES && out.length < limit) {
    seenPages.add(page);
    let html: string;
    try {
      html = (await fetchText(page, { attempts: 2 })).text;
    } catch (err) {
      if (seenPages.size === 1) throw err;
      break;
    }
    const { products, next } = extractListingLinks(html, page);
    const before = out.length;
    for (const p of products) if (!out.includes(p)) out.push(p);
    if (out.length === before) break;
    // Paginación: rel=next o ?page=N.
    n += 1;
    if (next) page = next;
    else {
      const u = new URL(url);
      u.searchParams.set("page", String(n));
      page = u.toString();
    }
  }
  return out.slice(0, limit);
}

/** Descubre URLs de producto a partir de una URL de tienda, listado o sitemap. */
export async function discoverProductUrls(url: string, limit: number): Promise<string[]> {
  const origin = originOf(url);
  if (!origin) throw new ScrapeError("La URL no es válida.");
  const path = new URL(url).pathname;

  if (/\.xml(\.gz)?$/i.test(path)) return fromSitemap(url, limit);
  if (looksLikeProductUrl(url)) return [url];

  // Un listado concreto (no la home): primero sus links.
  if (path !== "/" && path !== "") {
    const listed = await fromListing(url, limit);
    if (listed.length) return listed;
  }
  for (const sm of await sitemapCandidates(origin)) {
    const urls = await fromSitemap(sm, limit);
    if (urls.length) return urls;
  }
  return fromListing(url, limit);
}

export const jsonldAdapter: ScrapeAdapter<JsonLdCursor> = {
  id: "jsonld",

  async detect(url) {
    // Genérico: siempre "aplica" si la página responde; se usa como último recurso.
    try {
      await fetchText(url, { attempts: 1 });
      return true;
    } catch {
      return false;
    }
  },

  async discover(url, { limit }) {
    const urls = await discoverProductUrls(url, limit);
    if (!urls.length) {
      throw new ScrapeError(
        "No encontramos fichas de producto en esa dirección. Probá con la URL de un listado de productos o del sitemap.xml.",
      );
    }
    return { total: urls.length, cursor: { urls, index: 0 } };
  },

  async fetchPage(_url, cursor): Promise<FetchPageResult<JsonLdCursor>> {
    const slice = cursor.urls.slice(cursor.index, cursor.index + URLS_PER_PAGE);
    const products: NormalizedProduct[] = [];
    const warnings: string[] = [];
    for (const u of slice) {
      try {
        const { text, url: finalUrl } = await fetchText(u, { attempts: 2 });
        const product = extractProductFromHtml(text, finalUrl);
        if (!product) warnings.push(`Sin datos de producto en ${u}`);
        else if (product.variants.every((v) => v.price === null)) warnings.push(`Sin precio en ${u} (se omite)`);
        else products.push(product);
      } catch (err) {
        warnings.push(`No se pudo leer ${u}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const index = cursor.index + slice.length;
    return { products, warnings, next: index < cursor.urls.length ? { ...cursor, index } : null };
  },
};

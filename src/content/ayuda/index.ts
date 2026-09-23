import { HELP_SECTIONS, type HelpArticle, type HelpArticleMeta, type HelpSectionId } from "../types";

import * as analytics from "./analytics-pixel-tag-manager";
import * as cambiarPrecios from "./cambiar-precios-en-masa";
import * as cargarProducto from "./cargar-un-producto";
import * as compartir from "./compartir-tu-tienda";
import * as estilo from "./estilo-colores-tipografias";
import * as importarCsv from "./importar-csv";
import * as importarTienda from "./importar-desde-otra-tienda";
import * as ley from "./lo-que-exige-la-ley";
import * as pedidos from "./pedidos-y-cobros";
import * as planes from "./planes-prueba-y-equipo";
import * as portada from "./portada-y-paginas";
import * as primerosPasos from "./primeros-pasos";
import * as remitos from "./remitos-y-exportar";
import * as zonas from "./zonas-de-envio";

/*
 * Registro del centro de ayuda. El orden de esta lista es el orden dentro
 * de cada sección. Para sumar un artículo: crear el módulo (exporta `meta`
 * y `body`) y agregarlo acá; el test controla slugs, largos y links.
 */
const MODULES: { meta: HelpArticleMeta; body: HelpArticle["body"] }[] = [
  primerosPasos,
  cargarProducto,
  importarCsv,
  importarTienda,
  cambiarPrecios,
  pedidos,
  remitos,
  zonas,
  estilo,
  portada,
  compartir,
  analytics,
  ley,
  planes,
];

export const HELP_ARTICLES: readonly HelpArticle[] = MODULES.map((m) => ({ ...m.meta, body: m.body }));

export function getHelpArticle(slug: string): HelpArticle | null {
  return HELP_ARTICLES.find((a) => a.slug === slug) ?? null;
}

export function helpSectionTitle(id: HelpSectionId): string {
  return HELP_SECTIONS.find((s) => s.id === id)?.title ?? id;
}

/** Secciones con sus artículos, en orden (omite las vacías). */
export function helpBySection(): { id: HelpSectionId; title: string; description: string; articles: HelpArticle[] }[] {
  return HELP_SECTIONS.map((s) => ({ ...s, articles: HELP_ARTICLES.filter((a) => a.section === s.id) })).filter((s) => s.articles.length);
}

/** Relacionados: primero los de la misma sección, después los de `related`. */
export function relatedHelp(article: HelpArticle, max = 3): HelpArticle[] {
  const same = HELP_ARTICLES.filter((a) => a.section === article.section && a.slug !== article.slug);
  const extra = (article.related ?? []).map((slug) => getHelpArticle(slug)).filter((a): a is HelpArticle => Boolean(a));
  const seen = new Set<string>([article.slug]);
  const out: HelpArticle[] = [];
  for (const a of [...same, ...extra]) {
    if (seen.has(a.slug)) continue;
    seen.add(a.slug);
    out.push(a);
    if (out.length === max) break;
  }
  return out;
}

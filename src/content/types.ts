import type { ReactNode } from "react";

/*
 * Contenido editorial del sitio de la plataforma: centro de ayuda (/ayuda)
 * y guías (/guias). Cada artículo es un módulo `.tsx` que exporta `meta`
 * (datos para listados, metadata y sitemap) y `body` (JSX plano: h2 con
 * `id`, h3, p, ul, ol, `ArticleTable`, `Callout`). Sin MDX: el texto vive
 * en el repo, lo revisan los tests de `content.test.ts`.
 */

/** Secciones del centro de ayuda, en el orden en que se muestran. */
export const HELP_SECTIONS = [
  { id: "empezar", title: "Empezar", description: "Del registro a la tienda lista para compartir." },
  { id: "catalogo", title: "Catálogo", description: "Productos, variantes, importación y precios." },
  { id: "pedidos", title: "Pedidos y cobros", description: "Cómo entra un pedido, cómo cobrás y qué hacés después." },
  { id: "envios", title: "Envíos", description: "Zonas, costos, envío gratis y retiro en el local." },
  { id: "apariencia", title: "Apariencia y páginas", description: "Estilo, colores, tipografías, portada y páginas." },
  { id: "marketing", title: "Marketing", description: "Compartir la tienda y medir visitas y ventas." },
  { id: "legales", title: "Legales", description: "Lo que pide la ley en Argentina para vender online." },
  { id: "cuenta", title: "Cuenta y plan", description: "Planes, prueba gratis y equipo." },
] as const;

export type HelpSectionId = (typeof HELP_SECTIONS)[number]["id"];

interface ContentMeta {
  /** Segmento de la URL: minúsculas, números y guiones. */
  slug: string;
  /** Título visible y `<title>` (sin el sufijo "· Ecommy"). */
  title: string;
  /** Bajada y meta description: 160 caracteres como máximo. */
  description: string;
  /** Fechas ISO sin hora. */
  publishedAt: string;
  updatedAt: string;
  /** Minutos de lectura (≈ 200 palabras por minuto; lo controla el test). */
  readingMinutes: number;
}

export interface HelpArticleMeta extends ContentMeta {
  section: HelpSectionId;
  /** Pantalla del panel donde se hace lo que explica el artículo. */
  panel?: { href: string; label: string };
  /** Otros artículos para "Relacionados" (además de los de la misma sección). */
  related?: string[];
}

export interface GuideMeta extends ContentMeta {
  /** Tema de la guía (se muestra como sección). */
  section: string;
  /** Llamado a la acción del final (lo único que habla de Ecommy fuera del cuerpo). */
  cta: { title: string; text: string };
}

export interface HelpArticle extends HelpArticleMeta {
  body: ReactNode;
}

export interface Guide extends GuideMeta {
  body: ReactNode;
}

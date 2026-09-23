"use client";

import { useEffect } from "react";

/** Atributo que marca un elemento cuyas fuentes vienen de una hoja externa. */
const FONT_SHEET_ATTR = "data-font-sheet";

function hasSheet(href: string): boolean {
  for (const link of document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
    if (link.getAttribute("href") === href) return true;
  }
  return false;
}

function injectSheet(href: string) {
  if (hasSheet(href)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Carga las hojas de Google Fonts de la landing sin bloquear el primer
 * render: cada elemento con `data-font-sheet="<url>"` pide su hoja recién
 * cuando está a `rootMargin` del viewport. Un `<link>` insertado por script
 * no bloquea el render (uno en el HTML, sí), así que el LCP (el h1, en la
 * fuente del sistema) no espera a Google Fonts; con `display=swap`, el texto
 * se ve con la fuente de respaldo hasta que llega la del preset.
 *
 * No se usa `<link precedence>` de React: una hoja nueva con `precedence`
 * suspende el render hasta que carga. Las hojas quedan en el `<head>` al
 * salir de la página (vuelven a servir si el visitante vuelve).
 */
export function LazyFontSheets({ rootMargin = "600px 0px" }: { rootMargin?: string }) {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(`[${FONT_SHEET_ATTR}]`);
    if (!targets.length) return;
    if (typeof IntersectionObserver === "undefined") {
      for (const el of targets) {
        const href = el.getAttribute(FONT_SHEET_ATTR);
        if (href) injectSheet(href);
      }
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const href = entry.target.getAttribute(FONT_SHEET_ATTR);
          if (href) injectSheet(href);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin },
    );
    for (const el of targets) observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return null;
}

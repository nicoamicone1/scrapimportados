"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Manda `page_view` a GA4 en cada cambio de ruta del sitio de la plataforma.
 * Sin PII: sólo ruta, query y título. Si `gtag` todavía no cargó (primer
 * render), el snippet de `PlatformAnalytics` encola en `dataLayer`.
 */
export function PlatformPageViews({ id }: { id: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search?.toString() ?? "";

  useEffect(() => {
    const path = query ? `${pathname}?${query}` : pathname;
    window.gtag?.("event", "page_view", {
      send_to: id,
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [id, pathname, query]);

  return null;
}

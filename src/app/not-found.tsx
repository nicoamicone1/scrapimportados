import type { Metadata } from "next";

import { NotFoundView } from "./(platform)/site-404";

export const metadata: Metadata = { title: "Página no encontrada", robots: { index: false } };

/**
 * 404 raíz (fuera del layout del storefront: rutas que no matchean nada,
 * ej. dentro de /admin o del sitio). El storefront tiene su propio 404 con
 * el tema en `s/[store]/not-found.tsx` y su catch-all `[slug]/[...rest]` que
 * prueba las redirecciones 301.
 */
export default function NotFound() {
  return (
    <NotFoundView
      home="/"
      title="Esta página no está."
      line="Puede que el link tenga un error de tipeo o que la página se haya movido. Desde acá llegás a todo."
      primary={{ href: "/", label: "Ir al inicio" }}
      links={[
        { href: "/ayuda", label: "Centro de ayuda" },
        { href: "/app", label: "Mis tiendas" },
      ]}
    />
  );
}

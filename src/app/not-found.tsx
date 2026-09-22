import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Página no encontrada", robots: { index: false } };

/**
 * 404 raíz (fuera del layout del storefront: rutas que no matchean nada,
 * ej. dentro de /admin). El storefront tiene su propio 404 con el tema en
 * `(store)/not-found.tsx` y su catch-all `[slug]/[...rest]` que prueba las
 * redirecciones 301.
 */
export default function NotFound() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "15vh auto", padding: "0 16px" }}>
      <p style={{ fontSize: 13, opacity: 0.7 }}>Error 404</p>
      <h1 style={{ fontSize: 28, margin: "4px 0 8px" }}>No encontramos esta página</h1>
      <p style={{ opacity: 0.8 }}>Revisá la dirección o volvé al inicio.</p>
      <p style={{ marginTop: 24 }}>
        <Link href="/" style={{ textDecoration: "underline" }}>
          Ir al inicio
        </Link>
      </p>
    </main>
  );
}

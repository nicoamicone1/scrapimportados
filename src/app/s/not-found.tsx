import type { Metadata } from "next";

import { platformUrl } from "@/lib/tenant/urls";
import { APP_NAME } from "@/lib/version";

export const metadata: Metadata = { title: "Esta tienda no existe", robots: { index: false } };

/**
 * 404 de tienda inexistente (o suspendida): lo dispara el `notFound()` del
 * layout de `s/[store]` cuando `getTenant()` no resuelve la tienda. Vive en
 * el segmento padre porque un not-found no atrapa el `notFound()` del layout
 * de su propio segmento. Sin tema (no hay tienda de la cual sacarlo).
 */
export default function StoreNotFound() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "15vh auto", padding: "0 16px", color: "#1c1917" }}>
      <p style={{ fontSize: 13, opacity: 0.7 }}>Error 404</p>
      <h1 style={{ fontSize: 28, margin: "4px 0 8px" }}>Esta tienda no existe</h1>
      <p style={{ opacity: 0.8 }}>
        Revisá la dirección: puede que la tienda haya cambiado de nombre o que ya no esté publicada.
      </p>
      <p style={{ marginTop: 24 }}>
        <a href={platformUrl("/")} style={{ textDecoration: "underline" }}>
          Ir a {APP_NAME}
        </a>
      </p>
    </main>
  );
}

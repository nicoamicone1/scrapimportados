import type { Metadata } from "next";

import { platformUrl } from "@/lib/tenant/urls";

import { NotFoundView } from "../(platform)/site-404";

export const metadata: Metadata = { title: "Esta tienda no existe", robots: { index: false } };

/**
 * 404 de tienda inexistente (o suspendida): lo dispara el `notFound()` del
 * layout de `s/[store]` cuando `getTenant()` no resuelve la tienda. Vive en
 * el segmento padre porque un not-found no atrapa el `notFound()` del layout
 * de su propio segmento. Sin tema (no hay tienda de la cual sacarlo), así
 * que habla Ecommy; los links van al host de la plataforma.
 */
export default function StoreNotFound() {
  return (
    <NotFoundView
      home={platformUrl("/")}
      title="Esta tienda no existe."
      line="Revisá la dirección: puede que la tienda haya cambiado de nombre o que ya no esté publicada. Si es tuya, entrá a tu cuenta."
      primary={{ href: platformUrl("/"), label: "Ir a Ecommy" }}
      links={[
        { href: platformUrl("/login"), label: "Ingresar a mi tienda" },
      ]}
    />
  );
}

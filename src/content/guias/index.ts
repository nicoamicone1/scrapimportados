import type { Guide, GuideMeta } from "../types";

import * as arrepentimiento from "./boton-de-arrepentimiento";
import * as migrar from "./migrar-tienda-online-sin-perder-seo";
import * as precioSinImpuestos from "./precio-sin-impuestos-nacionales";
import * as whatsapp from "./vender-por-whatsapp-sin-perder-pedidos";

/*
 * Registro de guías (/guias): contenido para quien todavía no es cliente.
 * La primera de la lista es la destacada del índice.
 */
const MODULES: { meta: GuideMeta; body: Guide["body"] }[] = [whatsapp, arrepentimiento, precioSinImpuestos, migrar];

export const GUIDES: readonly Guide[] = MODULES.map((m) => ({ ...m.meta, body: m.body }));

export function getGuide(slug: string): Guide | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}

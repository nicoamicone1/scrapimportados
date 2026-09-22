/** Políticas de la tienda (`store_settings.policies.*_md`) → rutas `/politicas/[tipo]`. */
export const POLICY_LINKS = [
  { key: "shipping_md", slug: "envios", alias: "shipping", label: "Envíos", title: "Política de envíos" },
  { key: "returns_md", slug: "cambios-y-devoluciones", alias: "returns", label: "Cambios y devoluciones", title: "Cambios y devoluciones" },
  { key: "privacy_md", slug: "privacidad", alias: "privacy", label: "Privacidad", title: "Política de privacidad" },
  { key: "terms_md", slug: "terminos", alias: "terms", label: "Términos y condiciones", title: "Términos y condiciones" },
] as const;

export type PolicyLink = (typeof POLICY_LINKS)[number];

/** Acepta el slug en castellano o el alias en inglés (`/politicas/terms`). */
export function findPolicy(tipo: string): PolicyLink | null {
  return POLICY_LINKS.find((p) => p.slug === tipo || p.alias === tipo) ?? null;
}

export const CONSUMER_DEFENSE_URL = "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario";

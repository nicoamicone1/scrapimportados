import type { ReactNode } from "react";

import { PLATFORM_EMAIL, PLATFORM_OWNER } from "@/components/platform/site";
import { listPublicPlans, type PublicPlan } from "@/lib/plans/catalog";

/*
 * Piezas compartidas por las páginas públicas nuevas (/terminos,
 * /privacidad, /contacto, /planes). Carpeta privada: no genera rutas.
 */

/** Planes públicos o `[]` si la base no responde (la página se sigue viendo). */
export async function plansOrEmpty(from: string): Promise<PublicPlan[]> {
  try {
    return await listPublicPlans();
  } catch (err) {
    console.error(`[${from}] planes:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/** Link `mailto:` al mail de la plataforma, con asunto y cuerpo opcionales. */
export function platformMailto(subject?: string, body?: string): string {
  const params = [subject ? `subject=${encodeURIComponent(subject)}` : null, body ? `body=${encodeURIComponent(body)}` : null].filter(Boolean);
  return `mailto:${PLATFORM_EMAIL}${params.length ? `?${params.join("&")}` : ""}`;
}

export function EmailLink({ subject }: { subject?: string }) {
  return <a href={platformMailto(subject)}>{PLATFORM_EMAIL}</a>;
}

/**
 * Quién presta el servicio, según `PLATFORM_OWNER`. Mientras falte algún
 * dato, el texto dice que se informa a pedido por mail.
 */
export function OwnerStatement(): ReactNode {
  const { name, taxId, address } = PLATFORM_OWNER;
  const missing = [name ? null : "nombre o razón social", taxId ? null : "CUIT", address ? null : "domicilio"].filter(
    (m): m is string => Boolean(m),
  );
  const onRequest = missing.length ? (
    <>
      {" "}
      {missing.length === 3 ? "Los datos de su titular" : "Los demás datos del titular"} ({joinList(missing)}) se informan a pedido: escribinos
      a <EmailLink subject="Datos del titular de Ecommy" />.
    </>
  ) : null;

  if (!name) {
    return (
      <p>
        Ecommy es un servicio que se presta desde la República Argentina.
        {taxId || address ? ` Su titular ${[taxId ? `tiene CUIT ${taxId}` : null, address ? `tiene domicilio en ${address}` : null].filter(Boolean).join(" y ")}.` : null}
        {onRequest}
      </p>
    );
  }
  return (
    <p>
      Ecommy lo presta <strong>{name}</strong>
      {taxId ? `, CUIT ${taxId}` : null}
      {address ? `, con domicilio en ${address}` : null}.{onRequest}
    </p>
  );
}

function joinList(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}` : (items[0] ?? "");
}

import { formatDateTime } from "@/lib/dates";

import { renderEmail, type EmailContent } from "../layout";
import { platformBrand } from "./shared";

/** Aviso interno a la plataforma (`PLATFORM_EMAIL`). */

export interface PlanRequestEmailData {
  storeId: string;
  storeName: string;
  storeUrl: string;
  currentPlan: string;
  currentTrial: boolean;
  requestedPlan: string;
  requestedBy: string | null;
  requestedAt: string;
  platformUrl: string;
}

export function planRequestEmail(d: PlanRequestEmailData): EmailContent {
  const subject = `Pedido de plan: ${d.storeName} → ${d.requestedPlan}`;
  return renderEmail({
    subject,
    preheader: `${d.storeName} pidió pasar de ${d.currentPlan} a ${d.requestedPlan}.`,
    brand: platformBrand(d.platformUrl),
    blocks: [
      { t: "heading", text: "Pedido de cambio de plan" },
      { t: "p", content: [{ b: d.storeName }, ` pidió pasar de ${d.currentPlan}${d.currentTrial ? " (prueba)" : ""} a `, { b: d.requestedPlan }, "."] },
      {
        t: "rows",
        rows: [
          { label: "Tienda", value: d.storeName },
          { label: "Dirección", value: d.storeUrl.replace(/^https?:\/\//, "") },
          { label: "Plan actual", value: `${d.currentPlan}${d.currentTrial ? " (prueba)" : ""}` },
          { label: "Plan pedido", value: d.requestedPlan },
          { label: "Pedido por", value: d.requestedBy ?? "" },
          { label: "Fecha", value: formatDateTime(d.requestedAt) },
        ],
      },
      { t: "p", content: "El cobro todavía es manual: coordiná el pago y cambiá el plan desde la ficha de la tienda.", muted: true },
      { t: "button", href: `${d.platformUrl}/platform/tiendas/${d.storeId}`, label: "Abrir la tienda en /platform" },
    ],
    footer: ["Aviso interno de Ecommy. Te llega porque esta dirección está en PLATFORM_EMAIL."],
  });
}

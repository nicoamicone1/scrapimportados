import { CreditCard, Truck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/display";
import {
  freeShippingReply,
  hasPaymentInfo,
  paymentReply,
  pickupReply,
  transferReply,
  zoneReply,
  type ReplyPayments,
  type ReplyPickup,
  type ReplyZone,
} from "@/lib/admin/replies";

import { CopyReplyButton, OpenWhatsAppLink } from "./ReplyButtons";

/**
 * "Lo que preguntan siempre": respuestas fijas de envío, retiro y pago,
 * armadas con los datos cargados. Si no hay datos, un vacío que lleva a
 * donde se configuran.
 */

interface FixedReply {
  id: string;
  title: string;
  text: string;
}

function ReplyList({ items }: { items: FixedReply[] }) {
  return (
    <ul className="divide-y divide-adm-border">
      {items.map((r) => (
        <li key={r.id} className="px-4 py-4 sm:px-5">
          <h3 className="text-[13px] font-medium text-adm-fg">{r.title}</h3>
          <p className="eco-bubble mt-2 bg-adm-surface-2 px-4 py-3 text-[13px] leading-relaxed break-words whitespace-pre-line text-adm-fg [--eco-bubble-r:16px]">
            {r.text}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <CopyReplyButton text={r.text} label="Copiar" ariaLabel={`Copiar respuesta: ${r.title}`} className="max-sm:flex-1" />
            <OpenWhatsAppLink text={r.text} ariaLabel={`Abrir WhatsApp con la respuesta: ${r.title}`} className="max-sm:flex-1" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {children}
    </Card>
  );
}

export function FrequentReplies({
  zones,
  pickups,
  freeShippingFrom,
  payments,
  currency,
  storeLink,
}: {
  zones: ReplyZone[];
  pickups: ReplyPickup[];
  freeShippingFrom: number | null;
  payments: ReplyPayments;
  currency: string;
  /** URL pública de la tienda (para "Podés armar el pedido acá"). */
  storeLink: string;
}) {
  const shipping: FixedReply[] = [
    ...zones.map((z, i) => ({ id: `zone-${i}`, title: `Envío a ${z.name}`, text: zoneReply(z, { currency }) })),
    ...(freeShippingFrom !== null ? [{ id: "free", title: "Envío gratis", text: freeShippingReply(freeShippingFrom, { currency }, storeLink) }] : []),
    ...pickups.map((p, i) => ({ id: `pickup-${i}`, title: `Retiro en ${p.name}`, text: pickupReply(p) })),
  ];

  const pay: FixedReply[] = [];
  if (hasPaymentInfo(payments)) pay.push({ id: "pay", title: "Cómo pagar", text: paymentReply(payments) });
  const transfer = transferReply(payments);
  if (transfer) pay.push({ id: "transfer", title: "Datos para transferir", text: transfer });
  const missingBank = payments.transfer && !transfer;

  return (
    <div className="space-y-4">
      <Section title="Envío y retiro" description="Costo y plazo por zona, envío gratis y dónde retirar.">
        {shipping.length ? (
          <ReplyList items={shipping} />
        ) : (
          <EmptyState
            bare
            icon={<Truck />}
            title="Todavía no cargaste zonas de envío ni puntos de retiro"
            description="Con tus zonas y tu local cargados, acá tenés la respuesta lista para “¿cuánto sale el envío?”."
            actions={<ButtonLink href="/admin/envios">Configurar envíos</ButtonLink>}
          />
        )}
      </Section>

      <Section title="Pago" description="Transferencia, descuento, tarjeta y cuotas, según lo que tengas activo.">
        {pay.length ? (
          <>
            <ReplyList items={pay} />
            {missingBank ? (
              <p className="border-t border-adm-border px-4 py-3 text-[12px] text-adm-fg-muted sm:px-5">
                Para sumar el alias o el CBU a la respuesta, cargalos en{" "}
                <Link href="/admin/configuracion/pagos" className="font-medium text-adm-link underline-offset-2 hover:underline">
                  Configuración › Pagos
                </Link>
                .
              </p>
            ) : null}
          </>
        ) : (
          <EmptyState
            bare
            icon={<CreditCard />}
            title="Todavía no tenés métodos de pago activos"
            description="Activá transferencia o Mercado Pago y acá vas a tener la respuesta lista para “¿cómo te pago?”."
            actions={<ButtonLink href="/admin/configuracion/pagos">Configurar pagos</ButtonLink>}
          />
        )}
      </Section>
    </div>
  );
}

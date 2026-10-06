import { MessageSquareReply } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PlanGate } from "@/components/admin/PlanGate";
import { FrequentReplies } from "@/components/admin/replies/FrequentReplies";
import { ReplyDesk } from "@/components/admin/replies/ReplyDesk";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import { hasFeature } from "@/lib/plans";
import { storeUrl } from "@/lib/tenant/urls";

import { searchProductsForReply } from "./actions";
import { getReplyDeskData } from "./data";

export const metadata: Metadata = { title: "Responder" };

/**
 * Respuestas listas (PRODUCT-THESIS §4.2): el puente WhatsApp → operación,
 * sin bot. El comerciante busca el producto, elige la variante y copia la
 * respuesta con precio, stock y link; Ecommy nunca manda nada solo.
 * Desde Starter (feature `orders.replies`, 0024); en Free, el candado.
 */
export default async function ReplyPage() {
  const ctx = await requireAdmin();
  const header = (
    <PageHeader
      title="Responder"
      section="orders"
      icon={<MessageSquareReply />}
      description="Te preguntan por WhatsApp. Buscá el producto y copiá la respuesta con precio, stock y link."
    />
  );

  if (!hasFeature(ctx.plan, "orders.replies")) {
    return (
      <>
        {header}
        <PlanGate
          feature="orders.replies"
          plan={ctx.plan}
          description="Buscás el producto por el que te preguntan y copiás la respuesta con precio, stock, descuento por transferencia y link. También las de envío, retiro y cómo pagar."
        >
          {null}
        </PlanGate>
      </>
    );
  }

  const [d, initial] = await Promise.all([getReplyDeskData(ctx), searchProductsForReply({ q: "" })]);

  return (
    <>
      {header}

      {d.maintenance ? (
        <p role="status" className="mb-4 rounded-adm-lg bg-adm-accent-2-soft px-4 py-3 text-[13px] text-adm-fg">
          <span className="font-medium">Tu tienda está en modo mantenimiento:</span> quien abra los links ve el aviso en lugar del producto.{" "}
          <Link href="/admin/configuracion/seo#mantenimiento" className="font-medium text-adm-link underline-offset-2 hover:underline">
            Desactivar mantenimiento
          </Link>
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <Card className="min-w-0 lg:col-span-7">
          <CardHeader
            title="Precio, stock y link"
            description="Elegí la variante por la que te preguntan: si no hay stock, la respuesta ofrece el aviso de reposición."
          />
          <ReplyDesk
            initial={initial.ok ? initial.data : []}
            initialError={initial.ok ? null : initial.error}
            terms={{ ...d.terms, stockAlerts: true }}
          />
        </Card>

        <section aria-labelledby="siempre" className="min-w-0 lg:col-span-5">
          <h2 id="siempre" className="text-[15px] font-semibold text-adm-fg">
            Lo que preguntan siempre
          </h2>
          <p className="mt-0.5 mb-3 text-[13px] text-adm-fg-muted">Respuestas armadas con tus datos de envío y pago.</p>
          <FrequentReplies
            zones={d.zones}
            pickups={d.pickups}
            freeShippingFrom={d.freeShippingFrom}
            payments={d.payments}
            currency={d.currency}
            storeLink={storeUrl(ctx.store)}
          />
        </section>
      </div>
    </>
  );
}

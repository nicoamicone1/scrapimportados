import { ExternalLink } from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/dates";
import type { Json } from "@/lib/supabase/database.types";
import { mpPaymentSummary, mpStatusDetailText, mpStatusKind, mpStatusLabel } from "@/lib/store/mercadopago-labels";

const TONES: Record<ReturnType<typeof mpStatusKind>, BadgeTone> = {
  approved: "green",
  review: "amber",
  rejected: "red",
  refunded: "neutral",
  unknown: "neutral",
};

function str(v: Json | undefined): string | null {
  return typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null;
}

/** Último pago de Mercado Pago del pedido (docs/PAYMENTS.md §6). */
export function MercadoPagoDetail({ detail, preferenceId, timeZone }: { detail: Json | null; preferenceId: string | null; timeZone?: string }) {
  const d = detail && typeof detail === "object" && !Array.isArray(detail) ? detail : null;
  const status = str(d?.status);
  const paymentId = str(d?.payment_id);
  const installments = Number(d?.installments ?? 0) || null;
  const summary = d ? mpPaymentSummary({ paymentMethodId: str(d.payment_method_id), lastFour: str(d.last_four), installments }) : null;
  const reason = status && status !== "approved" ? mpStatusDetailText(str(d?.status_detail)) : null;
  const updated = str(d?.date_approved) ?? str(d?.updated_at);

  return (
    <Card>
      <CardHeader title="Mercado Pago" />
      <CardBody className="space-y-2 text-sm">
        {status ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TONES[mpStatusKind(status)]}>{mpStatusLabel(status)}</Badge>
              {summary ? <span>{summary}</span> : null}
            </div>
            {reason ? <p className="text-adm-fg-muted">{reason}</p> : null}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
              {paymentId ? (
                <>
                  <dt className="text-adm-fg-muted">ID de pago</dt>
                  <dd className="font-mono">{paymentId}</dd>
                </>
              ) : null}
              {updated ? (
                <>
                  <dt className="text-adm-fg-muted">Actualizado</dt>
                  <dd>{formatDateTime(updated, timeZone)}</dd>
                </>
              ) : null}
            </dl>
            {paymentId ? (
              <a
                href={`https://www.mercadopago.com.ar/activities/detail/${encodeURIComponent(paymentId)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[13px] text-adm-accent underline-offset-2 hover:underline"
              >
                Ver en Mercado Pago <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
          </>
        ) : (
          <p className="text-adm-fg-muted">
            El comprador fue a pagar con Mercado Pago y todavía no hay un pago registrado.
            {preferenceId ? <span className="block font-mono text-[12px]">Preferencia {preferenceId}</span> : null}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

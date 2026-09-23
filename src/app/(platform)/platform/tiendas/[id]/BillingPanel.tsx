"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";

import { syncStoreBilling } from "./actions";

export interface BillingPanelProps {
  storeId: string;
  /** null = la base no tiene la migración 0015. */
  billing: {
    provider: string | null;
    providerRef: string | null;
    providerStatus: string | null;
    providerPlanCode: string | null;
    cancelAtPeriodEnd: boolean;
    lastPaymentAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
  events: { id: string; type: string; summary: string; when: string }[];
  mpConfigured: boolean;
}

const MP_STATUS: Record<string, string> = {
  pending: "Pendiente (checkout sin terminar)",
  authorized: "Autorizada (cobra cada mes)",
  paused: "Pausada",
  cancelled: "Cancelada",
};

/** Estado de MercadoPago de la tienda y "Sincronizar con MercadoPago". */
export function BillingPanel({ storeId, billing, events, mpConfigured }: BillingPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!billing) {
    return <p className="px-4 py-3 text-[13px] text-adm-fg-muted">Falta aplicar la migración 0015 (cobro con MercadoPago).</p>;
  }
  const rows: [string, string][] = [
    ["Cobro", billing.provider === "mercadopago" ? "MercadoPago" : billing.provider === "manual" ? "Manual" : "Sin definir"],
    ["Suscripción de MP", billing.providerRef ?? "—"],
    ["Estado en MP", billing.providerStatus ? (MP_STATUS[billing.providerStatus] ?? billing.providerStatus) : "—"],
    ["Plan elegido en MP", billing.providerPlanCode ?? "—"],
    ["Renovación", billing.cancelAtPeriodEnd ? "Cancelada: pasa a Free al terminar el período" : "Automática"],
    ["Último cobro", billing.lastPaymentAt ?? "—"],
    ["Fin del período", billing.currentPeriodEnd ?? "—"],
  ];

  return (
    <div>
      <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-4 py-3 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-adm-fg-muted">{k}</dt>
            <dd className="truncate font-mono text-xs leading-5">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2 border-t border-adm-border px-4 py-2.5">
        <Button
          size="sm"
          loading={pending}
          disabled={!mpConfigured || !billing.providerRef}
          onClick={() =>
            startTransition(async () => {
              const res = await syncStoreBilling({ storeId });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(res.data.summary);
              router.refresh();
            })
          }
        >
          Sincronizar con MercadoPago
        </Button>
        {!mpConfigured ? <span className="text-xs text-adm-fg-muted">Falta MP_ACCESS_TOKEN.</span> : null}
      </div>
      {events.length ? (
        <ul className="divide-y divide-adm-border border-t border-adm-border text-[13px]">
          {events.map((e) => (
            <li key={e.id} className="px-4 py-2">
              <div>{e.summary}</div>
              <div className="text-xs text-adm-fg-muted">
                {e.type} · {e.when}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

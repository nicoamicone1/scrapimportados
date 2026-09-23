"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { extendTrial, setStoreStatus } from "@/app/(platform)/platform/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import type { ActionResult } from "@/lib/actions";
import type { BillingPeriod } from "@/lib/plans/yearly";

import { setStorePlanWithPeriod } from "./actions";

export interface StoreAdminFormsProps {
  storeId: string;
  storeName: string;
  plans: { code: string; name: string }[];
  current: { plan: string; status: string; trialEndsAt: string; storeStatus: string };
  /** Periodicidad del plan (0019). `null` = la base todavía no tiene la columna: no se muestra. */
  period: BillingPeriod | null;
  /** La tienda tiene un débito automático de MercadoPago que puede cobrar: guardar un plan lo cancela. */
  mercadoPagoDebit: boolean;
}

const PERIOD_OPTIONS = [
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual (pagó el año)" },
];

const SUB_OPTIONS = [
  { value: "active", label: "Activa (pagando)" },
  { value: "trialing", label: "Prueba" },
  { value: "past_due", label: "Pago pendiente" },
  { value: "cancelled", label: "Cancelada (cuenta como Free)" },
];

export function StoreAdminForms({ storeId, storeName, plans, current, period: currentPeriod, mercadoPagoDebit }: StoreAdminFormsProps) {
  const router = useRouter();
  const [plan, setPlan] = useState(current.plan);
  const [status, setStatus] = useState(current.status);
  const [period, setPeriod] = useState<BillingPeriod>(currentPeriod ?? "monthly");
  // La prueba y Free son siempre mensuales.
  const showPeriod = currentPeriod !== null && status !== "trialing" && plan !== "free";
  const savePeriod: BillingPeriod = showPeriod ? period : "monthly";
  const [trial, setTrial] = useState(current.trialEndsAt);
  const [confirm, setConfirm] = useState<"suspended" | "deleted" | "active" | null>(null);
  const [confirmMp, setConfirmMp] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Plan"
          description={
            mercadoPagoDebit
              ? "Cambio manual. La tienda paga con MercadoPago: guardar un plan (salvo extender la prueba) cancela el débito automático en MercadoPago y la pasa a manual."
              : "Cambio manual. Guardar un plan (salvo extender la prueba) deja la tienda en cobro manual: los avisos de MercadoPago dejan de tocarla."
          }
        />
        <CardBody className="space-y-3">
          <div className={showPeriod ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
            <Field label="Plan">
              <Select value={plan} onChange={(e) => setPlan(e.target.value)} options={plans.map((p) => ({ value: p.code, label: p.name }))} />
            </Field>
            <Field label="Estado">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} options={SUB_OPTIONS} />
            </Field>
            {showPeriod ? (
              <Field label="Pago">
                <Select value={period} onChange={(e) => setPeriod(e.target.value === "yearly" ? "yearly" : "monthly")} options={PERIOD_OPTIONS} />
              </Field>
            ) : null}
          </div>
          {status === "trialing" ? (
            <Field label="Prueba hasta">
              <Input type="date" value={trial} onChange={(e) => setTrial(e.target.value)} />
            </Field>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              loading={pending}
              onClick={() => {
                if (mercadoPagoDebit && status !== "trialing") setConfirmMp(true);
                else run(() => setStorePlanWithPeriod({ storeId, plan, status: status as "active", trialEndsAt: trial, period: savePeriod }), "Plan actualizado.");
              }}
            >
              Guardar plan
            </Button>
            <Button disabled={pending} onClick={() => run(() => extendTrial({ storeId, days: 7 }), "Prueba extendida 7 días.")}>
              Extender prueba 7 días
            </Button>
            <Button disabled={pending} onClick={() => run(() => extendTrial({ storeId, days: 14 }), "Prueba extendida 14 días.")}>
              +14 días
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Estado de la tienda" description="Una tienda suspendida no se ve en público; el equipo sigue entrando al panel." />
        <CardBody className="flex flex-wrap gap-2">
          {current.storeStatus !== "active" ? (
            <Button variant="primary" disabled={pending} onClick={() => setConfirm("active")}>
              Reactivar
            </Button>
          ) : (
            <Button disabled={pending} onClick={() => setConfirm("suspended")}>
              Suspender
            </Button>
          )}
          {current.storeStatus !== "deleted" ? (
            <Button variant="danger" disabled={pending} onClick={() => setConfirm("deleted")}>
              Marcar como borrada
            </Button>
          ) : null}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmMp}
        onOpenChange={setConfirmMp}
        title={`¿Guardar el plan de ${storeName}?`}
        description="Se cancelará el débito automático en MercadoPago. La tienda queda con el plan que elegiste, en cobro manual."
        confirmLabel="Cancelar débito y guardar"
        cancelLabel="Volver"
        destructive
        onConfirm={async () => {
          const res = await setStorePlanWithPeriod({ storeId, plan, status: status as "active", trialEndsAt: trial, cancelMercadoPago: true, period: savePeriod });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Plan actualizado y débito automático cancelado.");
          setConfirmMp(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === "active" ? `¿Reactivar ${storeName}?` : confirm === "suspended" ? `¿Suspender ${storeName}?` : `¿Marcar ${storeName} como borrada?`
        }
        description={
          confirm === "deleted"
            ? "Deja de verse en público y en el selector de tiendas. Los datos quedan en la base (no se borran)."
            : confirm === "suspended"
              ? "La tienda deja de verse en público hasta que la reactives."
              : "La tienda vuelve a verse en público."
        }
        confirmLabel={confirm === "active" ? "Reactivar" : confirm === "suspended" ? "Suspender" : "Marcar como borrada"}
        destructive={confirm !== "active"}
        onConfirm={async () => {
          if (!confirm) return;
          const target = confirm;
          const res = await setStoreStatus({ storeId, status: target });
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Estado actualizado.");
            router.refresh();
          }
        }}
      />
    </div>
  );
}

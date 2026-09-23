"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updatePlan } from "@/app/(platform)/platform/actions";
import { updatePlanMercadoPago } from "@/app/(platform)/platform/planes/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Checkbox, Input } from "@/components/ui/Input";
import { FEATURE_KEYS, FEATURES, LIMIT_KEYS, LIMITS, type PlanInfo } from "@/lib/plans";

export interface EditablePlan {
  code: string;
  name: string;
  description: string;
  isPublic: boolean;
  plan: PlanInfo;
  /** `plans.mp_plan_id` ("" = sin cobro por MP). `null` = la base todavía no tiene la columna (0015). */
  mpPlanId: string | null;
}

/** Edición de un plan: precio, features y límites (vacío = ilimitado / "a medida"). */
export function PlanEditor({ value }: { value: EditablePlan }) {
  const router = useRouter();
  const [name, setName] = useState(value.name);
  const [description, setDescription] = useState(value.description);
  const [price, setPrice] = useState(value.plan.priceMonthly === null ? "" : String(value.plan.priceMonthly));
  const [isPublic, setIsPublic] = useState(value.isPublic);
  const [features, setFeatures] = useState<Record<string, boolean>>({ ...value.plan.features });
  const [limits, setLimits] = useState<Record<string, string>>(
    Object.fromEntries(LIMIT_KEYS.map((k) => [k, value.plan.limits[k] === null ? "" : String(value.plan.limits[k])])),
  );
  const [mpPlanId, setMpPlanId] = useState(value.mpPlanId ?? "");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const res = await updatePlan({
        code: value.code,
        name,
        description,
        price: price === "" ? "" : Number(price),
        isPublic,
        features,
        limits: Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, v === "" ? "" : Number(v)])),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (value.mpPlanId !== null && mpPlanId.trim() !== value.mpPlanId) {
        const mp = await updatePlanMercadoPago({ code: value.code, mpPlanId });
        if (!mp.ok) {
          toast.error(`Plan guardado, pero no el id de MercadoPago: ${mp.error}`);
          router.refresh();
          return;
        }
        if (mp.data.detail) toast.info(`MercadoPago: ${mp.data.detail}`);
      }
      toast.success(`Plan ${name} guardado.`);
      router.refresh();
    });

  return (
    <Card>
      <CardHeader title={`${value.name} · ${value.code}`} actions={<Button variant="primary" size="sm" loading={pending} onClick={save}>Guardar</Button>} />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Precio por mes (ARS)" hint="Vacío = a medida.">
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <div className="flex items-end pb-1.5">
            <Checkbox checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} label="Visible en la web" />
          </div>
        </div>
        <Field label="Descripción">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
        </Field>
        {value.mpPlanId !== null ? (
          <Field
            label="Plan de MercadoPago (preapproval_plan_id)"
            hint="Id del plan de suscripción creado en MercadoPago con el mismo precio. Vacío = este plan no se paga con MercadoPago."
          >
            <Input value={mpPlanId} onChange={(e) => setMpPlanId(e.target.value)} maxLength={80} className="font-mono text-xs" placeholder="2c9380848…" />
          </Field>
        ) : null}
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">Límites (vacío = ilimitado)</legend>
          <div className="grid gap-3 sm:grid-cols-4">
            {LIMIT_KEYS.map((k) => (
              <Field key={k} label={LIMITS[k].label}>
                <Input type="number" min={0} value={limits[k]} onChange={(e) => setLimits((l) => ({ ...l, [k]: e.target.value }))} />
              </Field>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">Funciones</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FEATURE_KEYS.map((k) => (
              <Checkbox
                key={k}
                checked={Boolean(features[k])}
                onChange={(e) => setFeatures((f) => ({ ...f, [k]: e.target.checked }))}
                label={FEATURES[k].label}
                description={k}
              />
            ))}
          </div>
        </fieldset>
      </CardBody>
    </Card>
  );
}

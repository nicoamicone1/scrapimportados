"use client";

import { Dices } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { saveCoupon } from "@/app/admin/(panel)/cupones/actions";
import { CategoryMultiSelect } from "@/components/admin/pricing/CategoryMultiSelect";
import { ProductMultiPicker } from "@/components/admin/pricing/ProductMultiPicker";
import { parseNumberInput } from "@/components/admin/pricing/shared";
import { toast } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Checkbox, Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { SaveBar } from "@/components/ui/SaveBar";
import type { PickerProduct } from "@/lib/admin/pricing";
import { cn } from "@/lib/cn";
import type { CategoryLite } from "@/lib/pricing";
import {
  COUPON_TYPE_LABELS,
  COUPON_TYPES,
  couponSchema,
  generateCouponCode,
  normalizeCouponCode,
  type CouponValues,
} from "@/lib/schemas/coupon";
import { PROMO_SCOPE_LABELS, PROMO_SCOPES } from "@/lib/schemas/promotion";

export interface CouponFormProps {
  id: string | null;
  initial: CouponValues;
  initialProducts: PickerProduct[];
  categories: CategoryLite[];
  timezone: string;
}

interface Draft {
  code: string;
  type: CouponValues["type"];
  value: string;
  minSubtotal: string;
  maxUses: string;
  maxUsesPerCustomer: string;
  firstOrderOnly: boolean;
  startsAt: string;
  endsAt: string;
  scope: CouponValues["scope"];
  categoryIds: string[];
  products: PickerProduct[];
  isActive: boolean;
}

const str = (n: number | null) => (n == null ? "" : String(n));

function toDraft(v: CouponValues, products: PickerProduct[]): Draft {
  return {
    code: v.code,
    type: v.type,
    value: v.type === "free_shipping" ? "" : String(v.value),
    minSubtotal: str(v.minSubtotal),
    maxUses: str(v.maxUses),
    maxUsesPerCustomer: str(v.maxUsesPerCustomer),
    firstOrderOnly: v.firstOrderOnly,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    scope: v.scope,
    categoryIds: v.categoryIds,
    products,
    isActive: v.isActive,
  };
}

function toInput(d: Draft) {
  return {
    code: d.code,
    type: d.type,
    value: d.type === "free_shipping" ? 0 : parseNumberInput(d.value),
    minSubtotal: parseNumberInput(d.minSubtotal),
    maxUses: parseNumberInput(d.maxUses),
    maxUsesPerCustomer: parseNumberInput(d.maxUsesPerCustomer),
    firstOrderOnly: d.firstOrderOnly,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    scope: d.scope,
    categoryIds: d.categoryIds,
    productIds: d.products.map((p) => p.id),
    isActive: d.isActive,
  };
}

export function CouponForm({ id, initial, initialProducts, categories, timezone }: CouponFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial, initialProducts));
  const [baseline, setBaseline] = useState(() => JSON.stringify(toInput(toDraft(initial, initialProducts))));
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [saving, startSaving] = useTransition();

  const input = useMemo(() => toInput(draft), [draft]);
  const inputKey = JSON.stringify(input);
  const dirty = inputKey !== baseline;
  const parsed = useMemo(() => couponSchema.safeParse(input), [input]);
  const clientErrors = useMemo(() => {
    const out: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) out[i.path.join(".")] ??= i.message;
    return out;
  }, [parsed]);
  const err = (key: string) => serverErrors[key]?.[0] ?? (showErrors ? clientErrors[key] : undefined);

  const patch = (p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setServerErrors({});
  };

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = () => {
    if (!parsed.success) {
      setShowErrors(true);
      toast.error("Revisá los campos marcados.");
      return;
    }
    startSaving(async () => {
      const res = await saveCoupon(id, input);
      if (!res.ok) {
        setServerErrors(res.fieldErrors ?? {});
        setShowErrors(true);
        toast.error(res.error);
        return;
      }
      setBaseline(inputKey);
      if (id) {
        toast.success("Cupón guardado.");
        router.refresh();
      } else {
        toast.success(`Cupón ${parsed.data.code} creado.`);
        router.push(`/admin/cupones/${res.data.id}`);
      }
    });
  };

  const discard = () => {
    setDraft(toDraft(initial, initialProducts));
    setServerErrors({});
    setShowErrors(false);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Código y descuento" />
        <CardBody className="space-y-4">
          <Field
            label="Código"
            required
            error={err("code")}
            hint="Lo que el cliente escribe en el checkout. Se guarda en mayúsculas, sin espacios."
          >
            <div className="flex gap-2">
              <Input
                value={draft.code}
                onChange={(e) => patch({ code: normalizeCouponCode(e.target.value) })}
                placeholder="BIENVENIDO10"
                maxLength={40}
                autoComplete="off"
                spellCheck={false}
                className="max-w-xs font-mono uppercase"
              />
              <Button onClick={() => patch({ code: generateCouponCode() })} icon={<Dices aria-hidden />}>
                Generar
              </Button>
            </div>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <Select
                value={draft.type}
                onChange={(e) => {
                  const type = COUPON_TYPES.find((t) => t === e.target.value) ?? "percent";
                  patch({ type, value: type === "free_shipping" ? "" : draft.value || "10" });
                }}
                options={COUPON_TYPES.map((t) => ({ value: t, label: COUPON_TYPE_LABELS[t] }))}
              />
            </Field>
            {draft.type !== "free_shipping" ? (
              <Field label="Valor" required error={err("value")}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={draft.value}
                  onChange={(e) => patch({ value: e.target.value })}
                  leading={draft.type === "fixed" ? "$" : undefined}
                  trailing={draft.type === "percent" ? "%" : undefined}
                />
              </Field>
            ) : (
              <p className="self-end pb-2 text-[13px] text-adm-fg-muted">El envío sale $ 0 en cualquier zona.</p>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Condiciones" description="Dejá vacío lo que no quieras limitar." />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Compra mínima" error={err("minSubtotal")} hint="Sobre el subtotal con promociones.">
              <Input type="number" inputMode="decimal" min={0} leading="$" value={draft.minSubtotal} onChange={(e) => patch({ minSubtotal: e.target.value })} />
            </Field>
            <Field label="Usos totales" error={err("maxUses")} hint="Vacío = sin límite.">
              <Input type="number" inputMode="numeric" min={1} step="1" value={draft.maxUses} onChange={(e) => patch({ maxUses: e.target.value })} />
            </Field>
            <Field label="Usos por cliente" error={err("maxUsesPerCustomer")} hint="Se cuenta por email.">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step="1"
                value={draft.maxUsesPerCustomer}
                onChange={(e) => patch({ maxUsesPerCustomer: e.target.value })}
              />
            </Field>
          </div>
          <Checkbox
            label="Sólo para la primera compra"
            description="No vale si ese email ya tiene un pedido (que no esté cancelado)."
            checked={draft.firstOrderOnly}
            onChange={(e) => patch({ firstOrderOnly: e.target.checked })}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Alcance" description="Sobre qué productos del carrito se calcula el descuento." />
        <CardBody className="space-y-4">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Alcance</legend>
            {PROMO_SCOPES.map((s) => (
              <label
                key={s}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center rounded-adm border px-3 text-sm",
                  draft.scope === s
                    ? "border-adm-accent bg-adm-accent-soft font-medium text-adm-accent"
                    : "border-adm-input-border bg-adm-surface hover:bg-adm-hover",
                )}
              >
                <input type="radio" name="coupon-scope" className="sr-only" checked={draft.scope === s} onChange={() => patch({ scope: s })} />
                {PROMO_SCOPE_LABELS[s]}
              </label>
            ))}
          </fieldset>
          {draft.scope === "categories" ? (
            <Field label="Categorías" error={err("categoryIds")} hint="Al tildar una categoría se tildan sus subcategorías.">
              <CategoryMultiSelect categories={categories} value={draft.categoryIds} onChange={(ids) => patch({ categoryIds: ids })} cascade />
            </Field>
          ) : null}
          {draft.scope === "products" ? (
            <Field label="Productos" error={err("productIds")}>
              <ProductMultiPicker value={draft.products} onChange={(products) => patch({ products })} />
            </Field>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Vigencia y estado" description={`Hora de la tienda (${timezone.replace(/_/g, " ")}). Vacío = sin límite.`} />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Empieza" error={err("startsAt")}>
              <Input type="datetime-local" value={draft.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} />
            </Field>
            <Field label="Termina" error={err("endsAt")}>
              <Input type="datetime-local" value={draft.endsAt} onChange={(e) => patch({ endsAt: e.target.value })} />
            </Field>
          </div>
          <Switch
            label="Activo"
            description="Pausalo para que deje de funcionar sin borrarlo."
            checked={draft.isActive}
            onCheckedChange={(v) => patch({ isActive: v })}
            className="max-w-md"
          />
        </CardBody>
      </Card>

      <SaveBar
        visible={dirty || !id}
        error={showErrors && !parsed.success}
        message={showErrors && !parsed.success ? "Revisá los campos marcados." : id ? "Cambios sin guardar" : "Cupón nuevo"}
        onDiscard={id ? discard : () => router.push("/admin/cupones")}
        discardLabel={id ? "Descartar" : "Cancelar"}
        onSave={save}
        saving={saving}
        saveLabel={id ? "Guardar" : "Crear cupón"}
        savingLabel={id ? "Guardando…" : "Creando…"}
      />
    </div>
  );
}

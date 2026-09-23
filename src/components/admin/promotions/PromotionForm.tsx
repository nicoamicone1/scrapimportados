"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { previewPromotion, savePromotion, type PromotionPreview } from "@/app/admin/(panel)/promociones/actions";
import { CategoryMultiSelect } from "@/components/admin/pricing/CategoryMultiSelect";
import { ProductMultiPicker } from "@/components/admin/pricing/ProductMultiPicker";
import { discountLabel, parseNumberInput, Thumb } from "@/components/admin/pricing/shared";
import { toast } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { SaveBar } from "@/components/ui/SaveBar";
import type { PickerProduct } from "@/lib/admin/pricing";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/money";
import type { CategoryLite } from "@/lib/pricing";
import { BADGE_MAX, PROMO_SCOPE_LABELS, PROMO_SCOPES, promotionSchema, type PromotionValues } from "@/lib/schemas/promotion";

export interface PromotionFormProps {
  id: string | null;
  initial: PromotionValues;
  initialProducts: PickerProduct[];
  categories: CategoryLite[];
  timezone: string;
}

interface Draft {
  name: string;
  type: PromotionValues["type"];
  value: string;
  scope: PromotionValues["scope"];
  categoryIds: string[];
  products: PickerProduct[];
  startsAt: string;
  endsAt: string;
  priority: string;
  stackable: boolean;
  badgeLabel: string;
  isActive: boolean;
}

function toDraft(v: PromotionValues, products: PickerProduct[]): Draft {
  return {
    name: v.name,
    type: v.type,
    value: String(v.value),
    scope: v.scope,
    categoryIds: v.categoryIds,
    products,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    priority: String(v.priority),
    stackable: v.stackable,
    badgeLabel: v.badgeLabel,
    isActive: v.isActive,
  };
}

function toInput(d: Draft) {
  return {
    name: d.name,
    type: d.type,
    value: parseNumberInput(d.value),
    scope: d.scope,
    categoryIds: d.categoryIds,
    productIds: d.products.map((p) => p.id),
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    priority: parseNumberInput(d.priority) ?? 0,
    stackable: d.stackable,
    badgeLabel: d.badgeLabel,
    isActive: d.isActive,
  };
}

export function PromotionForm({ id, initial, initialProducts, categories, timezone }: PromotionFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial, initialProducts));
  const [baseline, setBaseline] = useState(() => JSON.stringify(toInput(toDraft(initial, initialProducts))));
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();
  const [preview, setPreview] = useState<{ key: string; data: PromotionPreview | null; error: string | null } | null>(null);
  const reqId = useRef(0);

  const input = useMemo(() => toInput(draft), [draft]);
  const inputKey = JSON.stringify(input);
  const dirty = inputKey !== baseline;
  const parsed = useMemo(() => promotionSchema.safeParse(input), [input]);
  const clientErrors = useMemo(() => {
    const out: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) out[i.path.join(".")] ??= i.message;
    return out;
  }, [parsed]);
  const [showErrors, setShowErrors] = useState(false);
  const err = (key: string) => serverErrors[key]?.[0] ?? (showErrors ? clientErrors[key] : undefined);

  const patch = (p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setServerErrors({});
  };

  // Vista previa (debounce) cuando el borrador es válido.
  const validKey = parsed.success ? inputKey : null;
  useEffect(() => {
    if (!validKey) return;
    const current = ++reqId.current;
    const timer = setTimeout(async () => {
      const res = await previewPromotion(JSON.parse(validKey), id);
      if (current !== reqId.current) return;
      setPreview(res.ok ? { key: validKey, data: res.data, error: null } : { key: validKey, data: null, error: res.error });
    }, 450);
    return () => clearTimeout(timer);
  }, [validKey, id]);
  const currentPreview = preview && preview.key === validKey ? preview : null;

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
      const res = await savePromotion(id, input);
      if (!res.ok) {
        setServerErrors(res.fieldErrors ?? {});
        setShowErrors(true);
        toast.error(res.error);
        return;
      }
      setBaseline(inputKey);
      if (id) {
        toast.success("Promoción guardada.");
        router.refresh();
      } else {
        toast.success("Promoción creada.");
        router.push(`/admin/promociones/${res.data.id}`);
      }
    });
  };

  const discard = () => {
    const base = toDraft(initial, initialProducts);
    setDraft(base);
    setServerErrors({});
    setShowErrors(false);
  };

  const valueNumber = parseNumberInput(draft.value);

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Descuento" />
            <CardBody className="space-y-4">
              <Field label="Nombre" required error={err("name")} hint="Sólo lo ves vos en el admin.">
                <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Ej.: Semana del Hogar" maxLength={80} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo">
                  <Select
                    value={draft.type}
                    onChange={(e) => patch({ type: e.target.value === "fixed" ? "fixed" : "percent" })}
                    options={[
                      { value: "percent", label: "Porcentaje" },
                      { value: "fixed", label: "Monto fijo por unidad" },
                    ]}
                  />
                </Field>
                <Field label="Valor" required error={err("value")}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={draft.type === "percent" ? "1" : "100"}
                    value={draft.value}
                    onChange={(e) => patch({ value: e.target.value })}
                    leading={draft.type === "fixed" ? "$" : undefined}
                    trailing={draft.type === "percent" ? "%" : undefined}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Alcance" description="A qué productos se aplica." />
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
                    <input type="radio" name="promo-scope" className="sr-only" checked={draft.scope === s} onChange={() => patch({ scope: s })} />
                    {PROMO_SCOPE_LABELS[s]}
                  </label>
                ))}
              </fieldset>
              {draft.scope === "categories" ? (
                <Field
                  label="Categorías"
                  error={err("categoryIds")}
                  hint="Al tildar una categoría se tildan sus subcategorías. Podés destildar las que no quieras."
                >
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
            <CardHeader title="Vigencia" description={`Hora de la tienda (${timezone.replace(/_/g, " ")}). Vacío = sin límite.`} />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Field label="Empieza" error={err("startsAt")}>
                <Input type="datetime-local" value={draft.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} />
              </Field>
              <Field label="Termina" error={err("endsAt")}>
                <Input type="datetime-local" value={draft.endsAt} onChange={(e) => patch({ endsAt: e.target.value })} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Prioridad y combinación" />
            <CardBody className="space-y-4">
              <Field
                label="Prioridad"
                error={err("priority")}
                hint="Si un producto tiene varias promos, gana la de mayor prioridad. Si esa es acumulable, se le suman las otras acumulables (en cascada)."
              >
                <Input
                  type="number"
                  step="1"
                  value={draft.priority}
                  onChange={(e) => patch({ priority: e.target.value })}
                  className="max-w-32"
                />
              </Field>
              <Switch
                label="Acumulable"
                description="Se suma a otras promos acumulables del mismo producto."
                checked={draft.stackable}
                onCheckedChange={(v) => patch({ stackable: v })}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Etiqueta y estado" />
            <CardBody className="space-y-4">
              <Field
                label="Etiqueta"
                error={err("badgeLabel")}
                aside={`${draft.badgeLabel.length}/${BADGE_MAX}`}
                hint={`Se muestra sobre la foto del producto, ej. "Ciber Lunes". Si la dejás vacía se muestra el % de descuento.`}
              >
                <Input
                  value={draft.badgeLabel}
                  onChange={(e) => patch({ badgeLabel: e.target.value })}
                  maxLength={BADGE_MAX}
                  placeholder={valueNumber != null ? discountLabel(draft.type, valueNumber) : "Ciber Lunes"}
                  className="max-w-xs"
                />
              </Field>
              <Switch
                label="Activa"
                description="Pausala para cortarla sin borrarla. Si tiene fechas, sólo aplica dentro de la vigencia."
                checked={draft.isActive}
                onCheckedChange={(v) => patch({ isActive: v })}
              />
            </CardBody>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader
              title="Vista previa"
              description={
                currentPreview?.data
                  ? `Afecta a ${formatNumber(currentPreview.data.affectedCount)} ${currentPreview.data.affectedCount === 1 ? "producto activo" : "productos activos"}`
                  : "Así se ven los precios con esta promo."
              }
            />
            <CardBody className="p-0">
              {!parsed.success ? (
                <p className="px-4 py-4 text-[13px] text-adm-fg-muted">Completá el nombre, el valor y el alcance para ver cómo quedan los precios.</p>
              ) : !currentPreview ? (
                <p className="inline-flex items-center gap-2 px-4 py-4 text-[13px] text-adm-fg-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Calculando…
                </p>
              ) : currentPreview.error ? (
                <p className="px-4 py-4 text-[13px] text-adm-danger">{currentPreview.error}</p>
              ) : currentPreview.data && currentPreview.data.rows.length ? (
                <>
                  {currentPreview.data.scheduled ? (
                    <p className="border-b border-adm-border px-4 py-2 text-xs text-adm-fg-muted">
                      Precios al {formatDateTime(currentPreview.data.evaluatedAt, timezone)}, cuando empieza.
                    </p>
                  ) : null}
                  <ul>
                    {currentPreview.data.rows.map((r) => {
                      const winner = r.applied[0];
                      const thisApplies = r.applied.some((a) => a.isThis);
                      const before = r.compareAtPrice && r.compareAtPrice > r.listPrice ? r.compareAtPrice : r.listPrice;
                      return (
                        <li key={r.productId} className="flex items-start gap-2.5 border-b border-adm-border px-4 py-2.5 last:border-b-0">
                          <Thumb url={r.imageUrl} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium">{r.name}</p>
                            <p className="mt-0.5 text-xs text-adm-fg-muted">
                              {!thisApplies && winner
                                ? `Gana otra promo: ${winner.name}`
                                : winner && r.applied.length > 1
                                  ? `Se acumula con ${r.applied.filter((a) => !a.isThis).map((a) => a.name).join(", ")}`
                                  : !winner
                                    ? "Sin descuento con esta configuración"
                                    : null}
                            </p>
                          </div>
                          <div className="tnum text-right text-[13px]">
                            {r.finalPrice < before ? (
                              <span className="block text-xs text-adm-fg-muted line-through">{formatMoney(before)}</span>
                            ) : null}
                            <span className="block font-semibold">{formatMoney(r.finalPrice)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {currentPreview.data.affectedCount > currentPreview.data.rows.length ? (
                    <p className="border-t border-adm-border px-4 py-2 text-xs text-adm-fg-muted">
                      Mostrando {currentPreview.data.rows.length} de {formatNumber(currentPreview.data.affectedCount)}. Se combina con las demás promos activas.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="px-4 py-4 text-[13px] text-adm-fg-muted">No hay productos activos en este alcance.</p>
              )}
            </CardBody>
          </Card>
          {draft.badgeLabel || valueNumber ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-adm-fg-muted">
              Etiqueta en la tienda:
              <Badge tone="accent" dot={false}>
                {draft.badgeLabel || (valueNumber != null ? discountLabel(draft.type, valueNumber) : "")}
              </Badge>
            </p>
          ) : null}
        </div>
      </div>

      <SaveBar
        visible={dirty || !id}
        error={showErrors && !parsed.success}
        message={showErrors && !parsed.success ? "Revisá los campos marcados." : id ? "Cambios sin guardar" : "Promoción nueva"}
        onDiscard={id ? discard : () => router.push("/admin/promociones")}
        discardLabel={id ? "Descartar" : "Cancelar"}
        onSave={save}
        saving={saving}
        saveLabel={id ? "Guardar" : "Crear promoción"}
        savingLabel={id ? "Guardando…" : "Creando…"}
      />
    </div>
  );
}

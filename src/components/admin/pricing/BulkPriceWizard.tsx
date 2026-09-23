"use client";

import { AlertTriangle, History, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { applyPriceUpdate, loadScopeVariants, undoPriceBatch } from "@/app/admin/(panel)/precios/actions";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Checkbox, Input, Select } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { Switch } from "@/components/ui/Switch";
import { Table, TBody, TD, TH, THead, TR, TableEmpty } from "@/components/ui/Table";
import { toast } from "@/components/ui";
import { withPendingToast } from "@/components/ui/feedback";
import type { FacetOption, PickerProduct, ScopeVariant } from "@/lib/admin/pricing";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber, formatPercent } from "@/lib/money";
import {
  describeBulkRule,
  previewBulkUpdate,
  ROUNDING_DIRECTION_LABELS,
  ROUNDING_LABELS,
  SKIP_REASON_LABELS,
  type BulkActionType,
  type BulkRule,
  type CategoryLite,
  type PriceRounding,
  type RoundingDirection,
} from "@/lib/pricing";
import {
  bulkRuleSchema,
  DEFAULT_SCOPE,
  priceScopeSchema,
  SCOPE_KIND_LABELS,
  SCOPE_KINDS,
  type PriceScope,
} from "@/lib/schemas/price-update";

import { CategoryMultiSelect } from "./CategoryMultiSelect";
import { ProductMultiPicker } from "./ProductMultiPicker";
import { parseNumberInput, PriceChange, Thumb } from "./shared";

// ---------------------------------------------------------------------------
// Regla (borrador del form, con números como texto)
// ---------------------------------------------------------------------------

interface RuleDraft {
  type: BulkActionType;
  direction: "increase" | "decrease";
  value: string;
  alsoCompareAt: boolean;
  marginPercent: string;
  comparePercent: string;
  discountPercent: string;
  rounding: PriceRounding;
  roundingDirection: RoundingDirection;
  min: string;
  max: string;
}

const DEFAULT_DRAFT: RuleDraft = {
  type: "percent",
  direction: "increase",
  value: "10",
  alsoCompareAt: true,
  marginPercent: "40",
  comparePercent: "20",
  discountPercent: "15",
  rounding: "none",
  roundingDirection: "nearest",
  min: "",
  max: "",
};

const ACTION_OPTIONS: { value: BulkActionType; label: string; hint: string }[] = [
  { value: "percent", label: "Aumentar o bajar un porcentaje", hint: "Ej.: aumentar 8 % por inflación." },
  { value: "amount", label: "Aumentar o bajar un monto fijo", hint: "Ej.: sumar $ 500 a cada precio." },
  { value: "margin", label: "Fijar precio según costo + margen", hint: "Precio = costo × (1 + margen %). Las variantes sin costo se omiten." },
  { value: "compare_from_price", label: "Fijar precio tachado", hint: "Tachado = precio actual × (1 + %). El precio no cambia." },
  { value: "clear_compare", label: "Quitar precio tachado", hint: "Deja sólo el precio actual." },
  {
    value: "sale_from_price",
    label: "Armar una oferta",
    hint: "Copia el precio actual al tachado y le aplica un % de descuento.",
  },
];

function draftToRuleInput(d: RuleDraft): unknown {
  const n = (s: string) => parseNumberInput(s);
  let action: unknown;
  switch (d.type) {
    case "percent":
    case "amount":
      action = { type: d.type, direction: d.direction, value: n(d.value), alsoCompareAt: d.alsoCompareAt };
      break;
    case "margin":
      action = { type: "margin", marginPercent: n(d.marginPercent) };
      break;
    case "compare_from_price":
      action = { type: "compare_from_price", percent: n(d.comparePercent) };
      break;
    case "clear_compare":
      action = { type: "clear_compare" };
      break;
    case "sale_from_price":
      action = { type: "sale_from_price", discountPercent: n(d.discountPercent) };
      break;
  }
  return { action, rounding: d.rounding, roundingDirection: d.roundingDirection, min: n(d.min), max: n(d.max) };
}

/** Primer mensaje por campo ("action.value" → "Tiene que ser mayor a 0."). */
function issuesToMap(issues: readonly { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

// ---------------------------------------------------------------------------

type PreviewFilter = "changed" | "unchanged" | "skipped" | "excluded" | "all";
const PER_PAGE = 50;

export interface BulkPriceWizardProps {
  categories: CategoryLite[];
  brands: FacetOption[];
  tags: FacetOption[];
}

export function BulkPriceWizard({ categories, brands, tags }: BulkPriceWizardProps) {
  // Paso 1: alcance
  const [scopeDraft, setScopeDraft] = useState<PriceScope>(DEFAULT_SCOPE);
  const [pickedProducts, setPickedProducts] = useState<PickerProduct[]>([]);
  const [minPriceText, setMinPriceText] = useState("");
  const [maxPriceText, setMaxPriceText] = useState("");
  /** Último resultado de carga, asociado a la clave del alcance que lo pidió. */
  const [loaded, setLoaded] = useState<{ key: string; variants: ScopeVariant[] | null; error: string | null; tooMany: boolean } | null>(null);
  const [reloading, setReloading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reqId = useRef(0);

  // Paso 2: regla
  const [draft, setDraft] = useState<RuleDraft>(DEFAULT_DRAFT);
  const [quickPercent, setQuickPercent] = useState("10");

  // Paso 3: vista previa
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PreviewFilter>("changed");
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastBatch, setLastBatch] = useState<{ batchId: string; applied: number; skipped: number; partial: boolean } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const scope: PriceScope = useMemo(
    () => ({
      ...scopeDraft,
      productIds: pickedProducts.map((p) => p.id),
      minPrice: parseNumberInput(minPriceText),
      maxPrice: parseNumberInput(maxPriceText),
    }),
    [scopeDraft, pickedProducts, minPriceText, maxPriceText],
  );
  const scopeParsed = priceScopeSchema.safeParse(scope);
  const scopeKey = scopeParsed.success ? JSON.stringify(scopeParsed.data) : null;

  // Carga las variantes del alcance (debounce) cada vez que cambia.
  useEffect(() => {
    if (!scopeKey) return;
    const current = ++reqId.current;
    const timer = setTimeout(async () => {
      const res = await loadScopeVariants(JSON.parse(scopeKey));
      if (current !== reqId.current) return;
      setReloading(false);
      setExcluded(new Set());
      setPage(1);
      setLoaded(
        res.ok
          ? { key: scopeKey, variants: res.data.tooMany ? null : res.data.variants, error: null, tooMany: res.data.tooMany }
          : { key: scopeKey, variants: null, error: res.error, tooMany: false },
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [scopeKey, reloadKey]);

  const current = loaded && scopeKey && loaded.key === scopeKey ? loaded : null;
  const variants = current?.variants ?? null;
  const scopeError = current?.error ?? null;
  const tooMany = current?.tooMany ?? false;
  const loadingScope = Boolean(scopeKey) && (!current || reloading);

  const ruleParsed = useMemo(() => bulkRuleSchema.safeParse(draftToRuleInput(draft)), [draft]);
  const rule: BulkRule | null = ruleParsed.success ? ruleParsed.data : null;
  const ruleErrors = ruleParsed.success ? {} : issuesToMap(ruleParsed.error.issues);

  const preview = useMemo(() => (variants && rule ? previewBulkUpdate(variants, rule) : null), [variants, rule]);

  const productCount = useMemo(() => new Set((variants ?? []).map((v) => v.productId)).size, [variants]);
  const toApply = preview ? preview.rows.filter((r) => r.changed && !excluded.has(r.variant.id)) : [];
  const applyOld = toApply.reduce((acc, r) => acc + r.oldPrice, 0);
  const applyNew = toApply.reduce((acc, r) => acc + r.newPrice, 0);
  const applyChangePercent = applyOld > 0 ? Math.round(((applyNew - applyOld) / applyOld) * 10000) / 100 : 0;

  const filteredRows = useMemo(() => {
    if (!preview) return [];
    const term = search.trim().toLowerCase();
    return preview.rows.filter((r) => {
      const isExcluded = excluded.has(r.variant.id);
      const matchFilter =
        filter === "all" ||
        (filter === "changed" && r.changed && !isExcluded) ||
        (filter === "unchanged" && !r.changed && !r.skipped) ||
        (filter === "skipped" && r.skipped !== null) ||
        (filter === "excluded" && isExcluded && r.changed);
      if (!matchFilter) return false;
      if (!term) return true;
      return (
        r.variant.productName.toLowerCase().includes(term) ||
        (r.variant.sku ?? "").toLowerCase().includes(term) ||
        r.variant.title.toLowerCase().includes(term)
      );
    });
  }, [preview, search, filter, excluded]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const excludedChanged = preview ? preview.rows.filter((r) => r.changed && excluded.has(r.variant.id)).length : 0;

  const setScopeKind = (kind: PriceScope["kind"]) => setScopeDraft((s) => ({ ...s, kind }));
  const patchDraft = (patch: Partial<RuleDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const toggleRow = (id: string, include: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (include) next.delete(id);
      else next.add(id);
      return next;
    });

  const changeablePage = pageRows.filter((r) => r.changed);
  const allPageIncluded = changeablePage.length > 0 && changeablePage.every((r) => !excluded.has(r.variant.id));
  const togglePage = (include: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const r of changeablePage) {
        if (include) next.delete(r.variant.id);
        else next.add(r.variant.id);
      }
      return next;
    });

  const quickPrepare = () => {
    const pct = parseNumberInput(quickPercent);
    if (pct == null || pct <= 0) {
      toast.error("Ingresá un porcentaje mayor a 0.");
      return;
    }
    setScopeDraft({ ...DEFAULT_SCOPE });
    setPickedProducts([]);
    setMinPriceText("");
    setMaxPriceText("");
    setDraft({ ...DEFAULT_DRAFT, type: "percent", direction: "increase", value: String(pct), alsoCompareAt: true });
    setFilter("changed");
    setSearch("");
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const undo = async (batchId: string) => {
    const res = await undoPriceBatch(batchId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data.skipped
        ? `Se restauraron ${formatNumber(res.data.restored)} variantes. ${formatNumber(res.data.skipped)} no se tocaron porque cambiaron después.`
        : `Listo: se restauraron ${formatNumber(res.data.restored)} variantes.`,
    );
    setLastBatch(null);
    setReloading(true);
    setReloadKey((k) => k + 1);
  };

  const apply = async () => {
    if (!rule) return;
    const res = await applyPriceUpdate({
      scope: scopeParsed.success ? scopeParsed.data : scope,
      rule,
      excludedIds: [...excluded],
      expectedCount: toApply.length,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { batchId, applied, skipped, partial } = res.data;
    setLastBatch(batchId ? { batchId, applied, skipped, partial } : null);
    if (batchId) {
      toast.success(`Listo: ${formatNumber(applied)} variantes actualizadas.`, {
        action: { label: "Deshacer", onClick: () => void undo(batchId) },
        duration: 10000,
      });
    }
    setReloading(true);
    setReloadKey((k) => k + 1);
  };

  const scopeFieldError = (key: string) =>
    !scopeParsed.success ? scopeParsed.error.issues.find((i) => i.path.join(".") === key)?.message : undefined;

  const summary = preview?.summary;

  return (
    <div className="space-y-5">
      {/* Modo rápido */}
      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Aumento rápido</p>
            <p className="text-[13px] text-adm-fg-muted">
              Prepara el asistente para aumentar todo el catálogo. Revisás la vista previa antes de aplicar.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <Field label="Aumentar todo el catálogo">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={quickPercent}
                onChange={(e) => setQuickPercent(e.target.value)}
                trailing="%"
                className="w-28"
              />
            </Field>
            <Button variant="primary" size="lg" onClick={quickPrepare}>
              Preparar
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Paso 1 */}
      <Card>
        <CardHeader
          title="1. Alcance"
          description="Elegí a qué variantes se aplica el cambio. Los productos archivados no se tocan."
          actions={
            <span className="tnum text-[13px] text-adm-fg-muted" aria-live="polite">
              {loadingScope ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Calculando…
                </span>
              ) : variants ? (
                `${formatNumber(variants.length)} variantes de ${formatNumber(productCount)} productos`
              ) : null}
            </span>
          }
        />
        <CardBody className="space-y-4">
          <fieldset>
            <legend className="sr-only">Tipo de alcance</legend>
            <div className="flex flex-wrap gap-2">
              {SCOPE_KINDS.map((kind) => (
                <label
                  key={kind}
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center gap-2 rounded-adm border px-3 text-sm",
                    scopeDraft.kind === kind
                      ? "border-adm-accent bg-adm-accent-soft font-medium text-adm-accent"
                      : "border-adm-input-border bg-adm-surface hover:bg-adm-hover",
                  )}
                >
                  <input
                    type="radio"
                    name="scope-kind"
                    value={kind}
                    checked={scopeDraft.kind === kind}
                    onChange={() => setScopeKind(kind)}
                    className="sr-only"
                  />
                  {SCOPE_KIND_LABELS[kind]}
                </label>
              ))}
            </div>
          </fieldset>

          {scopeDraft.kind === "categories" ? (
            <div className="space-y-2">
              <Field label="Categorías" error={scopeFieldError("categoryIds")}>
                <CategoryMultiSelect
                  categories={categories}
                  value={scopeDraft.categoryIds}
                  onChange={(ids) => setScopeDraft((s) => ({ ...s, categoryIds: ids }))}
                />
              </Field>
              <Checkbox
                label="Incluir subcategorías"
                description="Si elegís una categoría madre, también toma los productos de sus hijas."
                checked={scopeDraft.includeChildren}
                onChange={(e) => setScopeDraft((s) => ({ ...s, includeChildren: e.target.checked }))}
              />
            </div>
          ) : null}

          {scopeDraft.kind === "products" ? (
            <Field label="Productos" error={scopeFieldError("productIds")}>
              <ProductMultiPicker value={pickedProducts} onChange={setPickedProducts} />
            </Field>
          ) : null}

          {scopeDraft.kind === "brand" ? (
            <Field
              label="Marca"
              error={scopeFieldError("brand")}
              hint={brands.length ? undefined : "Todavía no hay marcas cargadas en los productos."}
            >
              <Select
                value={scopeDraft.brand}
                onChange={(e) => setScopeDraft((s) => ({ ...s, brand: e.target.value }))}
                placeholder="Elegí una marca"
                disabled={!brands.length}
                options={brands.map((b) => ({ value: b.value, label: `${b.value} (${b.count})` }))}
                className="max-w-sm"
              />
            </Field>
          ) : null}

          {scopeDraft.kind === "tag" ? (
            <Field
              label="Etiqueta"
              error={scopeFieldError("tag")}
              hint={tags.length ? undefined : "Todavía no hay etiquetas cargadas en los productos."}
            >
              <Select
                value={scopeDraft.tag}
                onChange={(e) => setScopeDraft((s) => ({ ...s, tag: e.target.value }))}
                placeholder="Elegí una etiqueta"
                disabled={!tags.length}
                options={tags.map((t) => ({ value: t.value, label: `${t.value} (${t.count})` }))}
                className="max-w-sm"
              />
            </Field>
          ) : null}

          {scopeDraft.kind === "price_range" ? (
            <div className="grid max-w-md grid-cols-2 gap-3">
              <Field label="Precio desde" error={scopeFieldError("minPrice")}>
                <Input type="number" inputMode="decimal" min={0} leading="$" value={minPriceText} onChange={(e) => setMinPriceText(e.target.value)} />
              </Field>
              <Field label="Precio hasta" error={scopeFieldError("maxPrice")}>
                <Input type="number" inputMode="decimal" min={0} leading="$" value={maxPriceText} onChange={(e) => setMaxPriceText(e.target.value)} />
              </Field>
            </div>
          ) : null}

          <Switch
            label="Sólo variantes con stock"
            description="Deja afuera las que no tienen stock (las que no controlan stock se incluyen)."
            checked={scopeDraft.inStockOnly}
            onCheckedChange={(v) => setScopeDraft((s) => ({ ...s, inStockOnly: v }))}
            className="max-w-md"
          />

          {scopeError ? <p className="text-[13px] text-adm-danger">{scopeError}</p> : null}
          {tooMany ? (
            <p className="text-[13px] text-adm-warning">El alcance tiene demasiadas variantes para un solo cambio. Achicalo por categoría o marca.</p>
          ) : null}
        </CardBody>
      </Card>

      {/* Paso 2 */}
      <Card>
        <CardHeader title="2. Regla" description={rule ? describeBulkRule(rule) : "Completá la regla."} />
        <CardBody className="grid gap-6 lg:grid-cols-2">
          <fieldset className="space-y-1">
            <legend className="mb-2 text-[13px] font-medium">Qué querés hacer</legend>
            {ACTION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-adm border px-3 py-2",
                  draft.type === opt.value ? "border-adm-accent bg-adm-accent-soft/60" : "border-transparent hover:bg-adm-hover",
                )}
              >
                <input
                  type="radio"
                  name="rule-type"
                  value={opt.value}
                  checked={draft.type === opt.value}
                  onChange={() => patchDraft({ type: opt.value })}
                  className="mt-1 size-4 shrink-0 accent-[var(--adm-accent)]"
                />
                <span>
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-xs text-adm-fg-muted">{opt.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="space-y-4">
            {draft.type === "percent" || draft.type === "amount" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Dirección">
                    <Select
                      value={draft.direction}
                      onChange={(e) => patchDraft({ direction: e.target.value === "decrease" ? "decrease" : "increase" })}
                      options={[
                        { value: "increase", label: "Aumentar" },
                        { value: "decrease", label: "Bajar" },
                      ]}
                    />
                  </Field>
                  <Field label={draft.type === "percent" ? "Porcentaje" : "Monto"} error={ruleErrors["action.value"]}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={draft.type === "percent" ? "0.5" : "1"}
                      value={draft.value}
                      onChange={(e) => patchDraft({ value: e.target.value })}
                      leading={draft.type === "amount" ? "$" : undefined}
                      trailing={draft.type === "percent" ? "%" : undefined}
                    />
                  </Field>
                </div>
                <Checkbox
                  label="Aplicar lo mismo al precio tachado"
                  description="Si la variante tiene tachado, se ajusta igual para que la oferta se mantenga."
                  checked={draft.alsoCompareAt}
                  onChange={(e) => patchDraft({ alsoCompareAt: e.target.checked })}
                />
              </>
            ) : null}

            {draft.type === "margin" ? (
              <Field label="Margen sobre el costo" error={ruleErrors["action.marginPercent"]} hint="40 % sobre un costo de $ 1.000 da $ 1.400.">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={draft.marginPercent}
                  onChange={(e) => patchDraft({ marginPercent: e.target.value })}
                  trailing="%"
                  className="max-w-40"
                />
              </Field>
            ) : null}

            {draft.type === "compare_from_price" ? (
              <Field label="Tachado por encima del precio" error={ruleErrors["action.percent"]} hint="Con 20 %, un precio de $ 10.000 muestra tachado $ 12.000.">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={draft.comparePercent}
                  onChange={(e) => patchDraft({ comparePercent: e.target.value })}
                  trailing="%"
                  className="max-w-40"
                />
              </Field>
            ) : null}

            {draft.type === "sale_from_price" ? (
              <Field
                label="Descuento de la oferta"
                error={ruleErrors["action.discountPercent"]}
                hint="Con 15 %, $ 10.000 pasa a $ 8.500 y $ 10.000 queda tachado."
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={99}
                  value={draft.discountPercent}
                  onChange={(e) => patchDraft({ discountPercent: e.target.value })}
                  trailing="%"
                  className="max-w-40"
                />
              </Field>
            ) : null}

            {draft.type !== "clear_compare" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Redondeo">
                    <Select
                      value={draft.rounding}
                      onChange={(e) => patchDraft({ rounding: e.target.value as PriceRounding })}
                      options={(Object.keys(ROUNDING_LABELS) as PriceRounding[]).map((k) => ({ value: k, label: ROUNDING_LABELS[k] }))}
                    />
                  </Field>
                  <Field label="Hacia">
                    <Select
                      value={draft.roundingDirection}
                      disabled={draft.rounding === "none"}
                      onChange={(e) => patchDraft({ roundingDirection: e.target.value as RoundingDirection })}
                      options={(Object.keys(ROUNDING_DIRECTION_LABELS) as RoundingDirection[]).map((k) => ({
                        value: k,
                        label: ROUNDING_DIRECTION_LABELS[k].replace(/^./, (c) => c.toUpperCase()),
                      }))}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="No bajar de" hint="Opcional." error={ruleErrors.min}>
                    <Input type="number" inputMode="decimal" min={0} leading="$" value={draft.min} onChange={(e) => patchDraft({ min: e.target.value })} />
                  </Field>
                  <Field label="No superar" hint="Opcional." error={ruleErrors.max}>
                    <Input type="number" inputMode="decimal" min={0} leading="$" value={draft.max} onChange={(e) => patchDraft({ max: e.target.value })} />
                  </Field>
                </div>
                <p className="text-xs text-adm-fg-muted">
                  El tope se aplica sobre el valor que cambia la regla ({draft.type === "compare_from_price" ? "el tachado" : "el precio"}), después del
                  redondeo.
                </p>
              </>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {/* Paso 3 */}
      <div ref={previewRef} className="scroll-mt-4">
        <Card>
          <CardHeader
            title="3. Vista previa"
            description={
              summary
                ? `${formatNumber(toApply.length)} variantes cambian · ${formatNumber(summary.skipped)} omitidas · ${formatNumber(summary.unchanged)} sin cambios${
                    toApply.length ? ` · variación ${applyChangePercent > 0 ? "+" : ""}${formatPercent(applyChangePercent)}` : ""
                  }`
                : "Completá el alcance y la regla para ver cómo quedan los precios."
            }
            actions={
              <ButtonLink href="/admin/precios/historial" variant="ghost" size="sm" icon={<History aria-hidden />}>
                Historial
              </ButtonLink>
            }
          />
          {lastBatch ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-adm-border bg-adm-accent-soft/50 px-4 py-3 text-[13px]">
              <span>
                Se actualizaron <strong className="tnum">{formatNumber(lastBatch.applied)}</strong> variantes
                {lastBatch.skipped ? ` (${formatNumber(lastBatch.skipped)} no, porque cambiaron mientras tanto)` : ""}.
                {lastBatch.partial ? " El proceso se cortó antes de terminar: revisá el historial." : ""}
              </span>
              <span className="ml-auto flex gap-2">
                <Button size="sm" onClick={() => void withPendingToast("Restaurando precios…", () => undo(lastBatch.batchId))}>
                  Deshacer
                </Button>
                <ButtonLink size="sm" variant="ghost" href="/admin/precios/historial">
                  Ver historial
                </ButtonLink>
              </span>
            </div>
          ) : null}

          {preview ? (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-adm-border px-4 py-3">
                <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar en la vista previa…" />
                <Select
                  size="sm"
                  aria-label="Filtrar filas"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value as PreviewFilter);
                    setPage(1);
                  }}
                  className="w-56"
                  options={[
                    { value: "changed", label: `Cambian (${formatNumber(toApply.length)})` },
                    { value: "skipped", label: `Omitidas (${formatNumber(summary?.skipped ?? 0)})` },
                    { value: "unchanged", label: `Sin cambios (${formatNumber(summary?.unchanged ?? 0)})` },
                    { value: "excluded", label: `Excluidas a mano (${formatNumber(excludedChanged)})` },
                    { value: "all", label: `Todas (${formatNumber(preview.rows.length)})` },
                  ]}
                />
                {excludedChanged ? (
                  <Button size="sm" variant="ghost" onClick={() => setExcluded(new Set())}>
                    Volver a incluir todas
                  </Button>
                ) : null}
              </div>
              <Table containerClassName="rounded-none border-0 max-h-[640px]">
                <THead>
                  <tr>
                    <TH className="w-10">
                      <Checkbox
                        aria-label="Incluir todas las filas de esta página"
                        checked={allPageIncluded}
                        disabled={!changeablePage.length}
                        onChange={(e) => togglePage(e.target.checked)}
                      />
                    </TH>
                    <TH>Producto</TH>
                    <TH>SKU</TH>
                    <TH numeric>Precio</TH>
                    <TH numeric>Tachado</TH>
                    <TH numeric>Diferencia</TH>
                  </tr>
                </THead>
                <TBody>
                  {pageRows.length === 0 ? (
                    <TableEmpty
                      colSpan={6}
                      title={search ? "No hay variantes con esa búsqueda." : "No hay filas en este filtro."}
                      description={filter === "changed" && !search ? "Con esta regla ninguna variante cambia de precio." : undefined}
                    />
                  ) : (
                    pageRows.map((r) => {
                      const isExcluded = excluded.has(r.variant.id);
                      const included = r.changed && !isExcluded;
                      return (
                        <TR key={r.variant.id} className={cn(!included && "text-adm-fg-muted")}>
                          <TD>
                            <Checkbox
                              aria-label={`Incluir ${r.variant.productName}`}
                              checked={included}
                              disabled={!r.changed}
                              onChange={(e) => toggleRow(r.variant.id, e.target.checked)}
                            />
                          </TD>
                          <TD className="max-w-[360px]">
                            <span className="flex items-center gap-2.5">
                              <Thumb url={r.variant.imageUrl} />
                              <span className="min-w-0">
                                <span className={cn("block truncate font-medium", included ? "text-adm-fg" : "text-adm-fg-muted")}>
                                  {r.variant.productName}
                                </span>
                                {r.variant.title && r.variant.title !== "Default" ? (
                                  <span className="block truncate text-xs text-adm-fg-muted">{r.variant.title}</span>
                                ) : null}
                              </span>
                            </span>
                          </TD>
                          <TD className="font-mono text-xs text-adm-fg-muted">{r.variant.sku ?? "—"}</TD>
                          <TD numeric>
                            <PriceChange from={r.oldPrice} to={r.newPrice} />
                          </TD>
                          <TD numeric>
                            <PriceChange from={r.oldCompareAt} to={r.newCompareAt} />
                          </TD>
                          <TD numeric>
                            {r.skipped ? (
                              <span className="text-xs text-adm-fg-muted">{SKIP_REASON_LABELS[r.skipped]}</span>
                            ) : r.priceDiff !== 0 ? (
                              <span className="inline-flex items-center gap-1.5">
                                {r.clamped ? (
                                  <Badge tone="amber" dot={false} title="El tope recortó este valor">
                                    Tope
                                  </Badge>
                                ) : null}
                                <span className={cn(r.priceDiff > 0 ? "text-adm-fg" : "text-adm-success")}>
                                  {r.priceDiff > 0 ? "+" : "−"}
                                  {formatMoney(Math.abs(r.priceDiff))}
                                </span>
                                <span className="text-xs text-adm-fg-muted">
                                  ({r.priceDiffPercent > 0 ? "+" : ""}
                                  {formatPercent(r.priceDiffPercent)})
                                </span>
                              </span>
                            ) : r.changed ? (
                              <span className="text-xs text-adm-fg-muted">{r.compareCleared ? "Se quita el tachado" : "Sólo tachado"}</span>
                            ) : (
                              <span className="text-xs text-adm-fg-muted">Sin cambios</span>
                            )}
                          </TD>
                        </TR>
                      );
                    })
                  )}
                </TBody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-border px-4 py-2">
                <p className="tnum text-[13px] text-adm-fg-muted">
                  {filteredRows.length
                    ? `${formatNumber((safePage - 1) * PER_PAGE + 1)}–${formatNumber(Math.min(safePage * PER_PAGE, filteredRows.length))} de ${formatNumber(filteredRows.length)}`
                    : "0 filas"}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                    Anterior
                  </Button>
                  <Button size="sm" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <CardBody>
              <p className="text-[13px] text-adm-fg-muted">
                {loadingScope ? "Calculando…" : !scopeParsed.success ? "Completá el alcance." : !rule ? "Revisá la regla." : "Sin variantes para mostrar."}
              </p>
            </CardBody>
          )}
        </Card>
      </div>

      {/* Barra de aplicar */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 rounded-adm border border-adm-border bg-adm-surface px-4 py-3 shadow-[var(--adm-shadow)]">
        {rule && summary?.skipped ? (
          <span className="mr-auto inline-flex items-center gap-1.5 text-[13px] text-adm-warning">
            <AlertTriangle className="size-4" aria-hidden />
            {formatNumber(summary.skipped)} variantes se omiten (ver filtro Omitidas).
          </span>
        ) : (
          <span className="mr-auto text-[13px] text-adm-fg-muted">Cada cambio queda en el historial y se puede deshacer.</span>
        )}
        <Button variant="primary" size="lg" disabled={!rule || !toApply.length || loadingScope} onClick={() => setConfirmOpen(true)}>
          {toApply.length === 1 ? "Aplicar a 1 variante" : `Aplicar a ${formatNumber(toApply.length)} variantes`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Cambiar el precio de ${formatNumber(toApply.length)} variantes`}
        description="Se aplica en la tienda al instante. Vas a poder deshacerlo desde el historial."
        confirmLabel={toApply.length === 1 ? "Aplicar a 1 variante" : `Aplicar a ${formatNumber(toApply.length)} variantes`}
        onConfirm={apply}
      >
        <dl className="space-y-2 text-[13px]">
          <div>
            <dt className="text-adm-fg-muted">Regla</dt>
            <dd>{rule ? describeBulkRule(rule) : "—"}</dd>
          </div>
          <div>
            <dt className="text-adm-fg-muted">Suma de los precios que cambian</dt>
            <dd className="tnum">
              {formatMoney(applyOld)} → {formatMoney(applyNew)} ({applyChangePercent > 0 ? "+" : ""}
              {formatPercent(applyChangePercent)})
            </dd>
          </div>
          {excludedChanged ? (
            <div>
              <dt className="text-adm-fg-muted">Excluidas a mano</dt>
              <dd className="tnum">{formatNumber(excludedChanged)}</dd>
            </div>
          ) : null}
        </dl>
      </ConfirmDialog>
    </div>
  );
}

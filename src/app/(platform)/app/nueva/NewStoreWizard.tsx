"use client";

import { ArrowLeft, ArrowRight, Check, Circle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { createStore } from "@/app/(platform)/app/actions";
import { PresetThumb, presetFontsHref } from "@/components/admin/appearance/PresetThumb";
import { FlowProgress } from "@/components/platform/AccountShell";
import { DISPLAY, FormAlert } from "@/components/platform/brand";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Checkbox, Input, Select } from "@/components/ui/Input";
import { toWhatsAppNumber } from "@/lib/admin/whatsapp";
import { cn } from "@/lib/cn";
import { PROVINCE_OPTIONS } from "@/lib/shipping/provinces";
import { checkStoreSlug, type SlugCheck } from "@/lib/tenant/actions";
import { presetForKind, STORE_KINDS, type StoreKind } from "@/lib/tenant/kinds";
import { toStoreSlug } from "@/lib/tenant/slug";
import { storeDisplayHost } from "@/lib/tenant/urls";
import { PRESET_LIST, PRESETS } from "@/lib/theme/presets";

/*
 * Alta de tienda en DOS pasos (antes eran tres: tienda → contacto → cobros):
 *
 * 1. Tu tienda: nombre (la dirección sale sola y se verifica en vivo; se
 *    edita sólo si hace falta) y rubro, que define el estilo.
 * 2. Pedidos y cobros: WhatsApp (en el formato que lo escriba la persona; se
 *    normaliza a 549…), transferencia con 10 % de descuento y alias. CBU,
 *    titular, ciudad, provincia y moneda quedan plegados: tienen defaults o se
 *    completan después en Configuración.
 *
 * En desktop, al costado, la vista previa de la tienda con el estilo del
 * rubro y lo que ya queda configurado. Borrador en localStorage (spec §14.3).
 */

const STORAGE_KEY = "ecommy:nueva-tienda";

interface Draft {
  step: 1 | 2;
  name: string;
  slug: string;
  slugEdited: boolean;
  kind: StoreKind | "";
  whatsapp: string;
  city: string;
  province: string;
  currency: "ARS" | "USD";
  transferEnabled: boolean;
  transferDiscount: string;
  bankName: string;
  holder: string;
  cbu: string;
  alias: string;
  cuit: string;
  whatsappEnabled: boolean;
}

const EMPTY: Draft = {
  step: 1,
  name: "",
  slug: "",
  slugEdited: false,
  kind: "",
  whatsapp: "",
  city: "",
  province: "",
  currency: "ARS",
  transferEnabled: true,
  transferDiscount: "10",
  bankName: "",
  holder: "",
  cbu: "",
  alias: "",
  cuit: "",
  whatsappEnabled: true,
};

function loadDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const saved = { ...EMPTY, ...(JSON.parse(raw) as Partial<Omit<Draft, "step">> & { step?: number }) };
    // Borradores del wizard de 3 pasos: el 3 (cobros) ahora es el 2.
    return { ...saved, step: saved.step && saved.step >= 2 ? 2 : 1 };
  } catch {
    return EMPTY;
  }
}

/** Controles de 44 px y 16 px de texto en el celular (sin zoom de iOS). */
const TOUCH = "max-sm:h-11 max-sm:text-base";

/** Fuentes de los presets de los rubros (sólo esos, no todo el catálogo). */
const KIND_FONTS_HREF = presetFontsHref([...new Set(STORE_KINDS.map((k) => k.preset))].map((id) => PRESETS[id]));

/** "5493816173548" → "+54 9 381 617-3548" (sólo para mostrar; números de otro país quedan con +). */
function formatWhatsApp(n: string): string {
  if (n.startsWith("549") && n.length === 13) return `+54 9 ${n.slice(3, 6)} ${n.slice(6, 9)}-${n.slice(9)}`;
  return `+${n}`;
}

/** Miniatura fiel del preset del rubro (la misma del selector de Apariencia), con el nombre de la tienda. */
function PresetSwatch({ kind, brand, className }: { kind: StoreKind; brand: string; className?: string }) {
  const id = presetForKind(kind);
  const meta = PRESET_LIST.find((p) => p.id === id);
  return (
    <PresetThumb
      theme={PRESETS[id]}
      brand={brand}
      headline={meta?.mood ?? brand}
      labels={meta?.industries}
      className={cn("rounded-[4px] border border-adm-border", className)}
    />
  );
}

/** Vista previa al costado (desktop): la tienda con su estilo y lo que ya queda listo. */
function Preview({ draft, whatsapp }: { draft: Draft; whatsapp: string | null }) {
  const kind = draft.kind || "otro";
  const kindMeta = STORE_KINDS.find((k) => k.id === kind);
  const preset = PRESET_LIST.find((p) => p.id === presetForKind(kind));
  const brand = draft.name.trim() || "Tu tienda";
  const host = storeDisplayHost({ slug: draft.slug || "tu-tienda" });
  const discount = Number(draft.transferDiscount || 0);
  const items: { done: boolean; text: string }[] = [
    {
      done: Boolean(draft.kind),
      text: draft.kind ? `Estilo ${preset?.name ?? ""} para ${kindMeta?.label.toLowerCase() ?? "tu rubro"}` : "Elegí el rubro y ves su estilo",
    },
    {
      done: Boolean(whatsapp),
      text: whatsapp ? `Pedidos por WhatsApp a ${formatWhatsApp(whatsapp)}` : "Falta el WhatsApp donde te llegan los pedidos",
    },
    {
      done: draft.transferEnabled,
      text: draft.transferEnabled
        ? discount > 0
          ? `Transferencia con ${discount} % de descuento`
          : "Transferencia, sin descuento"
        : "Sin transferencia: cobrás acordando por WhatsApp",
    },
    { done: true, text: "14 días de Pro con todas las funciones, sin tarjeta" },
  ];
  return (
    <aside aria-label="Vista previa de tu tienda" className="sticky top-8">
      <p className="text-[12px] font-medium tracking-[0.08em] text-adm-accent-2-ink uppercase">Así arranca tu tienda</p>
      <div className="mt-3 overflow-hidden rounded-[10px] border border-adm-border bg-adm-surface">
        <div className="flex h-8 items-center border-b border-adm-border bg-adm-surface-2 px-3">
          <span className="tnum truncate text-[12px] text-adm-fg-muted">{host}</span>
        </div>
        <PresetSwatch kind={kind} brand={brand} className="rounded-none border-0" />
      </div>
      <ul className="mt-5 space-y-2.5 text-[13px]">
        {items.map((item) => (
          <li key={item.text} className="flex gap-2.5">
            {item.done ? (
              <Check className="mt-0.5 size-4 shrink-0 text-adm-accent" strokeWidth={1.75} aria-hidden />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-adm-fg-muted" strokeWidth={1.5} aria-hidden />
            )}
            <span className={item.done ? "" : "text-adm-fg-muted"}>{item.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12px] leading-relaxed text-adm-fg-muted">Todo se cambia después desde el panel: estilo, colores, logo y cobros.</p>
    </aside>
  );
}

/**
 * `firstStore`: viene del registro, así que los pasos se cuentan junto con
 * la cuenta ("Paso 2 de 3"); con otra tienda ya creada, "Paso 1 de 2".
 */
export function NewStoreWizard({ firstStore = false }: { firstStore?: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [slugState, setSlugState] = useState<{ slug: string; result: SlugCheck | "checking" } | null>(null);
  const [editSlug, setEditSlug] = useState(false);
  const [checking, setChecking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const checkSeq = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Borrador en localStorage hasta crear la tienda (spec §14.3).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar desde localStorage sólo puede pasar en el cliente
    setDraft(loadDraft());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Sin storage: el wizard funciona igual, sólo no se recuerda.
    }
  }, [draft, hydrated]);

  // Disponibilidad del slug en vivo (debounce 350 ms).
  useEffect(() => {
    const slug = draft.slug;
    if (!slug) return;
    const seq = ++checkSeq.current;
    const t = window.setTimeout(async () => {
      setSlugState({ slug, result: "checking" });
      const result = await checkStoreSlug(slug);
      if (seq === checkSeq.current) setSlugState({ slug, result });
    }, 350);
    return () => window.clearTimeout(t);
  }, [draft.slug]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const err = (k: string) => errors[k]?.[0];
  const goTo = (step: Draft["step"]) => {
    set("step", step);
    // Al cambiar de paso, el foco va al título (lectores de pantalla y teclado).
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const slugResult = slugState && slugState.slug === draft.slug ? slugState.result : null;
  const whatsapp = toWhatsAppNumber(draft.whatsapp);
  const total = firstStore ? 3 : 2;
  const offset = firstStore ? 1 : 0;

  const nextStep = async () => {
    const e: Record<string, string[]> = {};
    if (draft.name.trim().length < 2) e.name = ["Usá al menos 2 caracteres."];
    if (!draft.kind) e.kind = ["Elegí un rubro."];
    let result: SlugCheck | "checking" | null = slugResult;
    if (draft.slug && (result === null || result === "checking")) {
      // Todavía no volvió la verificación: se espera acá en vez de pedirle al usuario que espere.
      setChecking(true);
      result = await checkStoreSlug(draft.slug);
      setChecking(false);
      setSlugState({ slug: draft.slug, result });
    }
    if (!draft.slug) e.slug = ["Elegí una dirección."];
    else if (result && result !== "checking" && !result.available) {
      e.slug = [result.message];
      setEditSlug(true);
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    goTo(2);
  };

  const submit = () => {
    const e: Record<string, string[]> = {};
    if (draft.whatsapp.trim() && !whatsapp) e.whatsapp = ["Revisá el número: con código de área, ej. 381 617-3548."];
    else if (draft.whatsappEnabled && !whatsapp) e.whatsapp = ["Para recibir pedidos por WhatsApp necesitamos tu número."];
    if (!draft.transferEnabled && !draft.whatsappEnabled) e.whatsappEnabled = ["Elegí al menos una forma de cobro."];
    setErrors(e);
    if (Object.keys(e).length) return;

    startTransition(async () => {
      setFormError(null);
      const res = await createStore({
        name: draft.name,
        slug: draft.slug,
        kind: draft.kind || "otro",
        whatsapp: whatsapp ?? "",
        city: draft.city,
        province: draft.province,
        currency: draft.currency,
        transferEnabled: draft.transferEnabled,
        transferDiscount: Number(draft.transferDiscount || 0),
        bankName: draft.bankName,
        holder: draft.holder,
        cbu: draft.cbu,
        alias: draft.alias,
        cuit: draft.cuit,
        whatsappEnabled: draft.whatsappEnabled,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        if (res.fieldErrors?.slug || res.fieldErrors?.name || res.fieldErrors?.kind) {
          if (res.fieldErrors?.slug) setEditSlug(true);
          goTo(1);
        }
        return;
      }
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignorar
      }
      router.push("/admin");
      router.refresh();
    });
  };

  const host = storeDisplayHost({ slug: draft.slug || "tu-tienda" });
  const transferDetailsOpen = Boolean(err("cbu") || draft.cbu || draft.holder);

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] xl:gap-16">
      <div className="min-w-0 max-w-[600px]">
        <FlowProgress step={draft.step + offset} total={total} label={draft.step === 1 ? "Tu tienda" : "Pedidos y cobros"} />
        <h1 ref={headingRef} tabIndex={-1} className={cn(DISPLAY, "text-[28px] leading-tight font-semibold tracking-[-0.02em] outline-none")}>
          {draft.step === 1 ? "Creá tu tienda" : "¿Cómo te llegan los pedidos?"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-adm-fg-muted">
          {draft.step === 1
            ? "El nombre y el rubro. El rubro elige el estilo con el que arranca; lo cambiás cuando quieras."
            : "Con esto la tienda ya puede recibir pedidos. Lo que falte lo completás después en Configuración."}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.step === 1) void nextStep();
            else submit();
          }}
          className="mt-6 space-y-5"
          noValidate
        >
          {formError ? <FormAlert>{formError}</FormAlert> : null}

          {draft.step === 1 ? (
            <>
              <div>
                <Field label="Nombre de la tienda" error={err("name")}>
                  <Input
                    value={draft.name}
                    autoFocus
                    maxLength={60}
                    placeholder="Taller Luna"
                    autoComplete="organization"
                    className={TOUCH}
                    onChange={(e) => {
                      const name = e.target.value;
                      setDraft((d) => ({ ...d, name, slug: d.slugEdited ? d.slug : toStoreSlug(name) }));
                    }}
                  />
                </Field>
                {editSlug ? (
                  <Field
                    className="mt-4"
                    label="Dirección de la tienda"
                    error={err("slug")}
                    hint={
                      slugResult === "checking" ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="size-3 animate-spin" aria-hidden /> Verificando…
                        </span>
                      ) : slugResult && !slugResult.available ? (
                        <span className="text-adm-danger">{slugResult.message}</span>
                      ) : draft.slug ? (
                        <span>
                          Queda <span className="tnum font-medium text-adm-fg">{host}</span>. Minúsculas, números y guiones.
                        </span>
                      ) : (
                        "Minúsculas, números y guiones."
                      )
                    }
                  >
                    <Input
                      value={draft.slug}
                      maxLength={40}
                      placeholder="taller-luna"
                      autoCapitalize="none"
                      spellCheck={false}
                      className={TOUCH}
                      onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""), slugEdited: true }))}
                    />
                  </Field>
                ) : (
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px] text-adm-fg-muted" aria-live="polite">
                    {draft.slug ? (
                      <>
                        <span>
                          Tu dirección: <span className="tnum font-medium text-adm-fg">{host}</span>
                        </span>
                        {slugResult === "checking" || slugResult === null ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="size-3 animate-spin" aria-hidden /> Verificando…
                          </span>
                        ) : slugResult.available ? (
                          <span className="inline-flex items-center gap-1 text-adm-success">
                            <Check className="size-3.5" strokeWidth={2} aria-hidden /> Disponible
                          </span>
                        ) : (
                          <span className="text-adm-danger">{slugResult.message}</span>
                        )}
                      </>
                    ) : (
                      <span>La dirección sale del nombre.</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditSlug(true)}
                      className="inline-flex min-h-11 items-center font-medium text-adm-accent underline underline-offset-2 hover:no-underline md:min-h-0"
                    >
                      Cambiar
                    </button>
                  </p>
                )}
                {!editSlug && err("slug") ? <p className="mt-1 text-xs text-adm-danger">{err("slug")}</p> : null}
              </div>

              {KIND_FONTS_HREF ? <link rel="stylesheet" href={KIND_FONTS_HREF} /> : null}
              <fieldset aria-describedby="kind-hint">
                <legend className="text-[13px] font-medium">Rubro</legend>
                <p id="kind-hint" className="mt-0.5 mb-2 text-xs text-adm-fg-muted">
                  Cada rubro arranca con un estilo pensado para lo que vende.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {STORE_KINDS.map((k) => (
                    <label
                      key={k.id}
                      className={cn(
                        "cursor-pointer rounded-adm border bg-adm-surface p-2 transition-colors duration-[120ms] hover:border-adm-input-border-hover has-[:focus-visible]:shadow-[var(--adm-focus)]",
                        draft.kind === k.id ? "border-adm-accent ring-1 ring-adm-accent" : "border-adm-border",
                      )}
                    >
                      <input
                        type="radio"
                        name="kind"
                        value={k.id}
                        className="sr-only"
                        checked={draft.kind === k.id}
                        onChange={() => set("kind", k.id)}
                      />
                      <PresetSwatch kind={k.id} brand={draft.name.trim() || "Tu tienda"} />
                      <span className="mt-1.5 flex items-center justify-between gap-1 text-[13px] font-medium">
                        {k.label}
                        {draft.kind === k.id ? <Check className="size-3.5 shrink-0 text-adm-accent" strokeWidth={2} aria-hidden /> : null}
                      </span>
                      <span className="block text-[11px] text-adm-fg-muted">{k.hint}</span>
                    </label>
                  ))}
                </div>
                {err("kind") ? (
                  <p role="alert" className="mt-1 text-xs text-adm-danger">
                    {err("kind")}
                  </p>
                ) : null}
              </fieldset>
            </>
          ) : (
            <>
              <Field
                label="WhatsApp de la tienda"
                error={err("whatsapp")}
                hint={
                  whatsapp ? (
                    <span>
                      Los pedidos te llegan a <span className="tnum font-medium text-adm-fg">{formatWhatsApp(whatsapp)}</span>.
                    </span>
                  ) : (
                    "Con código de área, como lo escribís siempre: 381 617-3548 o 11 5555-1234."
                  )
                }
              >
                <Input
                  value={draft.whatsapp}
                  inputMode="tel"
                  type="tel"
                  autoComplete="tel"
                  autoFocus
                  placeholder="381 617-3548"
                  className={TOUCH}
                  onChange={(e) => set("whatsapp", e.target.value)}
                />
              </Field>

              <fieldset className="space-y-3">
                <legend className="mb-2 text-[13px] font-medium">Cómo te pagan</legend>
                <div className="rounded-adm border border-adm-border p-3">
                  <Checkbox
                    checked={draft.transferEnabled}
                    onChange={(e) => set("transferEnabled", e.target.checked)}
                    label="Transferencia"
                    description="El cliente ve tu alias al confirmar y te manda el comprobante. Sin comisión."
                  />
                  {draft.transferEnabled ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                        <Field label="Alias o CVU" hint="Si no lo tenés a mano, lo cargás después.">
                          <Input
                            value={draft.alias}
                            onChange={(e) => set("alias", e.target.value)}
                            placeholder="taller.luna.mp"
                            autoCapitalize="none"
                            spellCheck={false}
                            className={TOUCH}
                          />
                        </Field>
                        <Field label="Descuento" error={err("transferDiscount")}>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={50}
                            value={draft.transferDiscount}
                            onChange={(e) => set("transferDiscount", e.target.value)}
                            trailing="%"
                          />
                        </Field>
                      </div>
                      <details open={transferDetailsOpen || undefined} className="group text-[13px]">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-adm-accent underline underline-offset-2 hover:no-underline md:min-h-0">
                          Agregar CBU y titular (opcional)
                        </summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Field label="CBU o CVU" error={err("cbu")} hint="22 números.">
                            <Input value={draft.cbu} inputMode="numeric" onChange={(e) => set("cbu", e.target.value)} className={TOUCH} />
                          </Field>
                          <Field label="Titular de la cuenta">
                            <Input value={draft.holder} onChange={(e) => set("holder", e.target.value)} autoComplete="name" className={TOUCH} />
                          </Field>
                        </div>
                      </details>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-adm border border-adm-border p-3">
                  <Checkbox
                    checked={draft.whatsappEnabled}
                    onChange={(e) => set("whatsappEnabled", e.target.checked)}
                    label="Acordar por WhatsApp"
                    description="El pedido te llega armado y coordinan el pago y la entrega."
                  />
                </div>
                {err("whatsappEnabled") ? (
                  <p role="alert" className="text-xs text-adm-danger">
                    {err("whatsappEnabled")}
                  </p>
                ) : null}
              </fieldset>

              <details className="text-[13px]">
                <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-adm-accent underline underline-offset-2 hover:no-underline md:min-h-0">
                  Ciudad, provincia y moneda (opcional)
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Ciudad">
                    <Input value={draft.city} onChange={(e) => set("city", e.target.value)} placeholder="San Miguel de Tucumán" autoComplete="address-level2" className={TOUCH} />
                  </Field>
                  <Field label="Provincia">
                    <Select
                      value={draft.province}
                      onChange={(e) => set("province", e.target.value)}
                      options={[{ value: "", label: "Elegí…" }, ...PROVINCE_OPTIONS.map((p) => ({ value: p.label, label: p.label }))]}
                    />
                  </Field>
                  <Field label="Moneda de los precios" className="sm:col-span-2">
                    <Select
                      value={draft.currency}
                      onChange={(e) => set("currency", e.target.value === "USD" ? "USD" : "ARS")}
                      options={[
                        { value: "ARS", label: "Pesos argentinos (ARS)" },
                        { value: "USD", label: "Dólares (USD)" },
                      ]}
                    />
                  </Field>
                </div>
              </details>
            </>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-adm-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            {draft.step > 1 ? (
              <Button type="button" variant="ghost" size="lg" icon={<ArrowLeft />} onClick={() => goTo(1)} disabled={pending} className="max-sm:h-11">
                Atrás
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            {draft.step === 1 ? (
              <Button type="submit" variant="primary" size="lg" iconRight={<ArrowRight />} loading={checking} loadingText="Verificando…" className="h-11 text-[15px]">
                Seguir
              </Button>
            ) : (
              <Button type="submit" variant="primary" size="lg" loading={pending} loadingText="Creando tu tienda…" className="h-11 text-[15px]">
                Crear mi tienda
              </Button>
            )}
          </div>
        </form>
      </div>

      <div className="hidden lg:block">
        <Preview draft={draft} whatsapp={whatsapp} />
      </div>
    </div>
  );
}

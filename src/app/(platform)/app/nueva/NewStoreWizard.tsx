"use client";

import { ArrowLeft, ArrowRight, Check, CreditCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { createStore } from "@/app/(platform)/app/actions";
import { Rings } from "@/app/(platform)/site-shapes";
import { PresetThumb, presetFontsHref } from "@/components/admin/appearance/PresetThumb";
import { ACCOUNT_TITLE, FlowProgress, SITE_INPUT, SITE_SUBMIT } from "@/components/platform/AccountShell";
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
 * Alta de tienda en DOS pasos (el momento de mayor motivación del usuario):
 *
 * 1. Tu tienda: nombre (la dirección sale sola y se verifica en vivo; se
 *    edita sólo si hace falta) y rubro, que define el estilo. Al costado, la
 *    vista previa VIVA: la miniatura real del preset con el nombre que se
 *    escribe, que cambia con rebote al elegir otro rubro.
 * 2. Pedidos y cobros: WhatsApp (en el formato que lo escriba la persona; se
 *    normaliza a 549…), transferencia con 10 % de descuento y alias. CBU,
 *    titular, ciudad, provincia y moneda quedan plegados.
 *
 * Cierre: un check que se dibuja y la dirección de la tienda, sin confeti;
 * después, al panel. Borrador en localStorage (spec §14.3).
 *
 * Contrato con la landing (L1): si existe `localStorage["ecommy_store_draft"]`
 * (`{ name, preset }`, lo deja la demo de estilos), precarga nombre y estilo
 * (el primer rubro con ese preset) y se borra al crear la tienda.
 */

const STORAGE_KEY = "ecommy:nueva-tienda";
const LANDING_DRAFT_KEY = "ecommy_store_draft";

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
  /** Último borrador de la landing ya aplicado (para no pisar lo que se editó después). */
  landingApplied?: string;
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
  let draft = EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = { ...EMPTY, ...(JSON.parse(raw) as Partial<Omit<Draft, "step">> & { step?: number }) };
      // Borradores del wizard de 3 pasos: el 3 (cobros) ahora es el 2.
      draft = { ...saved, step: saved.step && saved.step >= 2 ? 2 : 1 };
    }
  } catch {
    draft = EMPTY;
  }
  return applyLandingDraft(draft);
}

/** Precarga nombre y estilo elegidos en la demo de la landing (una vez por borrador nuevo). */
function applyLandingDraft(draft: Draft): Draft {
  try {
    const raw = window.localStorage.getItem(LANDING_DRAFT_KEY);
    if (!raw || raw === draft.landingApplied) return draft;
    const data = JSON.parse(raw) as { name?: unknown; preset?: unknown };
    const name = typeof data.name === "string" ? data.name.trim().slice(0, 60) : "";
    const kind = typeof data.preset === "string" ? STORE_KINDS.find((k) => k.preset === data.preset)?.id : undefined;
    return {
      ...draft,
      step: 1,
      name: name || draft.name,
      slug: name && !draft.slugEdited ? toStoreSlug(name) : draft.slug,
      kind: kind ?? draft.kind,
      landingApplied: raw,
    };
  } catch {
    return draft;
  }
}

/** Fuentes de los presets de los rubros (sólo esos, no todo el catálogo). */
const KIND_FONTS_HREF = presetFontsHref([...new Set(STORE_KINDS.map((k) => k.preset))].map((id) => PRESETS[id]));

const STEPS = ["Tu cuenta", "Tu tienda", "Cobros"] as const;

/** "5493816173548" → "+54 9 381 617-3548" (sólo para mostrar; números de otro país quedan con +). */
function formatWhatsApp(n: string): string {
  if (n.startsWith("549") && n.length === 13) return `+54 9 ${n.slice(3, 6)} ${n.slice(6, 9)}-${n.slice(9)}`;
  return `+${n}`;
}

/** Miniatura fiel del preset del rubro (la misma del selector de Apariencia), con el nombre de la tienda. */
function PresetSwatch({ kind, brand, headline, className }: { kind: StoreKind; brand: string; headline?: string; className?: string }) {
  const id = presetForKind(kind);
  const meta = PRESET_LIST.find((p) => p.id === id);
  return (
    <PresetThumb
      theme={PRESETS[id]}
      brand={brand}
      headline={headline ?? meta?.mood ?? brand}
      labels={meta?.industries}
      className={cn("rounded-[10px]", className)}
    />
  );
}

/** Vista previa viva (desktop): la tienda con su estilo, su dirección y lo que ya queda listo. */
function Preview({ draft, whatsapp }: { draft: Draft; whatsapp: string | null }) {
  const kind = draft.kind || "otro";
  const kindMeta = STORE_KINDS.find((k) => k.id === kind);
  const preset = PRESET_LIST.find((p) => p.id === presetForKind(kind));
  const name = draft.name.trim();
  const brand = name || "Tu tienda";
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
    <aside aria-label="Vista previa de tu tienda" className="sticky top-6">
      <div className="relative overflow-hidden rounded-eco-xl bg-eco-durazno px-7 pt-7 pb-8">
        <Rings size={620} count={6} className="-right-64 -bottom-72 text-eco-pomelo/30" />
        <p className="relative text-[12px] font-semibold tracking-[0.1em] text-eco-pomelo-ink uppercase">Así arranca tu tienda</p>
        <p className={cn(DISPLAY, "relative mt-2 truncate text-[28px] leading-tight text-eco-ink")} aria-live="polite">
          <span key={brand} className="site-type inline-block">
            {brand}
          </span>
        </p>
        <div className="eco-bubble relative mt-5 overflow-hidden bg-adm-surface shadow-[0_32px_64px_-36px_rgb(16_22_47/0.55)] [--eco-bubble-r:22px]">
          <div className="flex h-9 items-center gap-2 border-b border-eco-line bg-eco-niebla px-3.5">
            <span aria-hidden className="flex gap-1">
              <span className="size-2 rounded-full bg-eco-line" />
              <span className="size-2 rounded-full bg-eco-line" />
              <span className="size-2 rounded-full bg-eco-line" />
            </span>
            <span className="tnum ml-1 min-w-0 flex-1 truncate rounded-full bg-adm-surface px-3 py-0.5 text-[12px] text-adm-fg-muted">{host}</span>
          </div>
          <div key={kind} className="site-swap">
            <PresetSwatch kind={kind} brand={brand} headline={name || undefined} className="rounded-none" />
          </div>
        </div>
      </div>
      <ul className="mt-6 space-y-3 px-1 text-[14px]">
        {items.map((item) => (
          <li key={item.text} className="flex gap-3">
            <span
              aria-hidden
              className={cn(
                "mt-px flex size-5 shrink-0 items-center justify-center rounded-full rounded-bl-[4px] transition-colors duration-[240ms]",
                item.done ? "bg-eco-ink text-white" : "border-[1.5px] border-dashed border-adm-input-border",
              )}
            >
              {item.done ? <Check className="size-3" strokeWidth={3} /> : null}
            </span>
            <span className={item.done ? "" : "text-adm-fg-muted"}>
              <span className="sr-only">{item.done ? "Listo: " : "Pendiente: "}</span>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 px-1 text-[13px] leading-relaxed text-adm-fg-muted">Todo se cambia después desde el panel: estilo, colores, logo y cobros.</p>
    </aside>
  );
}

/** Cierre del alta: un check que se dibuja y la dirección nueva. Sigue solo al panel. */
function Created({ name, host, onContinue }: { name: string; host: string; onContinue: () => void }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto flex min-h-[60dvh] max-w-[520px] flex-col items-center justify-center text-center">
      <svg aria-hidden viewBox="0 0 96 96" className="size-24">
        <circle cx={48} cy={48} r={42} fill="var(--eco-durazno)" />
        <circle cx={48} cy={48} r={42} fill="none" stroke="var(--eco-pomelo)" strokeWidth={5} strokeLinecap="round" pathLength={1} className="site-check-ring" transform="rotate(-90 48 48)" />
        <path d="M30 49 L43 62 L67 35" fill="none" stroke="var(--eco-ink)" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="site-check-tick" />
      </svg>
      <h1 className={cn(ACCOUNT_TITLE, "mt-8 eco-pop [--i:4]")}>{name} ya existe.</h1>
      <p className="eco-pop mt-3 text-[16px] leading-relaxed text-adm-fg-muted [--i:5]">
        Tu dirección: <span className="tnum font-semibold text-adm-fg">{host}</span>. Ahora cargás los productos y la compartís.
      </p>
      <Button variant="primary" size="lg" iconRight={<ArrowRight />} onClick={onContinue} className={cn(SITE_SUBMIT, "eco-pop mt-8 w-auto [--i:6]")}>
        Entrar al panel
      </Button>
    </div>
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
  const [created, setCreated] = useState<{ name: string; host: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const checkSeq = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Borrador en localStorage hasta crear la tienda (spec §14.3) + borrador de la landing.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar desde localStorage sólo puede pasar en el cliente
    setDraft(loadDraft());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated || created) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Sin storage: el wizard funciona igual, sólo no se recuerda.
    }
  }, [draft, hydrated, created]);

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

  // Después del check, al panel (el botón deja entrar antes).
  useEffect(() => {
    if (!created) return;
    const t = window.setTimeout(() => {
      router.push("/admin");
      router.refresh();
    }, 2600);
    return () => window.clearTimeout(t);
  }, [created, router]);

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
        window.localStorage.removeItem(LANDING_DRAFT_KEY);
      } catch {
        // ignorar
      }
      setCreated({ name: draft.name.trim(), host: storeDisplayHost({ slug: res.data.slug }) });
    });
  };

  const host = storeDisplayHost({ slug: draft.slug || "tu-tienda" });
  const transferDetailsOpen = Boolean(err("cbu") || draft.cbu || draft.holder);

  if (created) {
    return (
      <Created
        name={created.name}
        host={created.host}
        onContinue={() => {
          router.push("/admin");
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:gap-20">
      <div className="min-w-0 max-w-[620px]">
        <FlowProgress
          step={draft.step + offset}
          total={total}
          label={draft.step === 1 ? "Tu tienda" : "Pedidos y cobros"}
          steps={firstStore ? STEPS : STEPS.slice(1)}
        />
        <h1 ref={headingRef} tabIndex={-1} className={cn(ACCOUNT_TITLE, "outline-none")}>
          {draft.step === 1 ? "¿Cómo se llama tu tienda?" : "¿Cómo te llegan los pedidos?"}
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-adm-fg-muted">
          {draft.step === 1
            ? "El nombre y el rubro. El rubro elige el estilo con el que arranca; lo cambiás cuando quieras."
            : "Con esto la tienda ya puede recibir pedidos. Lo que falte lo completás después en Configuración."}
        </p>

        <form
          key={draft.step}
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.step === 1) void nextStep();
            else submit();
          }}
          className="eco-pop mt-8 space-y-7"
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
                    className={cn(SITE_INPUT, "h-14 pointer-coarse:h-14 text-[20px] pointer-coarse:text-[20px] font-medium")}
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
                      className={SITE_INPUT}
                      onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""), slugEdited: true }))}
                    />
                  </Field>
                ) : (
                  <p className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px] text-adm-fg-muted" aria-live="polite">
                    {draft.slug ? (
                      <>
                        <span className="tnum min-w-0 truncate rounded-full bg-eco-niebla-2 px-3 py-1 font-medium text-adm-fg">{host}</span>
                        {slugResult === "checking" || slugResult === null ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Verificando…
                          </span>
                        ) : slugResult.available ? (
                          <span className="inline-flex items-center gap-1 font-medium text-adm-success">
                            <Check className="size-4" strokeWidth={2.5} aria-hidden /> Disponible
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
                      className="inline-flex min-h-11 items-center font-medium text-adm-link underline decoration-1 underline-offset-[3px] hover:decoration-2 md:min-h-0"
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
                <p id="kind-hint" className="mt-0.5 mb-3 text-[13px] text-adm-fg-muted">
                  Cada rubro arranca con un estilo pensado para lo que vende.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {STORE_KINDS.map((k) => {
                    const selected = draft.kind === k.id;
                    return (
                      <label
                        key={k.id}
                        className={cn(
                          "site-lift relative cursor-pointer border-2 bg-adm-surface p-2 has-[:focus-visible]:shadow-[var(--adm-focus)]",
                          selected ? "border-eco-ink" : "border-transparent ring-1 ring-eco-line hover:ring-adm-input-border",
                        )}
                      >
                        <input type="radio" name="kind" value={k.id} className="sr-only" checked={selected} onChange={() => set("kind", k.id)} />
                        <PresetSwatch kind={k.id} brand={draft.name.trim() || "Tu tienda"} />
                        <span className="mt-2 flex items-center justify-between gap-1 px-1 text-[14px] leading-tight font-semibold">{k.label}</span>
                        <span className="block px-1 pb-1 text-[12px] leading-snug text-adm-fg-muted">{k.hint}</span>
                        {selected ? (
                          <span
                            aria-hidden
                            className="eco-pop absolute top-3.5 right-3.5 flex size-7 items-center justify-center rounded-full rounded-bl-[5px] bg-eco-pomelo text-eco-ink shadow-[0_6px_14px_-6px_rgb(16_22_47/0.5)]"
                          >
                            <Check className="size-4" strokeWidth={3} />
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
                {err("kind") ? (
                  <p role="alert" className="mt-2 text-xs text-adm-danger">
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
                  className={SITE_INPUT}
                  onChange={(e) => set("whatsapp", e.target.value)}
                />
              </Field>

              <fieldset className="space-y-3">
                <legend className="mb-2 text-[13px] font-medium">Cómo te pagan</legend>
                <div className={cn("rounded-[16px] border-2 p-4 transition-colors duration-[240ms]", draft.transferEnabled ? "border-eco-ink" : "border-eco-line")}>
                  <Checkbox
                    checked={draft.transferEnabled}
                    onChange={(e) => set("transferEnabled", e.target.checked)}
                    label="Transferencia"
                    description="El cliente ve tu alias al confirmar y te manda el comprobante. Sin comisión."
                  />
                  {draft.transferEnabled ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                        <Field label="Alias o CVU" hint="Si no lo tenés a mano, lo cargás después.">
                          <Input
                            value={draft.alias}
                            onChange={(e) => set("alias", e.target.value)}
                            placeholder="taller.luna.mp"
                            autoCapitalize="none"
                            spellCheck={false}
                            className={SITE_INPUT}
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
                            className="[&_input]:h-12 [&_input]:rounded-[12px] [&_input]:text-[16px]"
                          />
                        </Field>
                      </div>
                      <details open={transferDetailsOpen || undefined} className="group text-[14px]">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-adm-link underline decoration-1 underline-offset-[3px] hover:decoration-2 md:min-h-0">
                          Agregar CBU y titular (opcional)
                        </summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Field label="CBU o CVU" error={err("cbu")} hint="22 números.">
                            <Input value={draft.cbu} inputMode="numeric" onChange={(e) => set("cbu", e.target.value)} className={SITE_INPUT} />
                          </Field>
                          <Field label="Titular de la cuenta">
                            <Input value={draft.holder} onChange={(e) => set("holder", e.target.value)} autoComplete="name" className={SITE_INPUT} />
                          </Field>
                        </div>
                      </details>
                    </div>
                  ) : null}
                </div>
                <div className={cn("rounded-[16px] border-2 p-4 transition-colors duration-[240ms]", draft.whatsappEnabled ? "border-eco-ink" : "border-eco-line")}>
                  <Checkbox
                    checked={draft.whatsappEnabled}
                    onChange={(e) => set("whatsappEnabled", e.target.checked)}
                    label="Acordar por WhatsApp"
                    description="El pedido te llega armado y coordinan el pago y la entrega."
                  />
                </div>
                <p className="flex gap-3 rounded-[16px] rounded-bl-[4px] bg-eco-azul-soft px-4 py-3.5 text-[14px] leading-snug">
                  <CreditCard className="mt-0.5 size-[18px] shrink-0 text-adm-link" strokeWidth={1.75} aria-hidden />
                  <span>
                    <span className="font-semibold">¿Tarjeta y cuotas?</span> Conectás tu cuenta de Mercado Pago después, en Configuración › Pagos y checkout. La plata entra
                    directo a tu cuenta.
                  </span>
                </p>
                {err("whatsappEnabled") ? (
                  <p role="alert" className="text-xs text-adm-danger">
                    {err("whatsappEnabled")}
                  </p>
                ) : null}
              </fieldset>

              <details className="text-[14px]">
                <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-adm-link underline decoration-1 underline-offset-[3px] hover:decoration-2 md:min-h-0">
                  Ciudad, provincia y moneda (opcional)
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Ciudad">
                    <Input value={draft.city} onChange={(e) => set("city", e.target.value)} placeholder="San Miguel de Tucumán" autoComplete="address-level2" className={SITE_INPUT} />
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

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-3 border-t border-eco-line bg-adm-surface/95 px-4 py-4 sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:bg-transparent sm:px-0 sm:pt-6 sm:pb-0">
            {draft.step > 1 ? (
              <Button type="button" variant="ghost" size="lg" icon={<ArrowLeft />} onClick={() => goTo(1)} disabled={pending} className="h-12 rounded-full px-5">
                Atrás
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            {draft.step === 1 ? (
              <Button type="submit" variant="primary" size="lg" iconRight={<ArrowRight />} loading={checking} loadingText="Verificando…" className={cn(SITE_SUBMIT, "sm:w-auto")}>
                Seguir
              </Button>
            ) : (
              <Button type="submit" variant="accent" size="lg" iconRight={<ArrowRight />} loading={pending} loadingText="Creando tu tienda…" className={cn(SITE_SUBMIT, "sm:w-auto")}>
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

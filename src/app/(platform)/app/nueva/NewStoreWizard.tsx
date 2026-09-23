"use client";

import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { createStore } from "@/app/(platform)/app/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Checkbox, Input, Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { PROVINCE_OPTIONS } from "@/lib/shipping/provinces";
import { checkStoreSlug, type SlugCheck } from "@/lib/tenant/actions";
import { STORE_KINDS, type StoreKind } from "@/lib/tenant/kinds";
import { toStoreSlug } from "@/lib/tenant/slug";
import { storeDisplayHost } from "@/lib/tenant/urls";
import { PRESETS } from "@/lib/theme/presets";

const STORAGE_KEY = "ecommy:nueva-tienda";

interface Draft {
  step: 1 | 2 | 3;
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
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    return EMPTY;
  }
}

const STEPS = ["Tu tienda", "Contacto", "Cobros"] as const;

/** Mini muestra del preset del rubro (colores reales del preset). */
function PresetSwatch({ kind }: { kind: StoreKind }) {
  const preset = PRESETS[STORE_KINDS.find((k) => k.id === kind)?.preset ?? "nordico"];
  const c = preset.colors;
  const radius = preset.radius === "none" ? 0 : preset.radius === "sm" ? 3 : preset.radius === "md" ? 6 : 10;
  return (
    <div aria-hidden className="h-16 overflow-hidden rounded-[4px] border border-adm-border" style={{ background: c.background }}>
      <div className="flex h-4 items-center justify-between px-2" style={{ background: c.surface, borderBottom: `1px solid ${c.border}` }}>
        <span className="h-1 w-6 rounded-full" style={{ background: c.text }} />
        <span className="h-1 w-3 rounded-full" style={{ background: c.textMuted }} />
      </div>
      <div className="flex gap-1.5 p-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-7 flex-1" style={{ background: i === 0 ? c.primary : c.secondary, borderRadius: radius }} />
        ))}
      </div>
    </div>
  );
}

export function NewStoreWizard() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [slugState, setSlugState] = useState<{ slug: string; result: SlugCheck | "checking" } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const checkSeq = useRef(0);

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

  const slugResult = slugState && slugState.slug === draft.slug ? slugState.result : null;
  const slugOk = slugResult !== null && slugResult !== "checking" && slugResult.available;

  const next = () => {
    const e: Record<string, string[]> = {};
    if (draft.step === 1) {
      if (draft.name.trim().length < 2) e.name = ["Usá al menos 2 caracteres."];
      if (!draft.kind) e.kind = ["Elegí un rubro."];
      if (!slugOk) e.slug = [slugResult && slugResult !== "checking" && !slugResult.available ? slugResult.message : "Esperá a que verifiquemos la dirección."];
    }
    if (draft.step === 2) {
      const digits = draft.whatsapp.replace(/\D/g, "");
      if (digits && (digits.length < 10 || digits.length > 15)) e.whatsapp = ["Con código de país y área, ej. 5493816173548."];
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    set("step", (draft.step + 1) as Draft["step"]);
  };

  const submit = () =>
    startTransition(async () => {
      setFormError(null);
      const res = await createStore({
        name: draft.name,
        slug: draft.slug,
        kind: draft.kind || "otro",
        whatsapp: draft.whatsapp,
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
        if (res.fieldErrors?.slug || res.fieldErrors?.name) set("step", 1);
        else if (res.fieldErrors?.whatsapp) set("step", 2);
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

  return (
    <div>
      <ol className="mb-6 flex items-center gap-2 text-[12px]" aria-label="Pasos">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Draft["step"];
          const done = draft.step > n;
          const current = draft.step === n;
          return (
            <li key={label} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full border text-[11px] font-medium",
                  done && "border-adm-accent bg-adm-accent text-adm-accent-fg",
                  current && "border-adm-accent text-adm-accent",
                  !done && !current && "border-adm-border text-adm-fg-muted",
                )}
              >
                {done ? <Check className="size-3" strokeWidth={2.5} /> : n}
              </span>
              <span className={current ? "font-medium" : "text-adm-fg-muted"}>{label}</span>
              {i < STEPS.length - 1 ? <span aria-hidden className="h-px w-6 bg-adm-border" /> : null}
            </li>
          );
        })}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.step < 3) next();
          else submit();
        }}
        className="space-y-4"
      >
        {formError ? (
          <p role="alert" className="rounded-adm border border-[#efc6c0] bg-adm-danger-soft px-3 py-2 text-[13px] text-[#8f1c13]">
            {formError}
          </p>
        ) : null}

        {draft.step === 1 ? (
          <>
            <Field label="Nombre de la tienda" error={err("name")}>
              <Input
                value={draft.name}
                autoFocus
                maxLength={60}
                placeholder="Taller Luna"
                onChange={(e) => {
                  const name = e.target.value;
                  setDraft((d) => ({ ...d, name, slug: d.slugEdited ? d.slug : toStoreSlug(name) }));
                }}
              />
            </Field>
            <Field
              label="Dirección"
              error={err("slug")}
              hint={
                draft.slug ? (
                  slugResult === "checking" || slugResult === null ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" aria-hidden /> Verificando…
                    </span>
                  ) : slugResult.available ? (
                    <span className="text-adm-success">Disponible: {storeDisplayHost({ slug: draft.slug })}</span>
                  ) : (
                    <span className="text-adm-danger">{slugResult.message}</span>
                  )
                ) : (
                  "Minúsculas, números y guiones."
                )
              }
            >
              <Input
                value={draft.slug}
                maxLength={40}
                placeholder="taller-luna"
                onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""), slugEdited: true }))}
              />
            </Field>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium">Rubro</legend>
              <p className="-mt-1 mb-2 text-xs text-adm-fg-muted">Elegimos un estilo de tienda que le queda bien. Después lo cambiás cuando quieras.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {STORE_KINDS.map((k) => (
                  <label
                    key={k.id}
                    className={cn(
                      "cursor-pointer rounded-adm border bg-adm-surface p-2 transition-colors hover:border-adm-input-border-hover",
                      draft.kind === k.id ? "border-adm-accent ring-1 ring-adm-accent" : "border-adm-border",
                    )}
                  >
                    <input type="radio" name="kind" value={k.id} className="sr-only" checked={draft.kind === k.id} onChange={() => set("kind", k.id)} />
                    <PresetSwatch kind={k.id} />
                    <span className="mt-1.5 block text-[13px] font-medium">{k.label}</span>
                    <span className="block text-[11px] text-adm-fg-muted">{k.hint}</span>
                  </label>
                ))}
              </div>
              {err("kind") ? <p className="mt-1 text-xs text-adm-danger">{err("kind")}</p> : null}
            </fieldset>
          </>
        ) : null}

        {draft.step === 2 ? (
          <>
            <Field label="WhatsApp de la tienda" hint="Con código de país y área, sin espacios: 5493816173548. Ahí te llegan los pedidos." error={err("whatsapp")}>
              <Input value={draft.whatsapp} inputMode="tel" autoFocus placeholder="5493816173548" onChange={(e) => set("whatsapp", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ciudad">
                <Input value={draft.city} onChange={(e) => set("city", e.target.value)} placeholder="San Miguel de Tucumán" />
              </Field>
              <Field label="Provincia">
                <Select
                  value={draft.province}
                  onChange={(e) => set("province", e.target.value)}
                  options={[{ value: "", label: "Elegí…" }, ...PROVINCE_OPTIONS.map((p) => ({ value: p.label, label: p.label }))]}
                />
              </Field>
            </div>
            <Field label="Moneda de los precios">
              <Select
                value={draft.currency}
                onChange={(e) => set("currency", e.target.value === "USD" ? "USD" : "ARS")}
                options={[
                  { value: "ARS", label: "Pesos argentinos (ARS)" },
                  { value: "USD", label: "Dólares (USD)" },
                ]}
              />
            </Field>
          </>
        ) : null}

        {draft.step === 3 ? (
          <>
            <p className="text-sm text-adm-fg-muted">¿Cómo querés cobrar? Podés dejar los datos para después: los completás en Configuración → Pagos.</p>
            <div className="rounded-adm border border-adm-border p-3">
              <Checkbox
                checked={draft.transferEnabled}
                onChange={(e) => set("transferEnabled", e.target.checked)}
                label="Transferencia bancaria"
                description="El cliente ve tus datos al confirmar y te manda el comprobante."
              />
              {draft.transferEnabled ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Descuento por transferencia (%)" error={err("transferDiscount")}>
                    <Input type="number" min={0} max={50} value={draft.transferDiscount} onChange={(e) => set("transferDiscount", e.target.value)} />
                  </Field>
                  <Field label="Alias">
                    <Input value={draft.alias} onChange={(e) => set("alias", e.target.value)} placeholder="taller.luna.mp" />
                  </Field>
                  <Field label="CBU / CVU" error={err("cbu")}>
                    <Input value={draft.cbu} inputMode="numeric" onChange={(e) => set("cbu", e.target.value)} />
                  </Field>
                  <Field label="Titular">
                    <Input value={draft.holder} onChange={(e) => set("holder", e.target.value)} />
                  </Field>
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
              {err("whatsappEnabled") || err("whatsapp") ? (
                <p className="mt-1 text-xs text-adm-danger">{err("whatsappEnabled") ?? err("whatsapp")}</p>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-2">
          {draft.step > 1 ? (
            <Button type="button" variant="ghost" icon={<ArrowLeft />} onClick={() => set("step", (draft.step - 1) as Draft["step"])} disabled={pending}>
              Atrás
            </Button>
          ) : (
            <span />
          )}
          {draft.step < 3 ? (
            <Button type="submit" variant="primary" iconRight={<ArrowRight />}>
              Seguir
            </Button>
          ) : (
            <Button type="submit" variant="primary" loading={pending} loadingText="Creando tu tienda…">
              Crear mi tienda
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

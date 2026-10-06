"use client";

import { ArrowRight, Check, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect } from "react";

import { SITE_INPUT, SITE_SUBMIT } from "@/components/platform/AccountShell";
import { CTA_ARROW, CTA_PRIMARY, DISPLAY, FormAlert, TEXT_LINK } from "@/components/platform/brand";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

import { requestCatalogLoad, type CatalogRequestState } from "./actions";
import { CATALOG_SIZES, DEFAULT_KIND } from "./options";

/** El `<select>` nativo con la misma altura y radio que los inputs del sitio. */
const SITE_SELECT = "[&>select]:h-12 [&>select]:rounded-[12px] [&>select]:pl-3.5 [&>select]:text-[16px] pointer-coarse:[&>select]:h-12";

const FIELDS = ["instagram", "whatsapp", "products", "kind"] as const;

function fieldError(state: CatalogRequestState, name: string): string[] | undefined {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}

function Done({ data, demoHref }: { data: Extract<NonNullable<CatalogRequestState>, { ok: true }>["data"]; demoHref: string }) {
  // Medición del funnel (GA4 de la plataforma, si está cargado). Sin datos personales.
  useEffect(() => {
    const w = window as Window & { gtag?: (...args: unknown[]) => void };
    w.gtag?.("event", "generate_lead", { lead_source: "empezar" });
  }, []);

  return (
    <div className="eco-pop" role="status">
      <span className="flex size-14 items-center justify-center rounded-[20px] rounded-bl-[5px] bg-eco-durazno text-eco-ink">
        <Check className="size-6" strokeWidth={2} aria-hidden />
      </span>
      <h2 className={cn(DISPLAY, "mt-6 text-[30px] leading-[1.04] break-words sm:text-[34px]")}>Listo, @{data.handle}.</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">
        {data.notified
          ? "Ya tenemos tu pedido. Te escribimos por WhatsApp en horario hábil, de lunes a viernes, para pedirte la lista de precios y coordinar la llamada. Si querés adelantarte, mandanos el mensaje: ya va escrito."
          : "Para que tu pedido nos llegue, mandanos el mensaje: ya va escrito con tu Instagram, tu rubro y cuántos productos vendés."}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        {data.whatsappUrl ? (
          <a href={data.whatsappUrl} target="_blank" rel="noopener noreferrer" className={CTA_PRIMARY}>
            <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden />
            Seguir por WhatsApp
            <span className="sr-only">(se abre en otra pestaña)</span>
            <span className={CTA_ARROW}>
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </span>
          </a>
        ) : (
          <a href={data.mailtoUrl} className={CTA_PRIMARY}>
            <Mail className="size-4" strokeWidth={1.75} aria-hidden />
            Seguir por mail
            <span className={CTA_ARROW}>
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
            </span>
          </a>
        )}
        <Link href={demoHref} className={cn(TEXT_LINK, "inline-flex min-h-11 items-center text-[15px]")}>
          Ver una tienda de ropa funcionando
        </Link>
      </div>
    </div>
  );
}

/**
 * Formulario de /empezar: cuatro datos y un botón. Los valores vuelven del
 * server cuando hay un error (React reinicia el formulario al terminar la
 * action), y el honeypot `website` queda fuera de la vista y del tab.
 */
export function CatalogRequestForm({ kinds, demoHref }: { kinds: { value: string; label: string }[]; demoHref: string }) {
  const [state, action, pending] = useActionState(requestCatalogLoad, null);

  if (state?.ok) return <Done data={state.data} demoHref={demoHref} />;

  const values = state && !state.ok ? state.values : null;
  const onlyGeneral = state && !state.ok && !FIELDS.some((k) => state.fieldErrors?.[k]);

  return (
    <form action={action} className="space-y-5" noValidate>
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Sitio web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {onlyGeneral ? <FormAlert>{state.error}</FormAlert> : null}
      <Field label="Instagram de tu marca" hint="Tu usuario, con o sin @." error={fieldError(state, "instagram")} required>
        <Input
          name="instagram"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="@tumarca"
          maxLength={120}
          defaultValue={values?.instagram}
          className={SITE_INPUT}
        />
      </Field>
      <Field label="Tu WhatsApp" hint="Con código de área. Te escribimos ahí para coordinar." error={fieldError(state, "whatsapp")} required>
        <Input
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="11 5555 5555"
          maxLength={40}
          defaultValue={values?.whatsapp}
          className={SITE_INPUT}
        />
      </Field>
      <Field label="¿Cuántos productos vendés hoy?" error={fieldError(state, "products")} required>
        <Select
          name="products"
          placeholder="Elegí una opción"
          defaultValue={values?.products ?? ""}
          options={CATALOG_SIZES.map((s) => ({ value: s.id, label: s.label }))}
          className={SITE_SELECT}
        />
      </Field>
      <Field label="Rubro" error={fieldError(state, "kind")} required>
        <Select name="kind" defaultValue={values?.kind || DEFAULT_KIND} options={kinds} className={SITE_SELECT} />
      </Field>
      <Button
        type="submit"
        variant="accent"
        size="lg"
        loading={pending}
        loadingText="Enviando…"
        iconRight={<ArrowRight />}
        className={SITE_SUBMIT}
      >
        Pedir la carga del catálogo
      </Button>
      <p className="text-[13px] leading-relaxed text-adm-fg-muted">
        Usamos estos datos sólo para escribirte por esta carga. Más en la{" "}
        <Link href="/privacidad" className={TEXT_LINK}>
          política de privacidad
        </Link>
        .
      </p>
    </form>
  );
}

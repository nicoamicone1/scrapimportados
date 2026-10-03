import { ArrowRight, Mail, MessageCircle } from "lucide-react";
import type { Metadata } from "next";

import { PLATFORM_EMAIL, platformWhatsappHref } from "@/components/platform/site";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { MODULES, moduleState, type ModuleDef, type ModuleState } from "@/lib/modules/registry";
import { listModuleCatalog, listStoreModuleRows, type ModuleCatalogEntry } from "@/lib/modules/server";
import { formatMoney } from "@/lib/money";
import { markdownToText } from "@/lib/store/markdown";
import { storeDisplayHost } from "@/lib/tenant/urls";

import { AppArt } from "./_components/AppArt";

export const metadata: Metadata = { title: "Apps" };

function stateBadge(state: ModuleState): { tone: BadgeTone; label: string } {
  switch (state.kind) {
    case "active":
      return { tone: "green", label: state.expiresAt ? `Activa hasta el ${formatDate(state.expiresAt)}` : "Activa" };
    case "trial":
      return { tone: "amber", label: state.expiresAt ? `Prueba hasta el ${formatDate(state.expiresAt)}` : "En prueba" };
    case "expired":
      return { tone: "neutral", label: `Venció el ${formatDate(state.expiresAt)}` };
    case "off":
      return { tone: "neutral", label: "No activa" };
  }
}

interface Contact {
  whatsapp: string | null;
  mailto: string;
}

function contactFor(text: string, subject: string): Contact {
  return {
    whatsapp: platformWhatsappHref(process.env.PLATFORM_WHATSAPP, text),
    mailto: `mailto:${PLATFORM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
  };
}

/** Botones para pedirle algo a Ecommy: WhatsApp si está configurado, siempre mail. */
function ContactButtons({ contact, label, primary }: { contact: Contact; label: string; primary: boolean }) {
  const mailClass = buttonClass(primary && !contact.whatsapp ? "primary" : "secondary", "lg");
  return (
    <>
      {contact.whatsapp ? (
        <ButtonLink href={contact.whatsapp} external variant={primary ? "primary" : "secondary"} size="lg" icon={<MessageCircle aria-hidden />}>
          {label}
        </ButtonLink>
      ) : null}
      <a href={contact.mailto} className={mailClass}>
        <Mail aria-hidden />
        {contact.whatsapp ? "Por mail" : label}
      </a>
    </>
  );
}

function AppCard({
  def,
  entry,
  state,
  storeLine,
}: {
  def: ModuleDef;
  entry: ModuleCatalogEntry;
  state: ModuleState;
  storeLine: string;
}) {
  const badge = stateBadge(state);
  const live = state.kind === "active" || state.kind === "trial";
  const description = markdownToText(entry.descriptionMd, 420);
  const ask =
    state.kind === "expired"
      ? { label: "Quiero renovarla", text: `Hola! Quiero renovar la app ${entry.name} en mi tienda.` }
      : state.kind === "trial"
        ? { label: "Quiero dejarla fija", text: `Hola! Estoy probando la app ${entry.name} y quiero dejarla activa.` }
        : { label: "Quiero activarla", text: `Hola! Quiero activar la app ${entry.name} en mi tienda.` };
  const contact = contactFor(`${ask.text}\n\n${storeLine}`, `App ${entry.name}`);

  return (
    <article
      aria-labelledby={`app-${def.code}`}
      className="overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface shadow-adm-card lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <div className="relative isolate flex flex-col overflow-hidden bg-adm-sidebar-bg px-6 pt-5 pb-4">
        {/* Arcos concéntricos de trazo fino detrás de la pieza (BRAND §7.2). */}
        <svg aria-hidden viewBox="0 0 400 400" className="absolute top-1/2 left-1/2 -z-10 size-[520px] -translate-x-1/2 -translate-y-1/2">
          {[190, 150, 110].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="var(--eco-ink-3)" strokeWidth="1.5" />
          ))}
        </svg>
        <div className="flex items-center justify-between text-[11px] font-medium tracking-[0.07em] text-adm-sidebar-muted uppercase">
          <span>App de Ecommy</span>
          <span className="font-mono tracking-normal normal-case">{def.code}</span>
        </div>
        <div className="flex flex-1 items-center justify-center py-6">
          <AppArt code={def.code} className="max-w-[360px]" />
        </div>
        {def.artCaption ? <p className="font-mono text-[11px] text-adm-sidebar-muted">{def.artCaption}</p> : null}
      </div>

      <div className="flex min-w-0 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h2 id={`app-${def.code}`} className="eco-display text-[26px] leading-8 text-adm-fg">
            {entry.name}
          </h2>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        <p className="mt-1.5 text-[15px] text-adm-fg">{entry.tagline}</p>
        <p className="mt-1 text-[13px] text-adm-fg-muted">{def.audience}</p>
        {description ? <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-adm-fg-muted">{description}</p> : null}

        <h3 className="mt-6 text-[11px] font-medium tracking-[0.06em] text-adm-fg-muted uppercase">Qué incluye</h3>
        <ol className="mt-2 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {def.includes.map((f, i) => (
            <li key={f.title} className="flex gap-3">
              <span aria-hidden className="eco-num inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-eco-durazno text-[12px] text-adm-fg">
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <span className="text-sm font-semibold text-adm-fg">{f.title}</span>
                <p className="mt-0.5 text-[13px] leading-relaxed text-adm-fg-muted">{f.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-adm-border pt-4">
          <div>
            {entry.priceMonthly !== null ? (
              <p className="eco-num text-[26px] leading-8 text-adm-fg">
                {formatMoney(entry.priceMonthly)}
                <span className="font-sans text-sm font-normal tracking-normal text-adm-fg-muted"> /mes</span>
              </p>
            ) : (
              <p className="text-base font-semibold text-adm-fg">Precio a consultar</p>
            )}
            <p className="mt-0.5 text-xs text-adm-fg-muted">Se abona aparte del plan. Lo coordinamos por WhatsApp o mail.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {live ? (
              <>
                {state.kind === "trial" ? <ContactButtons contact={contact} label={ask.label} primary={false} /> : null}
                <ButtonLink href={def.adminHref} variant="primary" size="lg" iconRight={<ArrowRight aria-hidden />}>
                  Abrir {entry.name}
                </ButtonLink>
              </>
            ) : (
              <ContactButtons contact={contact} label={ask.label} primary />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Catálogo de apps extra (docs/modules/TALLER-3D.md §1.3): se activan a pedido desde la plataforma. */
export default async function AppsPage() {
  const ctx = await requireAdmin();
  const [catalog, rows] = await Promise.all([listModuleCatalog(ctx.supabase, { includeHidden: true }), listStoreModuleRows(ctx.supabase, ctx.store.id)]);
  const now = new Date();
  const byCode = new Map(rows.map((r) => [r.code, r]));
  // Las ocultas se muestran sólo si la tienda ya las tiene.
  const apps = catalog
    .filter((e) => e.isPublic || byCode.has(e.code))
    .map((entry) => {
      const row = byCode.get(entry.code);
      return { entry, def: MODULES[entry.code], state: moduleState(row ? { status: row.status, expires_at: row.expiresAt } : null, now) };
    });
  const liveCount = apps.filter((a) => a.state.kind === "active" || a.state.kind === "trial").length;
  const storeLine = [`Tienda: ${ctx.store.name} (${storeDisplayHost(ctx.store)})`, ctx.user.email ? `Cuenta: ${ctx.user.email}` : null]
    .filter(Boolean)
    .join("\n");
  const suggest = contactFor(`Hola! Tengo una idea de app para mi rubro:\n\n\n${storeLine}`, "Idea de app para Ecommy");

  return (
    <>
      <PageHeader
        title="Apps"
        description={
          apps.length
            ? `Herramientas para rubros puntuales, además de tu plan · ${liveCount === 1 ? "1 activa" : `${liveCount} activas`}`
            : "Herramientas para rubros puntuales, además de tu plan."
        }
      />

      <div className="space-y-5">
        {apps.map((a) => (
          <AppCard key={a.def.code} def={a.def} entry={a.entry} state={a.state} storeLine={storeLine} />
        ))}
      </div>

      <p className="eco-bubble mt-6 max-w-[66ch] bg-adm-accent-2-soft px-4 py-3 text-[13px] leading-relaxed text-adm-fg [--eco-bubble-r:18px]">
        Las apps se activan a pedido: nos escribís, coordinamos el pago y la activamos en tu tienda. ¿Tu rubro necesita algo que no está acá?{" "}
        <a href={suggest.mailto} className="font-medium text-adm-link underline decoration-2 underline-offset-4">
          Contanos
        </a>
        .
      </p>
    </>
  );
}

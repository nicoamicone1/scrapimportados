import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CornerArc } from "@/app/(platform)/site-shapes";
import { BrandGlyph, bubbleRadii } from "@/app/_brand/glyph";
import { cn } from "@/lib/cn";

import { CTA_ARROW, CTA_PRIMARY, CTA_SECONDARY, DISPLAY, EYEBROW, H1, H2, TEXT_LINK } from "../brand";
import { FaqAccordion } from "../faq-accordion";
import type { FaqItem } from "../faq";
import { PlanCards, PlanCtaLink } from "../PlanCards";
import { formatLegalDate } from "../site";

import { SOURCES, VERIFIED_AT, type PageFaqItem, type SourceId, type FlowStep } from "./content";
import type { Crumb } from "./jsonld";
import type { PublicPlan } from "@/lib/plans/catalog";

/*
 * Piezas de las páginas de captación (/alternativa-a-tiendanube,
 * /funciones/*). Mismo lenguaje que la landing (BRAND §7.2): hojas con
 * esquinas de 32 px que se apilan, CTA de marca uno por vista, movimiento
 * con `eco-reveal` y `eco-pop`. Server components.
 */

/** La acción de marca de estas páginas (docs/gtm/PLAN-GTM.md §6). */
export const OFFER_HREF = "/empezar";
export const OFFER_LABEL = "Cargamos tu catálogo y lo probás 14 días";
export const DEMO_LABEL = "Ver una tienda de ropa funcionando";

/** Sección "hoja": esquinas superiores de 32 px que entran sobre la anterior. */
export function Sheet({ id, label, className, children }: { id?: string; label: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={label} className={cn("lp-sheet lp-under-sheet scroll-mt-24 overflow-x-clip", className)}>
      {children}
    </section>
  );
}

/** Ubicación: pastillas como las de las guías, con 44 px de alto en el celular. */
export function Breadcrumb({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <nav aria-label="Ubicación" className="text-[13px]">
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-1.5">
              {i > 0 ? (
                <span aria-hidden className="text-adm-fg-muted">
                  /
                </span>
              ) : null}
              {last ? (
                <span aria-current="page" className="inline-flex min-h-11 items-center px-1 font-medium text-adm-fg-muted md:min-h-8">
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="inline-flex min-h-11 items-center rounded-full bg-eco-paper px-3 font-medium text-adm-fg shadow-[0_0_0_1px_var(--eco-line)] transition-colors duration-[140ms] hover:bg-eco-niebla-2 md:min-h-8"
                >
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** CTA de marca + secundario a la demo + la línea de reversión de riesgo. */
export function OfferActions({ demoHref, className }: { demoHref: string; className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={OFFER_HREF} className={cn(CTA_PRIMARY, "h-auto min-h-12 max-w-full py-2 text-left leading-snug text-balance")}>
          {OFFER_LABEL}
          <span className={cn(CTA_ARROW, "shrink-0")}>
            <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
          </span>
        </Link>
        <a href={demoHref} className={cn(CTA_SECONDARY, "h-auto min-h-12 py-2 text-center leading-snug")}>
          {DEMO_LABEL}
        </a>
      </div>
      <p className="mt-4 text-[14px] text-adm-fg-muted">14 días de Pro, sin tarjeta. Sin comisión por venta.</p>
    </div>
  );
}

/** Portada de la página: ubicación, titular (el único h1), bajada, acciones y una pieza de producto. */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  lead,
  demoHref,
  visual,
  note,
}: {
  crumbs: readonly Crumb[];
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  demoHref: string;
  visual: ReactNode;
  /** Línea chica debajo de las acciones (por ejemplo, la fecha de verificación). */
  note?: ReactNode;
}) {
  return (
    <section aria-labelledby="hero-t" className="relative overflow-x-clip">
      <CornerArc corner="tr" size={560} className="hidden bg-eco-durazno/70 lg:block" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pt-8 pb-20 sm:px-6 md:pt-12 md:pb-28 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-14">
        <div className="min-w-0">
          <Breadcrumb crumbs={crumbs} />
          <p className={cn(EYEBROW, "eco-pop mt-8")}>{eyebrow}</p>
          <h1 id="hero-t" className={cn(H1, "eco-pop mt-4 max-w-[15ch] text-balance [--i:1] lg:text-[68px]")}>
            {title}
          </h1>
          <div className="eco-pop mt-6 max-w-[52ch] text-[18px] leading-[1.45] text-eco-ink [--i:2] sm:text-[20px]">{lead}</div>
          <OfferActions demoHref={demoHref} className="eco-pop mt-8 [--i:3]" />
          {note ? <div className="mt-6 text-[13px] text-adm-fg-muted">{note}</div> : null}
        </div>
        <div className="eco-pop min-w-0 [--i:2]">{visual}</div>
      </div>
    </section>
  );
}

/** Encabezado de sección: eyebrow + h2 (con id para `aria-labelledby`) + bajada opcional. */
export function SectionHead({ eyebrow, id, title, children, className, dark }: { eyebrow: string; id: string; title: ReactNode; children?: ReactNode; className?: string; dark?: boolean }) {
  return (
    <div className={cn("eco-reveal", className)}>
      <p className={dark ? "text-[12px] font-semibold tracking-[0.1em] text-eco-pomelo uppercase" : EYEBROW}>{eyebrow}</p>
      <h2 id={id} className={cn(H2, "mt-3 max-w-[18ch] text-balance", dark && "text-white")}>
        {title}
      </h2>
      {children ? <div className={cn("mt-5 max-w-[56ch] text-[16px] leading-relaxed", dark ? "text-eco-mist" : "text-eco-text-muted")}>{children}</div> : null}
    </div>
  );
}

/** Pasos numerados en una línea vertical: el número va en una burbuja (lo que "habla"). */
export function FlowSteps({ steps, className }: { steps: readonly FlowStep[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-7 self-start", className)}>
      <span aria-hidden className="absolute top-5 bottom-5 left-5 w-[2px] bg-eco-line" />
      {steps.map((s, i) => (
        <li key={s.title} className="eco-reveal relative flex gap-4">
          <span
            aria-hidden
            className="eco-bubble eco-num tnum relative flex size-10 shrink-0 items-center justify-center bg-eco-pomelo text-[16px] text-eco-ink [--eco-bubble-r:14px]"
          >
            {i + 1}
          </span>
          <div className="min-w-0 pt-1.5">
            <h3 className="text-[17px] leading-snug font-semibold text-eco-ink">
              <span className="sr-only">Paso {i + 1}: </span>
              {s.title}
            </h3>
            <p className="mt-1 max-w-[46ch] text-[15px] leading-relaxed text-eco-text-muted">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "Datos de Tiendanube verificados en su sitio el …": va visible donde se cita a un tercero. */
export function VerifiedNote({ who, className }: { who: string; className?: string }) {
  return (
    <p className={cn("text-[13px] text-adm-fg-muted", className)}>
      Datos de {who} verificados en su sitio el <time dateTime={VERIFIED_AT}>{formatLegalDate(VERIFIED_AT)}</time>. Pueden cambiar: las fuentes están
      abajo.
    </p>
  );
}

/** Lista de fuentes con link (abren en otra pestaña, sin pasarles datos). */
export function SourceList({ ids, id = "fuentes", className }: { ids: readonly SourceId[]; id?: string; className?: string }) {
  return (
    <div className={className}>
      <h3 id={id} className="text-[13px] font-semibold tracking-[0.06em] text-adm-fg-muted uppercase">
        Fuentes · consultadas el <time dateTime={VERIFIED_AT}>{formatLegalDate(VERIFIED_AT)}</time>
      </h3>
      <ol className="mt-3 grid gap-x-8 sm:grid-cols-2">
        {ids.map((sid, i) => (
          <li key={sid} id={`fuente-${sid}`} className="flex scroll-mt-28 items-baseline gap-2">
            <span className="tnum w-5 shrink-0 text-right text-[13px] text-adm-fg-muted">{i + 1}.</span>
            <a
              href={SOURCES[sid].url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 text-[14px] text-adm-link underline decoration-1 underline-offset-4 hover:text-adm-link-hover md:min-h-9"
            >
              {SOURCES[sid].label}
              <ArrowUpRight className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="sr-only"> (abre en otra pestaña)</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Preguntas frecuentes con el acordeón de la landing. El acordeón tipa el id
 * con las preguntas de la plataforma (`FaqId`), pero sólo lo usa para el
 * ancla `#faq-<id>`: estas preguntas traen el suyo.
 */
export function FaqSheet({ items, className, aside }: { items: readonly PageFaqItem[]; className?: string; aside?: ReactNode }) {
  return (
    <Sheet id="preguntas" label="preguntas-t" className={cn("bg-eco-paper [--lp-pb:96px] md:[--lp-pb:128px]", className)}>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20">
        <div className="min-w-0">
          <p className={EYEBROW}>Preguntas frecuentes</p>
          <h2 id="preguntas-t" className={cn(DISPLAY, "mt-3 max-w-[14ch] text-[30px] leading-[1.05] text-eco-ink sm:text-[38px]")}>
            Lo que nos preguntan antes de probar.
          </h2>
          <p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-eco-text-muted">
            ¿Te queda una duda?{" "}
            <Link href="/contacto" className={TEXT_LINK}>
              Escribinos
            </Link>{" "}
            o mirá el{" "}
            <Link href="/ayuda" className={TEXT_LINK}>
              centro de ayuda
            </Link>
            .
          </p>
          {aside}
        </div>
        <FaqAccordion className="min-w-0" items={items as unknown as readonly FaqItem[]} />
      </div>
    </Sheet>
  );
}

/** Planes de la base, como en la landing. Sin planes (la base no respondió), un link a /planes. */
export function PlansSheet({ plans, title, children }: { plans: readonly PublicPlan[]; title: ReactNode; children?: ReactNode }) {
  return (
    <Sheet id="planes" label="planes-t" className="bg-eco-pomelo-soft [--lp-pb:88px] md:[--lp-pb:120px]">
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24">
        <div className="eco-reveal flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={EYEBROW}>Planes</p>
            <h2 id="planes-t" className={cn(H2, "mt-3 max-w-[20ch] text-balance")}>
              {title}
            </h2>
            <div className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-eco-ink">{children}</div>
          </div>
          <Link href="/planes#comparar" className={cn(TEXT_LINK, "inline-flex min-h-11 items-center text-[15px]")}>
            Comparar todo en detalle
          </Link>
        </div>
        {plans.length ? (
          <PlanCards
            className="mt-10"
            plans={[...plans]}
            highlight="pro"
            highlightLabel="Incluido en la prueba"
            highlightNote="14 días de Pro, sin tarjeta. Después seguís en Free y no se borra nada."
            renderCta={(plan) =>
              plan.code === "business" ? (
                <PlanCtaLink href="/contacto#business">Hablemos</PlanCtaLink>
              ) : (
                <PlanCtaLink href="/registro" primary={plan.code === "pro"}>
                  {plan.code === "pro" ? "Probar Pro 14 días gratis" : "Empezar gratis"}
                </PlanCtaLink>
              )
            }
          />
        ) : (
          <p role="status" className="mt-10 rounded-eco-lg bg-eco-paper px-5 py-4 text-[15px] text-eco-ink">
            No pudimos cargar los precios ahora. Están en{" "}
            <Link href="/planes" className={TEXT_LINK}>
              la página de planes
            </Link>
            .
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** Logo sobre pomelo (BRAND §4.2): burbuja tinta con la "e" pomelo, que se dibuja. */
function InkMark({ size }: { size: number }) {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center bg-eco-ink" style={{ width: size, height: size, ...bubbleRadii(size) }}>
      <BrandGlyph size={Math.round(size * 0.58)} color="var(--eco-pomelo)" draw />
    </span>
  );
}

/** Cierre: hoja pomelo con el logo dibujándose y la acción de marca. */
export function ClosingSheet({ title, demoHref }: { title: ReactNode; demoHref: string }) {
  return (
    <Sheet label="cierre-t" className="bg-eco-pomelo text-eco-ink [--lp-pb:88px] md:[--lp-pb:128px]">
      <div aria-hidden className="lp-rings pointer-events-none absolute inset-0 rounded-t-[32px] [--lp-ring:rgb(16_22_47/0.08)] [--lp-rings-at:0%_100%]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-16">
        <InkMark size={120} />
        <div className="min-w-0">
          <h2 id="cierre-t" className={cn(H2, "max-w-[18ch] text-[38px] leading-[0.98] text-balance sm:text-[56px] lg:text-[68px]")}>
            {title}
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href={OFFER_HREF}
              className="group inline-flex min-h-14 max-w-full items-center gap-3 rounded-full bg-eco-ink py-2 pr-2 pl-7 text-left text-[16px] leading-snug font-semibold text-balance text-white transition-[background-color,transform] duration-[240ms] ease-eco-out hover:bg-eco-ink-2 active:scale-[0.98]"
            >
              {OFFER_LABEL}
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-eco-pomelo text-eco-ink transition-transform duration-[420ms] ease-eco-spring group-hover:translate-x-1 group-hover:-rotate-45">
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
            </Link>
            <a href={demoHref} className="inline-flex min-h-11 items-center text-[15px] font-semibold underline decoration-2 underline-offset-4">
              {DEMO_LABEL}
            </a>
          </div>
          <p className="mt-4 text-[15px] font-medium">14 días de Pro, sin tarjeta. Sin comisión por venta.</p>
        </div>
      </div>
    </Sheet>
  );
}

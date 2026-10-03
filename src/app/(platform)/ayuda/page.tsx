import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DISPLAY, EYEBROW, NUM, TEXT_LINK } from "@/components/platform/brand";
import { HelpSearch } from "@/components/platform/HelpSearch";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { HELP_ARTICLES, helpBySection, helpSectionTitle } from "@/content/ayuda";
import type { HelpSearchItem } from "@/content/search";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/version";

import { ArcWord, CornerArc, Rings } from "../site-shapes";
import "../site.css";

const TITLE = "Centro de ayuda";
const DESCRIPTION =
  "Cómo usar tu tienda Ecommy paso a paso: cargar e importar productos, cobrar, zonas de envío, apariencia, legales y plan. Con los nombres de cada pantalla.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/ayuda" },
  openGraph: { siteName: APP_NAME, locale: "es_AR", type: "website", title: `${TITLE} · ${APP_NAME}`, description: DESCRIPTION, url: "/ayuda" },
};

const SUGGESTIONS = ["transferencia", "CSV", "zonas de envío", "precios", "dominio"];

/*
 * Estática: no lee la sesión (el header muestra "Ingresar"; con sesión, /login
 * lleva directo a /app). Se sirve desde la CDN sin pasar por Supabase.
 */
export default function AyudaPage() {
  const sections = helpBySection();
  const [start, ...rest] = sections;
  const items: HelpSearchItem[] = HELP_ARTICLES.map((a) => ({
    slug: a.slug,
    title: a.title,
    description: a.description,
    section: helpSectionTitle(a.section),
    readingMinutes: a.readingMinutes,
  }));
  const first = start?.articles[0];
  // Celdas de la grilla de 3 (las secciones largas ocupan dos filas): si sobra un hueco al final, la última se estira.
  const cells = rest.reduce((n, s) => n + (s.articles.length > 2 ? 2 : 1), 0);
  const stretchLast = cells % 3 === 2;

  return (
    <PlatformPage signedIn={false}>
      <div className="relative overflow-hidden">
        <CornerArc corner="tr" size={560} className="hidden bg-eco-durazno/70 md:block" />
        <Rings size={900} count={7} className="-top-[420px] -right-[380px] hidden text-eco-pomelo/20 md:block" />
        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-20 sm:px-6 md:pt-20">
          <HelpSearch
            items={items}
            suggestions={SUGGESTIONS}
            hero={
              <div className="eco-pop">
                <p className={EYEBROW}>{TITLE}</p>
                <h1 className={cn(DISPLAY, "mt-4 max-w-[14ch] text-[44px] leading-[0.98] text-balance sm:text-[60px]")}>
                  ¿Qué querés hacer en tu <ArcWord>tienda</ArcWord>?
                </h1>
                <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-adm-fg-muted">
                  {HELP_ARTICLES.length} artículos cortos, con los nombres de los menús y botones tal como los ves en el panel.
                </p>
              </div>
            }
          >
            <div className="mt-16 space-y-6">
              {start && first ? (
                <Link
                  href={`/ayuda/${first.slug}`}
                  className="eco-bubble group relative grid gap-6 overflow-hidden bg-eco-ink p-7 text-white [--eco-bubble-r:32px] sm:p-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
                >
                  <Rings size={560} count={5} className="-right-48 -bottom-64 text-eco-ink-3" />
                  <span className="relative">
                    <span className="text-[12px] font-semibold tracking-[0.1em] text-eco-pomelo uppercase">¿Recién abrís tu tienda? Empezá por acá</span>
                    <span className={cn(DISPLAY, "mt-3 block max-w-[20ch] text-[30px] leading-[1.02] sm:text-[40px]")}>{first.title}</span>
                    <span className="mt-4 block max-w-[60ch] text-[15px] leading-relaxed text-eco-mist">{first.description}</span>
                  </span>
                  <span className="relative inline-flex h-12 w-fit items-center gap-3 rounded-full bg-eco-pomelo pr-1.5 pl-5 text-[15px] font-semibold text-eco-ink">
                    Leer · {first.readingMinutes} min
                    <span aria-hidden className="site-arrow flex size-9 items-center justify-center rounded-full bg-eco-ink text-white">
                      <ArrowRight className="size-4" strokeWidth={2} />
                    </span>
                  </span>
                </Link>
              ) : null}

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((s, i) => {
                  const accent = s.id === "pedidos";
                  return (
                    <section
                      key={s.id}
                      id={s.id}
                      aria-labelledby={`sec-${s.id}`}
                      className={cn(
                        "eco-reveal site-lift flex min-w-0 scroll-mt-24 flex-col p-6 sm:p-7",
                        accent ? "bg-eco-durazno" : "border border-eco-line bg-adm-surface",
                        s.articles.length > 2 && "lg:row-span-2",
                        stretchLast && i === rest.length - 1 && "lg:col-span-2",
                      )}
                    >
                      <p className={cn(NUM, "text-[15px]", accent ? "text-eco-ink" : "text-eco-pomelo-ink")}>{String(i + 2).padStart(2, "0")}</p>
                      <h2 id={`sec-${s.id}`} className={cn(DISPLAY, "mt-3 text-[24px] leading-tight")}>
                        {s.title}
                      </h2>
                      <p className={cn("mt-1.5 text-[14px] leading-snug", accent ? "text-eco-ink" : "text-adm-fg-muted")}>{s.description}</p>
                      <ul className="mt-5 flex-1 space-y-1">
                        {s.articles.map((a) => (
                          <li key={a.slug}>
                            <Link
                              href={`/ayuda/${a.slug}`}
                              className={cn(
                                "group/a -mx-3 flex items-start gap-3 rounded-[14px] px-3 py-2.5 transition-colors duration-[140ms]",
                                accent ? "hover:bg-eco-pomelo-soft" : "hover:bg-eco-niebla",
                              )}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-[15px] leading-snug font-semibold text-adm-fg underline-offset-4 group-hover/a:underline">{a.title}</span>
                                <span className={cn("mt-0.5 block text-[13px]", accent ? "text-eco-ink" : "text-adm-fg-muted")}>{a.readingMinutes} min</span>
                              </span>
                              <ArrowRight className="site-arrow mt-1 size-4 shrink-0" strokeWidth={2} aria-hidden />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </div>
          </HelpSearch>

          <div className="mt-16 grid gap-6 border-t border-eco-line pt-10 text-[15px] leading-relaxed md:grid-cols-2">
            <p className="max-w-[52ch]">
              <span className="font-semibold">¿No encontraste lo que buscabas?</span>{" "}
              <Link href="/contacto" className={TEXT_LINK}>
                Escribinos
              </Link>{" "}
              con la dirección de tu tienda y qué querés hacer: respondemos en horario hábil.
            </p>
            <p className="max-w-[52ch] text-adm-fg-muted">
              Si todavía no tenés tienda, en las{" "}
              <Link href="/guias" className={TEXT_LINK}>
                guías
              </Link>{" "}
              hay temas de fondo: vender por WhatsApp, lo que pide la ley y cómo mudarte de plataforma.
            </p>
          </div>
        </div>
      </div>
    </PlatformPage>
  );
}

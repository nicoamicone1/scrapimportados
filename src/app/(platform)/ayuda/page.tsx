import type { Metadata } from "next";
import Link from "next/link";

import { HelpSearch } from "@/components/platform/HelpSearch";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { HELP_ARTICLES, helpBySection, helpSectionTitle } from "@/content/ayuda";
import type { HelpSearchItem } from "@/content/search";
import { APP_NAME } from "@/lib/version";

const TITLE = "Centro de ayuda";
const DESCRIPTION =
  "Cómo usar tu tienda Ecommy paso a paso: cargar e importar productos, cobrar, zonas de envío, apariencia, legales y plan. Con los nombres de cada pantalla.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/ayuda" },
  openGraph: { siteName: APP_NAME, locale: "es_AR", type: "website", title: `${TITLE} · ${APP_NAME}`, description: DESCRIPTION, url: "/ayuda" },
};
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

  return (
    <PlatformPage signedIn={false}>
      <section className="border-b border-adm-border bg-adm-surface">
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-6 md:pt-14">
          <p className="text-[12px] font-medium tracking-[0.08em] text-adm-accent-2-ink uppercase">Centro de ayuda</p>
          <h1 className="mt-3 max-w-[22ch] text-[30px] leading-tight font-semibold tracking-[-0.02em] sm:text-[38px]">
            Cómo hacer cada cosa en tu tienda, paso a paso.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-adm-fg-muted">
            {HELP_ARTICLES.length} artículos cortos, escritos con los nombres de los menús y botones tal como los ves en el panel.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-12">
        <HelpSearch items={items}>
          <div className="mt-10 space-y-12">
            {start ? (
              <section aria-labelledby={`sec-${start.id}`} className="max-w-[860px] rounded-adm border border-[#cfdcd3] bg-adm-accent-soft px-5 py-5 sm:px-6">
                <h2 id={`sec-${start.id}`} className="text-[12px] font-medium tracking-[0.07em] text-adm-accent uppercase">
                  ¿Recién abrís tu tienda? {start.title} por acá
                </h2>
                <ul className="mt-2 space-y-3">
                  {start.articles.map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/ayuda/${a.slug}`}
                        className="text-[19px] leading-snug font-semibold tracking-[-0.01em] text-adm-fg underline-offset-4 hover:text-adm-accent hover:underline"
                      >
                        {a.title}
                      </Link>
                      <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-adm-fg-muted">
                        {a.description} <span className="whitespace-nowrap">· {a.readingMinutes} min</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="grid gap-x-14 gap-y-12 md:grid-cols-2">
              {rest.map((s) => (
                <section key={s.id} id={s.id} aria-labelledby={`sec-${s.id}`} className="min-w-0 scroll-mt-6">
                  <h2 id={`sec-${s.id}`} className="text-[20px] leading-tight font-semibold tracking-[-0.015em]">
                    {s.title}
                  </h2>
                  <p className="mt-1 text-[14px] text-adm-fg-muted">{s.description}</p>
                  <ul className="mt-4 border-b border-adm-border">
                    {s.articles.map((a) => (
                      <li key={a.slug} className="border-t border-adm-border py-3.5">
                        <Link href={`/ayuda/${a.slug}`} className="text-[15px] font-medium text-adm-fg underline-offset-4 hover:text-adm-accent hover:underline">
                          {a.title}
                        </Link>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-adm-fg-muted">
                          {a.description} <span className="whitespace-nowrap">· {a.readingMinutes} min</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </HelpSearch>

        <div className="mt-14 grid gap-6 border-t border-adm-border pt-8 text-[14px] leading-relaxed md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <p className="max-w-[56ch]">
            <span className="font-medium">¿No encontraste lo que buscabas?</span>{" "}
            <Link href="/contacto" className="text-adm-accent underline underline-offset-2">
              Escribinos
            </Link>{" "}
            con la dirección de tu tienda y qué querés hacer: respondemos en horario hábil.
          </p>
          <p className="text-adm-fg-muted">
            Si todavía no tenés tienda, en las{" "}
            <Link href="/guias" className="text-adm-accent underline underline-offset-2">
              guías
            </Link>{" "}
            hay temas de fondo: vender por WhatsApp, lo que pide la ley y cómo mudarte de plataforma.
          </p>
        </div>
      </div>
    </PlatformPage>
  );
}

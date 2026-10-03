import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DISPLAY, EYEBROW, NUM, TEXT_LINK } from "@/components/platform/brand";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { formatLegalDate } from "@/components/platform/site";
import { GUIDES } from "@/content/guias";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/version";

import { CornerArc, Rings } from "../site-shapes";
import "../site.css";

const TITLE = "Guías para vender online en Argentina";
const DESCRIPTION =
  "Guías prácticas para comercios argentinos: vender por WhatsApp con orden, botón de arrepentimiento, precio sin impuestos nacionales y mudar tu tienda sin perder Google.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guias" },
  openGraph: { siteName: APP_NAME, locale: "es_AR", type: "website", title: `${TITLE} · ${APP_NAME}`, description: DESCRIPTION, url: "/guias" },
};
/*
 * Estática: no lee la sesión (el header muestra "Ingresar"; con sesión, /login
 * lleva directo a /app). Se sirve desde la CDN sin pasar por Supabase.
 */

function Dateline({ iso, minutes, className }: { iso: string; minutes: number; className?: string }) {
  return (
    <p className={cn("text-[13px]", className)}>
      Revisada el <time dateTime={iso}>{formatLegalDate(iso)}</time> · {minutes} min de lectura
    </p>
  );
}

export default function GuiasPage() {
  const [featured, ...rest] = GUIDES;

  return (
    <PlatformPage signedIn={false}>
      <div className="relative overflow-hidden">
        <CornerArc corner="tr" size={520} className="hidden bg-eco-durazno/70 md:block" />
        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-20 sm:px-6 md:pt-20">
          <header className="eco-pop max-w-[62ch]">
            <p className={EYEBROW}>Guías</p>
            <h1 className={cn(DISPLAY, "mt-4 max-w-[16ch] text-[40px] leading-[0.98] text-balance sm:text-[56px]")}>Vender online en Argentina, sin vueltas</h1>
            <p className="mt-5 text-[17px] leading-relaxed text-adm-fg-muted">
              Lo que conviene saber antes de abrir o mudar una tienda: qué pide la ley, cómo ordenar las ventas y cómo cuidar lo que ya ganaste en
              Google. Sin relleno y con la fecha de la última revisión.
            </p>
          </header>

          <div className="mt-14 grid gap-6 lg:grid-cols-12">
            {featured ? (
              <Link
                href={`/guias/${featured.slug}`}
                className="eco-bubble group relative flex min-h-[420px] flex-col justify-between overflow-hidden bg-eco-ink p-7 text-white [--eco-bubble-r:36px] sm:p-10 lg:col-span-7"
              >
                <Rings size={640} count={6} className="-right-56 -bottom-72 text-eco-ink-3" />
                <span className="relative">
                  <span className="inline-flex rounded-full bg-eco-pomelo px-3 py-1 text-[12px] font-semibold text-eco-ink">{featured.section}</span>
                  <span className={cn(DISPLAY, "mt-6 block max-w-[18ch] text-[32px] leading-[1.02] text-balance sm:text-[44px]")}>{featured.title}</span>
                  <span className="mt-5 block max-w-[48ch] text-[17px] leading-snug text-eco-mist">{featured.description}</span>
                </span>
                <span className="relative mt-10 flex flex-wrap items-end justify-between gap-4">
                  <Dateline iso={featured.updatedAt} minutes={featured.readingMinutes} className="text-eco-bruma" />
                  <span className="inline-flex h-12 items-center gap-3 rounded-full bg-eco-pomelo pr-1.5 pl-5 text-[15px] font-semibold text-eco-ink">
                    Leer la guía
                    <span aria-hidden className="site-arrow flex size-9 items-center justify-center rounded-full bg-eco-ink text-white">
                      <ArrowRight className="size-4" strokeWidth={2} />
                    </span>
                  </span>
                </span>
              </Link>
            ) : null}

            <ol className="grid gap-4 lg:col-span-5">
              {rest.map((g, i) => (
                <li key={g.slug} className="eco-pop" style={{ ["--i" as string]: i + 1 }}>
                  <Link href={`/guias/${g.slug}`} className="site-lift group flex h-full gap-5 border border-eco-line bg-adm-surface p-6">
                    <span className={cn(NUM, "text-[28px] leading-none text-eco-pomelo-ink")}>{String(i + 2).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-semibold tracking-[0.06em] text-adm-fg-muted uppercase">{g.section}</span>
                      <span className="mt-1.5 block text-[18px] leading-snug font-semibold text-balance underline-offset-4 group-hover:underline">{g.title}</span>
                      <Dateline iso={g.updatedAt} minutes={g.readingMinutes} className="mt-2 text-adm-fg-muted" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-14 max-w-[68ch] text-[15px] leading-relaxed text-adm-fg-muted">
            ¿Ya tenés tu tienda y buscás cómo hacer algo puntual? Está en el{" "}
            <Link href="/ayuda" className={TEXT_LINK}>
              centro de ayuda
            </Link>
            .
          </p>
        </div>
      </div>
    </PlatformPage>
  );
}

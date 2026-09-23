import type { Metadata } from "next";
import Link from "next/link";

import { PlatformPage } from "@/components/platform/PlatformChrome";
import { formatLegalDate } from "@/components/platform/site";
import { GUIDES } from "@/content/guias";
import { getSession } from "@/lib/auth";
import { APP_NAME } from "@/lib/version";

const TITLE = "Guías para vender online en Argentina";
const DESCRIPTION =
  "Guías prácticas para comercios argentinos: vender por WhatsApp con orden, botón de arrepentimiento, precio sin impuestos nacionales y mudar tu tienda sin perder Google.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guias" },
  openGraph: { siteName: APP_NAME, locale: "es_AR", type: "website", title: `${TITLE} · ${APP_NAME}`, description: DESCRIPTION, url: "/guias" },
};
export const dynamic = "force-dynamic";

function Dateline({ iso, minutes }: { iso: string; minutes: number }) {
  return (
    <p className="text-[13px] text-adm-fg-muted">
      <time dateTime={iso}>{formatLegalDate(iso)}</time> · {minutes} min de lectura
    </p>
  );
}

export default async function GuiasPage() {
  const { user } = await getSession();
  const [featured, ...rest] = GUIDES;

  return (
    <PlatformPage signedIn={Boolean(user)}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <header className="max-w-[62ch]">
          <p className="text-[12px] font-medium tracking-[0.08em] text-adm-accent-2-ink uppercase">Guías</p>
          <h1 className="mt-3 text-[30px] leading-tight font-semibold tracking-[-0.02em] sm:text-[38px]">{TITLE}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">
            Lo que conviene saber antes de abrir o mudar una tienda: qué pide la ley, cómo ordenar las ventas y cómo cuidar lo que ya ganaste en
            Google. Sin relleno y con la fecha de la última revisión.
          </p>
        </header>

        <div className="mt-10 grid gap-10 border-t border-adm-border pt-10 lg:grid-cols-12 lg:gap-14">
          {featured ? (
            <article className="min-w-0 lg:col-span-7">
              <p className="text-[12px] font-medium tracking-[0.07em] text-adm-fg-muted uppercase">{featured.section}</p>
              <h2 className="mt-2 text-[28px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[36px]">
                <Link href={`/guias/${featured.slug}`} className="underline-offset-[6px] hover:text-adm-accent hover:underline">
                  {featured.title}
                </Link>
              </h2>
              <p className="mt-4 max-w-[52ch] text-[17px] leading-snug">{featured.description}</p>
              <div className="mt-4">
                <Dateline iso={featured.updatedAt} minutes={featured.readingMinutes} />
              </div>
              <Link
                href={`/guias/${featured.slug}`}
                className="mt-6 inline-flex h-10 items-center rounded-adm bg-adm-accent px-4 text-sm font-medium text-adm-accent-fg transition-colors hover:bg-adm-accent-hover"
              >
                Leer la guía
              </Link>
            </article>
          ) : null}

          <ol className="min-w-0 border-b border-adm-border lg:col-span-5">
            {rest.map((g) => (
              <li key={g.slug} className="border-t border-adm-border py-5 first:border-t-0 first:pt-0">
                <article>
                  <p className="text-[12px] font-medium tracking-[0.07em] text-adm-fg-muted uppercase">{g.section}</p>
                  <h2 className="mt-1.5 text-[19px] leading-snug font-semibold tracking-[-0.01em]">
                    <Link href={`/guias/${g.slug}`} className="underline-offset-4 hover:text-adm-accent hover:underline">
                      {g.title}
                    </Link>
                  </h2>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-adm-fg-muted">{g.description}</p>
                  <div className="mt-2">
                    <Dateline iso={g.updatedAt} minutes={g.readingMinutes} />
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-12 max-w-[68ch] text-[14px] leading-relaxed text-adm-fg-muted">
          ¿Ya tenés tu tienda y buscás cómo hacer algo puntual? Está en el{" "}
          <Link href="/ayuda" className="text-adm-accent underline underline-offset-2">
            centro de ayuda
          </Link>
          .
        </p>
      </div>
    </PlatformPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { DISPLAY, EYEBROW, TEXT_LINK } from "@/components/platform/brand";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { demoStoreHref } from "@/components/platform/site";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { STORE_KINDS } from "@/lib/tenant/kinds";

import { ArcWord, CornerArc } from "../site-shapes";
import "../site.css";

import { CatalogRequestForm } from "./CatalogRequestForm";

export const metadata: Metadata = {
  title: "Te cargamos el catálogo",
  description:
    "Pasanos tu Instagram y tu lista de precios: cargamos tus 30 productos más vendidos con talles y colores, te mostramos el panel en una llamada de 30 minutos y lo probás 14 días con Pro, sin tarjeta.",
  alternates: { canonical: "/empezar" },
};
export const dynamic = "force-dynamic";

/** Cómo sigue después del formulario (docs/gtm/PLAN-GTM.md §7: la oferta, sin cifras de clientes). */
const NEXT_STEPS = [
  "Te escribimos por WhatsApp en horario hábil y nos pasás tu lista de precios.",
  "Cargamos tus 30 productos más vendidos desde tus fotos de Instagram, con talles, colores y stock.",
  "En una llamada de 30 minutos recorremos el panel y hacés un pedido de prueba.",
  "Lo probás 14 días con Pro, sin tarjeta. Después elegís un plan o seguís en Free, y no se borra nada.",
] as const;

export default async function EmpezarPage() {
  const { user } = await getSession();
  const kinds = STORE_KINDS.map((k) => ({ value: k.id, label: k.label }));

  return (
    <PlatformPage signedIn={Boolean(user)}>
      <section className="relative overflow-hidden">
        <CornerArc corner="tr" size={520} className="hidden bg-eco-durazno/70 md:block" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-16 sm:px-6 md:pt-20 md:pb-24 lg:grid-cols-12 lg:gap-14">
          <div className="eco-pop min-w-0 lg:col-span-6">
            <p className={EYEBROW}>Empezar</p>
            <h1 className={cn(DISPLAY, "mt-4 text-[40px] leading-[0.98] text-balance sm:text-[60px]")}>
              Te cargamos el catálogo. Lo probás con tus <ArcWord>clientas</ArcWord>.
            </h1>
            <p className="mt-6 max-w-[46ch] text-[19px] leading-[1.4] sm:text-[21px]">
              Pasanos tu Instagram y tu lista de precios: cargamos tus 30 productos más vendidos con talles y colores, te mostramos el panel
              en una llamada de 30 minutos y lo probás 14 días con Pro, sin tarjeta.
            </p>

            <h2 className="mt-10 text-[13px] font-semibold tracking-[0.06em] text-adm-fg-muted uppercase">Cómo sigue</h2>
            <ol className="mt-4 space-y-3">
              {NEXT_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3.5 text-[15px] leading-relaxed">
                  <span
                    aria-hidden
                    className={cn(DISPLAY, "flex size-7 shrink-0 items-center justify-center rounded-full rounded-bl-[4px] bg-eco-pomelo text-[13px] text-eco-ink")}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <p className="mt-10 max-w-[52ch] text-[14px] leading-relaxed text-adm-fg-muted">
              ¿Preferís armarla vos?{" "}
              <Link href={user ? "/app/nueva" : "/registro"} className={TEXT_LINK}>
                Creá tu tienda
              </Link>{" "}
              y cargá los productos a mano o desde una planilla.
            </p>
          </div>

          <div className="min-w-0 lg:col-span-6 lg:pt-4">
            <div className="eco-pop relative rounded-eco-xl border border-eco-line bg-adm-surface p-6 shadow-[0_40px_80px_-48px_rgb(16_22_47/0.45)] sm:p-8" style={{ ["--i" as string]: 1 }}>
              <h2 className={cn(DISPLAY, "text-[24px] leading-tight sm:text-[28px]")}>Contanos de tu marca</h2>
              <p className="mt-2 mb-6 text-[14px] leading-relaxed text-adm-fg-muted">Cuatro datos. Con eso arrancamos.</p>
              <CatalogRequestForm kinds={kinds} demoHref={demoStoreHref()} />
            </div>
          </div>
        </div>
      </section>
    </PlatformPage>
  );
}

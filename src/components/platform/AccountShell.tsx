import { Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { CornerArc, Rings } from "@/app/(platform)/site-shapes";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { APP_NAME } from "@/lib/version";

import "@/app/(platform)/site.css";

import { BrandLockup, BrandMark, DISPLAY, NUM } from "./brand";

/*
 * Marco de las pantallas de cuenta del sitio (ingreso, registro, nueva
 * contraseña, invitación y alta de tienda). Pantalla partida: a la izquierda
 * el formulario limpio; a la derecha, en desktop, una **hoja** de marca
 * (tinta o durazno, esquinas de 32 px, separada del borde) con el logo que se
 * dibuja, lo que el usuario necesita saber en ESE paso y una captura real.
 * Sin `aside`, una sola columna; `wide` para el alta (trae su vista previa).
 */

/** Control de formulario del sitio: 48 px, radio 12, texto de 16 (sin zoom en iOS). */
export const SITE_INPUT = "h-12 pointer-coarse:h-12 rounded-[12px] px-3.5 text-[16px] pointer-coarse:text-[16px]";

/**
 * Botón principal de formulario: pastilla de 48 px. Con `variant="primary"`
 * es tinta (ingresar, guardar); con `variant="accent"` es el CTA de marca
 * pomelo con texto tinta (crear cuenta, crear tienda).
 */
export const SITE_SUBMIT = "h-12 pointer-coarse:h-12 w-full rounded-full px-6 text-[15px] font-semibold";

/** Título de las pantallas de cuenta. */
export const ACCOUNT_TITLE = cn(DISPLAY, "text-[34px] leading-[1.02] text-balance sm:text-[40px]");

export function AccountShell({ aside, wide, children }: { aside?: ReactNode; wide?: boolean; children: ReactNode }) {
  const twoCol = Boolean(aside) && !wide;
  return (
    <div className={cn("grid min-h-dvh bg-adm-surface", twoCol && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]")}>
      <section className={cn("flex min-w-0 flex-col overflow-x-clip px-4 py-5 sm:px-10 lg:py-8", wide ? "mx-auto w-full max-w-7xl" : "lg:px-14 xl:px-20")}>
        <header className="flex items-center justify-between gap-4">
          <Link href="/" aria-label={`${APP_NAME}, inicio`} className="inline-flex items-center rounded-adm">
            <BrandLockup size={30} />
          </Link>
        </header>

        <div className={cn("flex w-full flex-1 flex-col py-10 lg:py-12", wide ? "max-w-none" : "mx-auto max-w-[420px] justify-center lg:mx-0")}>{children}</div>

        <footer className="flex flex-wrap items-center gap-x-5 text-[13px] text-adm-fg-muted">
          {[
            ["/", "Inicio"],
            ["/planes", "Planes"],
            ["/ayuda", "Ayuda"],
            ["/contacto", "Contacto"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="inline-flex min-h-11 items-center underline-offset-4 hover:text-adm-fg hover:underline lg:min-h-0">
              {label}
            </Link>
          ))}
        </footer>
      </section>

      {twoCol ? <div className="hidden p-3 lg:block">{aside}</div> : null}
    </div>
  );
}

/**
 * La hoja de marca: logo que se dibuja, eyebrow, frase en display, 2–3 datos
 * verificables y un visual real (`visual`: captura o mini-demo). `tone`
 * tinta (ingreso, invitación) o durazno (registro: el primer paso, cálido).
 */
export function AccountAside({
  eyebrow,
  title,
  points,
  children,
  visual,
  tone = "tinta",
}: {
  eyebrow?: string;
  title: ReactNode;
  points?: ReactNode[];
  children?: ReactNode;
  visual?: ReactNode;
  tone?: "tinta" | "durazno";
}) {
  const dark = tone === "tinta";
  return (
    <aside
      className={cn(
        "sticky top-3 flex h-[calc(100dvh-24px)] min-h-[640px] flex-col overflow-hidden rounded-eco-xl px-12 pt-12 xl:px-16 xl:pt-14",
        dark ? "bg-eco-ink text-eco-mist" : "bg-eco-durazno text-eco-ink",
        "relative",
      )}
    >
      <Rings size={760} count={6} className={cn("-top-80 -right-72", dark ? "text-eco-ink-3" : "text-eco-pomelo/25")} />
      <CornerArc corner="br" size={420} className={dark ? "bg-eco-ink-2" : "bg-eco-pomelo-soft"} />

      <div className="relative max-w-[480px]">
        <BrandMark size={52} draw />
        {eyebrow ? (
          <p className={cn("mt-8 text-[12px] font-semibold tracking-[0.1em] uppercase", dark ? "text-eco-pomelo" : "text-eco-pomelo-ink")}>{eyebrow}</p>
        ) : null}
        <p className={cn(DISPLAY, "mt-3 text-[38px] leading-[1.02] text-balance xl:text-[44px]", dark ? "text-white" : "text-eco-ink")}>{title}</p>
        {points?.length ? (
          <ul className="mt-7 space-y-3 text-[15px] leading-snug">
            {points.map((p, i) => (
              <li key={i} className="eco-pop flex gap-3" style={{ ["--i" as string]: i + 2 }}>
                <span
                  aria-hidden
                  className={cn(
                    "mt-px flex size-5 shrink-0 items-center justify-center rounded-full rounded-bl-[4px]",
                    dark ? "bg-eco-pomelo text-eco-ink" : "bg-eco-ink text-white",
                  )}
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {children}
      </div>

      {visual ? <div className="relative mt-auto pt-10">{visual}</div> : <div className="mt-auto" />}
    </aside>
  );
}

/**
 * Captura real del panel (Pedidos) en un marco burbuja, inclinada 1,5° y
 * cortada por el borde de la hoja, con el aviso de pedido que flota encima.
 */
export function PanelGlimpse() {
  return (
    <div aria-hidden className="relative -mr-24 xl:-mr-28">
      <div className="eco-bubble relative translate-y-6 rotate-[-1.5deg] overflow-hidden bg-adm-surface shadow-[0_40px_80px_-40px_rgb(0_0_0/0.6)] ring-1 ring-white/10 [--eco-bubble-r:24px]">
        <Image src="/img/platform/panel-pedidos.webp" alt="" width={1280} height={800} sizes="640px" className="block h-auto w-[640px] max-w-none" priority={false} />
      </div>
      <div className="eco-float absolute -top-6 left-6 flex items-center gap-3 rounded-[18px] rounded-bl-[4px] bg-eco-pomelo px-4 py-3 text-[13px] text-eco-ink shadow-[0_18px_36px_-20px_rgb(0_0_0/0.6)]">
        <span className="flex size-2 rounded-full bg-eco-ink" />
        <span className="tnum">
          Pedido nuevo <span className="font-semibold">#1043</span> · {formatMoney(48500)} · Transferencia
        </span>
      </div>
    </div>
  );
}

/**
 * La tienda en el celular (captura real de la demo) con el recibo del pedido
 * superpuesto: lo que paga el cliente, comisión de Ecommy en $ 0 y lo que
 * llega a tu cuenta.
 */
export function StoreGlimpse() {
  return (
    <div aria-hidden className="relative flex items-end gap-6">
      <div className="eco-bubble relative w-[230px] shrink-0 translate-y-10 overflow-hidden border-[6px] border-eco-ink bg-eco-ink shadow-[0_40px_80px_-40px_rgb(16_22_47/0.7)] [--eco-bubble-r:34px]">
        <Image src="/img/platform/tienda-demo-m.webp" alt="" width={540} height={1169} sizes="230px" className="block h-auto w-full" />
      </div>
      <div className="eco-float mb-16 min-w-0 flex-1" style={{ ["--i" as string]: 1 }}>
        <ReceiptMini />
      </div>
    </div>
  );
}

/**
 * Recibo del pedido #1042 (mismos números que la landing): lo que paga el
 * cliente, la comisión de Ecommy en $ 0 y lo que llega a la cuenta.
 */
export function ReceiptMini() {
  const subtotal = 18900 + 26500;
  const discount = Math.round(subtotal * 0.1);
  const shipping = 3200;
  const total = subtotal - discount + shipping;
  return (
    <figure aria-label="Ejemplo de un pedido pagado por transferencia" className="eco-bubble max-w-[300px] bg-adm-surface p-5 text-[13px] text-adm-fg shadow-[0_24px_48px_-28px_rgb(16_22_47/0.55)] [--eco-bubble-r:22px]">
      <figcaption className="flex items-baseline justify-between gap-3 border-b border-dashed border-eco-line pb-2.5">
        <span className="font-semibold">Pedido #1042</span>
        <span className="text-adm-fg-muted">Transferencia</span>
      </figcaption>
      <dl className="tnum mt-2.5 space-y-1.5">
        <div className="flex justify-between gap-3">
          <dt className="text-adm-fg-muted">Paga el cliente</dt>
          <dd>{formatMoney(total)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-adm-fg-muted">Comisión de Ecommy</dt>
          <dd className="font-semibold text-eco-pomelo-ink">{formatMoney(0)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-eco-line pt-2">
          <dt className="font-semibold">Llega a tu cuenta</dt>
          <dd className={cn(NUM, "text-[20px]")}>{formatMoney(total)}</dd>
        </div>
      </dl>
    </figure>
  );
}

/**
 * Progreso en arco: un anillo que se completa con la curva de la marca
 * (BRAND §5.3: el pomelo marca progreso), "Paso 2 de 3" y los nombres de los
 * pasos. El registro y el alta comparten la cuenta de pasos para que el
 * usuario sepa cuánto falta desde el primer campo.
 */
export function FlowProgress({ step, total, label, steps }: { step: number; total: number; label: string; steps?: readonly string[] }) {
  const R = 19;
  const C = 2 * Math.PI * R;
  const done = Math.min(1, Math.max(0, step / total));
  return (
    <div className="mb-8 flex items-center gap-3.5">
      <div
        role="progressbar"
        aria-label="Progreso del alta"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-valuetext={`Paso ${step} de ${total}: ${label}`}
        className="relative size-12 shrink-0"
      >
        <svg viewBox="0 0 48 48" className="size-12 -rotate-90">
          <circle cx={24} cy={24} r={R} fill="none" stroke="var(--eco-niebla-2)" strokeWidth={5} />
          <circle
            cx={24}
            cy={24}
            r={R}
            fill="none"
            stroke="var(--eco-pomelo)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - done)}
            className="site-arc-progress"
          />
        </svg>
        <span className={cn(NUM, "absolute inset-0 flex items-center justify-center text-[15px]")}>{step}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-adm-fg-muted">
          <span className="tnum font-semibold text-adm-fg">
            Paso {step} de {total}
          </span>{" "}
          · {label}
        </p>
        {steps?.length ? (
          <ol className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-adm-fg-muted">
            {steps.map((s, i) => (
              <li key={s} className={cn("flex items-center gap-1.5", i + 1 === step && "font-semibold text-adm-fg", i + 1 < step && "text-adm-fg")}>
                {i > 0 ? <span aria-hidden className="h-px w-3 bg-eco-line" /> : null}
                {i + 1 < step ? <Check className="size-3 text-adm-success" strokeWidth={2.5} aria-hidden /> : null}
                {s}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}

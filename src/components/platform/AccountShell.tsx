import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { APP_NAME } from "@/lib/version";

import { BrandLockup, DISPLAY } from "./brand";

/*
 * Marco de las pantallas de cuenta del sitio (registro, ingreso, nueva
 * contraseña, invitación y alta de tienda). Reemplaza a `admin/AuthLayout`
 * en el sitio público: logo SVG, Archivo en display y, en desktop, una banda
 * tinta con lo que el usuario necesita saber en ESE paso (no un slogan
 * genérico). Sin `aside`, una sola columna ancha (el alta de tienda trae su
 * propia vista previa).
 */

export function AccountShell({ aside, wide, children }: { aside?: ReactNode; wide?: boolean; children: ReactNode }) {
  const twoCol = Boolean(aside) && !wide;
  return (
    <div className={cn("grid min-h-dvh bg-adm-surface", twoCol && "md:grid-cols-[minmax(440px,560px)_minmax(0,1fr)]")}>
      <section className={cn("flex min-w-0 flex-col justify-between px-4 py-5 sm:px-10 md:py-8", wide && "mx-auto w-full max-w-6xl")}>
        <header>
          <Link href="/" aria-label={`${APP_NAME}, inicio`} className="inline-flex items-center rounded-adm">
            <BrandLockup />
          </Link>
        </header>

        <div className={cn("w-full py-8 md:py-12", wide ? "max-w-none" : "max-w-[400px]")}>{children}</div>

        <footer className="flex flex-wrap items-center gap-x-4 text-[13px] text-adm-fg-muted">
          <Link href="/" className="inline-flex min-h-11 items-center hover:text-adm-fg hover:underline md:min-h-0">
            Inicio
          </Link>
          <Link href="/planes" className="inline-flex min-h-11 items-center hover:text-adm-fg hover:underline md:min-h-0">
            Planes
          </Link>
          <Link href="/ayuda" className="inline-flex min-h-11 items-center hover:text-adm-fg hover:underline md:min-h-0">
            Ayuda
          </Link>
          <Link href="/contacto" className="inline-flex min-h-11 items-center hover:text-adm-fg hover:underline md:min-h-0">
            Contacto
          </Link>
        </footer>
      </section>

      {twoCol ? (
        <aside className="hidden bg-adm-sidebar-bg text-adm-sidebar-fg md:flex md:flex-col md:justify-center md:px-12 md:py-12 lg:px-16">
          <div className="max-w-[460px]">{aside}</div>
        </aside>
      ) : null}
    </div>
  );
}

/** Contenido estándar de la banda: eyebrow, frase en Archivo y lista corta de datos verificables. */
export function AccountAside({ eyebrow, title, points, children }: { eyebrow?: string; title: ReactNode; points?: ReactNode[]; children?: ReactNode }) {
  return (
    <>
      {eyebrow ? <p className="text-[12px] font-medium tracking-[0.08em] text-adm-accent-2 uppercase">{eyebrow}</p> : null}
      <p className={cn(DISPLAY, "mt-3 text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] text-white")}>{title}</p>
      {points?.length ? (
        <ul className="mt-6 space-y-3 text-[15px] leading-relaxed">
          {points.map((p, i) => (
            <li key={i} className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-adm-accent-2" strokeWidth={1.75} aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </>
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
    <figure aria-label="Ejemplo de un pedido pagado por transferencia" className="mt-8 rounded-adm bg-adm-surface p-4 text-[13px] text-adm-fg">
      <figcaption className="flex items-baseline justify-between gap-3 border-b border-dashed border-adm-input-border pb-2">
        <span className="font-semibold">Pedido #1042</span>
        <span className="text-adm-fg-muted">Transferencia</span>
      </figcaption>
      <dl className="tnum mt-2 space-y-1">
        <div className="flex justify-between gap-3">
          <dt className="text-adm-fg-muted">Paga el cliente</dt>
          <dd>{formatMoney(total)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-adm-fg-muted">Comisión de Ecommy</dt>
          <dd>{formatMoney(0)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-adm-border pt-1.5 font-semibold">
          <dt>Llega a tu cuenta</dt>
          <dd>{formatMoney(total)}</dd>
        </div>
      </dl>
    </figure>
  );
}

/**
 * "Paso 2 de 3 · Tu tienda" con barra de progreso ámbar (BRAND §5.3: el
 * ámbar marca progreso). El registro y el alta de tienda comparten la cuenta
 * de pasos para que el usuario sepa cuánto falta desde el primer campo.
 */
export function FlowProgress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="mb-6">
      <p className="text-[12px] text-adm-fg-muted">
        <span className="tnum font-medium text-adm-fg">
          Paso {step} de {total}
        </span>{" "}
        · {label}
      </p>
      <div
        role="progressbar"
        aria-label="Progreso del alta"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-valuetext={`Paso ${step} de ${total}`}
        className="mt-2 h-1 overflow-hidden rounded-[2px] bg-adm-surface-2"
      >
        <div className="h-full bg-adm-accent-2 transition-[width] duration-[280ms]" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  );
}

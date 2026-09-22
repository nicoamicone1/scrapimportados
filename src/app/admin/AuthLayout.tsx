import Link from "next/link";
import type { ReactNode } from "react";

import { APP_NAME, APP_VERSION, CHANGELOG } from "@/lib/version";

/**
 * Marco de las pantallas sin sesión (login, setup, recuperación): columna de
 * formulario a la izquierda y, en desktop, un panel con información real
 * (novedades de la versión y estado del catálogo). Nada decorativo.
 */
export function AuthLayout({
  storeName,
  aside,
  children,
}: {
  storeName: string;
  /** Línea de dato real en el panel derecho (ej. "699 productos publicados"). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const latest = CHANGELOG[0];
  return (
    <div className="grid min-h-dvh md:grid-cols-[minmax(440px,520px)_1fr]">
      <section className="flex flex-col justify-between border-adm-border bg-adm-surface px-6 py-6 sm:px-10 md:border-r md:py-8">
        <header className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex size-7 items-center justify-center rounded-[4px] border border-adm-border bg-adm-surface-2 text-[13px] font-semibold"
          >
            {storeName.trim().charAt(0).toUpperCase() || "E"}
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{storeName}</div>
            <div className="text-xs text-adm-fg-muted">Panel de administración</div>
          </div>
        </header>

        <div className="w-full max-w-[360px] py-12">{children}</div>

        <footer className="flex items-center gap-3 text-xs text-adm-fg-muted">
          <span className="tnum">
            {APP_NAME} {APP_VERSION}
          </span>
          <span aria-hidden>·</span>
          <Link href="/" className="hover:text-adm-fg hover:underline">
            Ver tienda
          </Link>
        </footer>
      </section>

      <aside className="hidden flex-col justify-end bg-adm-bg px-12 py-10 md:flex">
        <div className="max-w-[460px]">
          <p className="text-xs font-medium tracking-[0.06em] text-adm-fg-muted uppercase">
            Novedades · {APP_NAME} {latest.version}
          </p>
          <p className="mt-2 text-lg leading-snug font-semibold text-adm-fg">{latest.title}</p>
          <ul className="mt-4 space-y-2 border-t border-adm-border pt-4 text-[13px] text-adm-fg-muted">
            {latest.sections.added.slice(0, 5).map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-adm-fg-muted" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {aside ? <p className="tnum mt-6 text-[13px] text-adm-fg">{aside}</p> : null}
        </div>
      </aside>
    </div>
  );
}

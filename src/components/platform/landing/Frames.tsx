import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Marcos de las piezas de producto de la landing (BRAND §8): radio amplio,
 * sombra baja teñida de tinta y, si hace falta, una barra de navegador con
 * la dirección. Adentro va una maqueta en HTML (la tienda de ejemplo,
 * `StoreMock`; el panel, `PanelScenes`) que llena el marco y se corta abajo
 * como una captura: el marco no depende del contenido.
 */

const SHADOW = "shadow-[0_0_0_1px_rgb(16_22_47/0.08),0_40px_80px_-36px_rgb(16_22_47/0.45)]";

export function BrowserFrame({
  children,
  address,
  className,
  ratio = "16 / 10",
  bodyClassName,
}: {
  children: ReactNode;
  /** Lo que se ve en la barra (sin protocolo). */
  address?: string;
  className?: string;
  /** Proporción del área de contenido; con `bodyClassName` (proporción responsive) no se aplica. */
  ratio?: string;
  bodyClassName?: string;
}) {
  return (
    <figure className={cn("overflow-hidden rounded-[24px] bg-eco-paper", SHADOW, className)}>
      <div className="flex h-9 items-center gap-1.5 border-b border-eco-line bg-eco-niebla px-3.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-eco-line" />
        <span className="size-2.5 rounded-full bg-eco-line" />
        {address ? <span className="ml-2 min-w-0 truncate rounded-full bg-eco-paper px-3 py-0.5 text-[11px] text-eco-text-muted">{address}</span> : null}
      </div>
      <div className={cn("relative overflow-hidden", bodyClassName)} style={bodyClassName ? undefined : { aspectRatio: ratio }}>
        {children}
      </div>
    </figure>
  );
}

/** Celular: bisel tinta con esquinas de 36 px y la pantalla adentro (contenido vivo o maqueta). */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[36px] bg-eco-ink p-[7px]", SHADOW, className)}>
      <div className="relative h-full overflow-hidden rounded-[30px] bg-eco-paper">{children}</div>
    </div>
  );
}

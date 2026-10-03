import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import type { Shot } from "./shots";

/*
 * Marcos de las capturas reales (BRAND §8): radio amplio, sombra baja teñida
 * de tinta y, si hace falta, una barra de navegador con la dirección. No
 * dependen del contenido de la captura: la imagen llena el marco con
 * `object-cover` anclada arriba, así que si el panel o la tienda cambian
 * (se regeneran con `scripts/landing-shots.cjs`) el marco sigue igual.
 */

const SHADOW = "shadow-[0_0_0_1px_rgb(16_22_47/0.08),0_40px_80px_-36px_rgb(16_22_47/0.45)]";

export function BrowserFrame({
  shot,
  address,
  sizes,
  preload,
  className,
  ratio = "16 / 10",
}: {
  shot: Shot;
  /** Lo que se ve en la barra (sin protocolo). */
  address?: string;
  sizes: string;
  preload?: boolean;
  className?: string;
  ratio?: string;
}) {
  return (
    <figure className={cn("overflow-hidden rounded-[24px] bg-eco-paper", SHADOW, className)}>
      <div className="flex h-9 items-center gap-1.5 border-b border-eco-line bg-eco-niebla px-3.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-eco-line" />
        <span className="size-2.5 rounded-full bg-eco-line" />
        {address ? <span className="ml-2 min-w-0 truncate rounded-full bg-eco-paper px-3 py-0.5 text-[11px] text-eco-text-muted">{address}</span> : null}
      </div>
      <div className="relative" style={{ aspectRatio: ratio }}>
        <Image
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          sizes={sizes}
          preload={preload}
          className="absolute inset-0 size-full object-cover object-top"
        />
      </div>
    </figure>
  );
}

/** Celular: bisel tinta con esquinas de 36 px y la pantalla adentro (captura o contenido vivo). */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[36px] bg-eco-ink p-[7px]", SHADOW, className)}>
      <div className="relative h-full overflow-hidden rounded-[30px] bg-eco-paper">{children}</div>
    </div>
  );
}

export function PhoneShot({ shot, sizes, className }: { shot: Shot; sizes: string; className?: string }) {
  return (
    <PhoneFrame className={className}>
      <Image src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} sizes={sizes} className="size-full object-cover object-top" />
    </PhoneFrame>
  );
}

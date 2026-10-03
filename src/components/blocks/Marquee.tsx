import { Fragment, type CSSProperties } from "react";

import { SmartLink } from "./Button";
import { MarqueePause } from "./MarqueePause";
import type { BlockProps } from "./types";

/**
 * Marquesina (DESIGN.md §6.12): tira de texto que corre de derecha a
 * izquierda. Se mueve con `motion: soft|lively` (más lenta en `soft`), se
 * pausa al pasar el mouse, con el foco o con su botón (WCAG 2.2.2), y queda
 * quieta y centrada con `motion: none` o `prefers-reduced-motion`.
 * Separador: un punto con la forma chica del tema (cuadrado, redondo, burbuja).
 */
export function Marquee({ block }: BlockProps<"marquee">) {
  const s = block.settings;
  const items = s.items.map((t) => t.trim()).filter(Boolean);
  if (!items.length) return null;
  // Cada mitad del track tiene que ser más ancha que la pantalla para que el loop no deje huecos.
  const minPerGroup = s.size === "lg" ? 4 : 8;
  const repeats = Math.max(1, Math.ceil(minPerGroup / items.length));

  const group = (copy: number) =>
    Array.from({ length: repeats }, (_, r) =>
      items.map((text, i) => (
        <Fragment key={`${copy}-${r}-${i}`}>
          <span
            className="blk-marquee-item"
            aria-hidden={copy > 0 || r > 0 ? true : undefined}
            data-dup={copy > 0 || r > 0 ? "" : undefined}
            data-extra={s.size === "lg" && i > 0 ? "" : undefined}
          >
            {text}
          </span>
          <span aria-hidden className="blk-marquee-sep" data-dup={copy > 0 || r > 0 || i === items.length - 1 ? "" : undefined} />
        </Fragment>
      )),
    );

  const strip = (
    <div className="blk-marquee-viewport">
      <div className="blk-marquee-track" style={{ "--blk-mq-dur": `${(s.speed === "slow" ? 7 : 4.5) * items.length * repeats}s` } as CSSProperties}>
        <p className="blk-marquee-group">{group(0)}</p>
        <p className="blk-marquee-group" aria-hidden data-dup="">
          {group(1)}
        </p>
      </div>
    </div>
  );

  return (
    <div className="blk-marquee" data-size={s.size} data-speed={s.speed}>
      {s.href ? (
        <SmartLink href={s.href} className="blk-marquee-link">
          {strip}
        </SmartLink>
      ) : (
        strip
      )}
      <MarqueePause />
    </div>
  );
}

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Tabla chica de un artículo. Va envuelta en un contenedor con scroll
 * horizontal propio: a 360 px la tabla se desliza y la página no. Las de
 * dos columnas se acomodan al ancho; las de tres o más guardan un mínimo.
 * La primera columna va en semibold: es la que se busca con la vista.
 */
export function ArticleTable({ head, rows, caption }: { head: ReactNode[]; rows: ReactNode[][]; caption?: string }) {
  return (
    <div className="my-6 overflow-x-auto rounded-eco-lg border border-eco-line bg-adm-surface" tabIndex={head.length > 2 ? 0 : undefined} role={head.length > 2 ? "region" : undefined} aria-label={head.length > 2 ? (caption ?? "Tabla") : undefined}>
      <table className={cn("w-full border-collapse text-left text-[14px] leading-snug", head.length > 2 && "min-w-[520px]")}>
        {caption ? <caption className="border-b border-eco-line px-4 py-3 text-left text-[13px] text-adm-fg-muted">{caption}</caption> : null}
        <thead className="bg-eco-niebla-2 text-[12px] tracking-[0.04em] text-adm-fg-muted uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-eco-line">
              {row.map((cell, c) => (
                <td key={c} className={cn("px-4 py-3 align-top [&_code]:text-[12px]", c === 0 && "font-semibold")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

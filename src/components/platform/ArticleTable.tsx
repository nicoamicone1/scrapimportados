import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Tabla chica de un artículo. Va envuelta en un contenedor con scroll
 * horizontal propio: a 360 px la tabla se desliza y la página no. Las de
 * dos columnas se acomodan al ancho; las de tres o más guardan un mínimo.
 */
export function ArticleTable({ head, rows, caption }: { head: ReactNode[]; rows: ReactNode[][]; caption?: string }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-adm border border-adm-border bg-adm-surface">
      <table className={cn("w-full border-collapse text-left text-[14px] leading-snug", head.length > 2 && "min-w-[520px]")}>
        {caption ? <caption className="border-b border-adm-border px-3 py-2 text-left text-[13px] text-adm-fg-muted">{caption}</caption> : null}
        <thead className="bg-adm-table-head text-[12px] text-adm-fg-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="border-b border-adm-border px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-adm-border last:border-b-0">
              {row.map((cell, c) => (
                <td key={c} className="px-3 py-2 align-top [&_code]:text-[12px]">
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

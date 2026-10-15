import { cn } from "@/lib/cn";

import { SOURCES, VERDICT_LABEL, type CompareGroup, type SourceId, type Verdict } from "./content";

/*
 * Ecommy y Tiendanube punto por punto. En la computadora es una tabla de
 * tres columnas; en el celular cada fila se apila como una tarjeta (sin
 * scroll horizontal). Los roles van explícitos porque `display: block`
 * le saca la semántica de tabla a algunos lectores de pantalla.
 */

const VERDICT_TONE: Record<Verdict, string> = {
  ecommy: "bg-eco-pomelo-soft text-eco-pomelo-ink",
  paridad: "bg-eco-niebla-2 text-eco-text-muted",
  tiendanube: "bg-eco-azul-soft text-eco-azul-dark",
};

/** Orden de las fuentes como aparecen en la tabla (para numerarlas). */
export function sourceOrder(groups: readonly CompareGroup[]): SourceId[] {
  const seen: SourceId[] = [];
  for (const g of groups) for (const r of g.rows) for (const s of r.sources) if (!seen.includes(s)) seen.push(s);
  return seen;
}

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11.5px] font-semibold whitespace-nowrap", VERDICT_TONE[verdict])}>
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export function CompareTable({ groups, caption, captionId }: { groups: readonly CompareGroup[]; caption: string; captionId: string }) {
  const order = sourceOrder(groups);
  return (
    <table role="table" aria-labelledby={captionId} className="w-full border-collapse text-left max-md:block">
      <caption id={captionId} className="sr-only">
        {caption}
      </caption>
      <thead role="rowgroup" className="max-md:sr-only">
        <tr role="row" className="text-[12px] tracking-[0.06em] text-adm-fg-muted uppercase">
          <th role="columnheader" scope="col" className="w-[24%] px-4 pb-3 font-semibold">
            Tema
          </th>
          <th role="columnheader" scope="col" className="w-[38%] px-4 pb-3 font-semibold">
            Ecommy
          </th>
          <th role="columnheader" scope="col" className="w-[38%] px-4 pb-3 font-semibold">
            Tiendanube
          </th>
        </tr>
      </thead>
      {groups.map((g) => (
        <tbody key={g.title} role="rowgroup" className="max-md:block">
          <tr role="row" className="max-md:block">
            <th
              role="columnheader"
              scope="colgroup"
              colSpan={3}
              className="eco-display px-4 pt-10 pb-3 text-[20px] leading-tight text-eco-ink max-md:block max-md:px-0 max-md:pt-8 sm:text-[22px]"
            >
              {g.title}
            </th>
          </tr>
          {g.rows.map((r) => (
            <tr
              key={r.topic}
              role="row"
              className="border-t border-eco-line align-top max-md:mb-3 max-md:block max-md:rounded-[20px] max-md:border-0 max-md:bg-eco-paper max-md:p-4 max-md:shadow-[0_0_0_1px_var(--eco-line)]"
            >
              <th role="rowheader" scope="row" className="px-4 py-4 font-normal max-md:block max-md:p-0">
                <span className="block text-[15px] leading-snug font-semibold text-eco-ink">{r.topic}</span>
                <span className="mt-2 block">
                  <VerdictPill verdict={r.verdict} />
                </span>
              </th>
              <td role="cell" className="px-4 py-4 text-[15px] leading-relaxed text-eco-ink max-md:block max-md:px-0 max-md:pt-3 max-md:pb-0">
                <span className="block text-[11px] font-semibold tracking-[0.08em] text-eco-pomelo-ink uppercase md:hidden">Ecommy</span>
                {r.ecommy}
              </td>
              <td role="cell" className="px-4 py-4 text-[15px] leading-relaxed text-eco-text-muted max-md:block max-md:px-0 max-md:pt-3 max-md:pb-0">
                <span className="block text-[11px] font-semibold tracking-[0.08em] text-eco-azul-dark uppercase md:hidden">Tiendanube</span>
                {r.tiendanube}{" "}
                <span className="text-[12px] whitespace-nowrap">
                  {r.sources.map((s, i) => {
                    const n = order.indexOf(s) + 1;
                    return (
                      <a
                        key={s}
                        href={`#fuente-${s}`}
                        aria-label={`Fuente ${n}: ${SOURCES[s].label}`}
                        className="text-adm-link underline decoration-1 underline-offset-2 hover:text-adm-link-hover"
                      >
                        {i === 0 ? "Fuente " : ""}
                        {n}
                        {i < r.sources.length - 1 ? ", " : ""}
                      </a>
                    );
                  })}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

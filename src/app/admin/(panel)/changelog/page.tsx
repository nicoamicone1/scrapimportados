import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";

import { MarkChangelogSeen } from "@/components/admin/VersionBadge";
import { PageHeader } from "@/components/ui/display";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/dates";
import { APP_NAME, APP_VERSION, CHANGELOG, type ChangelogEntry } from "@/lib/version";

export const metadata: Metadata = { title: "Novedades" };

const SECTION_LABELS = { added: "Agregado", changed: "Cambiado", fixed: "Corregido" } as const;
type SectionKey = keyof typeof SECTION_LABELS;

/** Punto de cada tipo de cambio: pomelo lo nuevo, tinta lo cambiado, azul lo corregido. */
const SECTION_DOT: Record<SectionKey, string> = {
  added: "bg-eco-pomelo",
  changed: "bg-adm-fg",
  fixed: "bg-adm-link",
};

function EntryDate({ date }: { date: string }) {
  return <time dateTime={date}>{formatDateShort(`${date}T12:00:00`)}</time>;
}

function Sections({ entry }: { entry: ChangelogEntry }) {
  const keys = (Object.keys(SECTION_LABELS) as SectionKey[]).filter((k) => entry.sections[k].length);
  if (!keys.length) return <p className="text-sm text-adm-fg-muted">Sin cambios registrados.</p>;
  return (
    <div className="space-y-5">
      {keys.map((key) => (
        <section key={key}>
          <h3 className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-adm-fg-muted uppercase">
            <span aria-hidden className={cn("size-2 rounded-full", SECTION_DOT[key])} />
            {SECTION_LABELS[key]}
            <span className="tnum font-normal normal-case">({entry.sections[key].length})</span>
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {entry.sections[key].map((line) => (
              <li key={line} className="flex gap-2.5">
                <span aria-hidden className="mt-[9px] h-px w-2.5 shrink-0 bg-adm-input-border" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Novedades como línea de tiempo (lee `CHANGELOG` de src/lib/version.ts,
 * fuente única): la versión actual es la burbuja abierta arriba; las
 * anteriores, nodos sobre la línea que se despliegan.
 */
export default function ChangelogPage() {
  const current = CHANGELOG.find((e) => e.version === APP_VERSION) ?? CHANGELOG[0];
  const previous = CHANGELOG.filter((e) => e !== current);

  return (
    <>
      <MarkChangelogSeen />
      <PageHeader title="Novedades" description={`Estás usando ${APP_NAME} ${APP_VERSION}. Acá están las novedades de cada versión.`} />
      <ol className="relative max-w-3xl" aria-label="Versiones">
        {/* La línea del tiempo. */}
        <span aria-hidden className="absolute top-3 bottom-3 left-[11px] w-0.5 rounded-full bg-adm-border" />

        {current ? (
          <li className="relative pb-8 pl-10">
            <span aria-hidden className="absolute top-1 left-0 inline-flex size-6 items-center justify-center rounded-full bg-eco-pomelo ring-4 ring-adm-bg">
              <span className="size-2 rounded-full bg-adm-fg" />
            </span>
            <article className="eco-bubble border border-adm-border bg-adm-surface p-5 shadow-adm-card [--eco-bubble-r:24px] md:p-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h2 className="eco-display text-[28px] leading-8 text-adm-fg">v{current.version}</h2>
                <span className="inline-flex h-6 items-center rounded-full bg-adm-accent-2-soft px-2.5 text-xs font-semibold text-adm-accent-2-ink">
                  Versión actual
                </span>
                <span className="text-[13px] text-adm-fg-muted">
                  <EntryDate date={current.date} />
                </span>
              </div>
              <p className="mt-2 text-[15px] font-medium text-adm-fg">{current.title}</p>
              <div className="mt-5 border-t border-adm-border pt-5">
                <Sections entry={current} />
              </div>
            </article>
          </li>
        ) : null}

        {previous.map((entry) => (
          <li key={entry.version} className="relative pb-2 pl-10">
            <span aria-hidden className="absolute top-3.5 left-[5px] size-3.5 rounded-full border-2 border-adm-input-border bg-adm-surface ring-4 ring-adm-bg" />
            <details className="group rounded-adm-lg transition-colors duration-[140ms] ease-eco-out open:border open:border-adm-border open:bg-adm-surface open:shadow-adm-card">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-0.5 rounded-adm-lg px-3 py-2.5 max-sm:min-h-11 hover:bg-adm-surface group-open:hover:bg-transparent [&::-webkit-details-marker]:hidden">
                <span className="eco-num text-[15px] text-adm-fg">v{entry.version}</span>
                <span className="text-[13px] text-adm-fg-muted">
                  <EntryDate date={entry.date} />
                </span>
                <span className="order-last w-full min-w-0 text-[13px] text-adm-fg sm:order-none sm:w-auto sm:flex-1 sm:truncate">{entry.title}</span>
                <ChevronRight
                  className="ml-auto size-4 shrink-0 text-adm-fg-muted transition-transform duration-[140ms] ease-eco-out group-open:rotate-90"
                  aria-hidden
                />
              </summary>
              <div className="px-3 pt-1 pb-4">
                <Sections entry={entry} />
              </div>
            </details>
          </li>
        ))}
      </ol>
    </>
  );
}

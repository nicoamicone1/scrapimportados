import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";

import { MarkChangelogSeen } from "@/components/admin/VersionBadge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/display";
import { formatDateShort } from "@/lib/dates";
import { APP_NAME, APP_VERSION, CHANGELOG, type ChangelogEntry } from "@/lib/version";

export const metadata: Metadata = { title: "Changelog" };

const SECTION_LABELS = { added: "Agregado", changed: "Cambiado", fixed: "Corregido" } as const;
type SectionKey = keyof typeof SECTION_LABELS;

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
          <h3 className="flex items-center gap-2 text-xs font-medium tracking-[0.06em] text-adm-fg-muted uppercase">
            {SECTION_LABELS[key]}
            <span className="tnum font-normal normal-case">({entry.sections[key].length})</span>
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {entry.sections[key].map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="mt-[8px] size-1 shrink-0 rounded-full bg-adm-fg-muted" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Lee `CHANGELOG` de src/lib/version.ts (fuente única). */
export default function ChangelogPage() {
  const current = CHANGELOG.find((e) => e.version === APP_VERSION) ?? CHANGELOG[0];
  const previous = CHANGELOG.filter((e) => e !== current);

  return (
    <>
      <MarkChangelogSeen />
      <PageHeader title="Changelog" description={`Estás usando ${APP_NAME} ${APP_VERSION}. Acá están las novedades de cada versión.`} />
      <div className="max-w-3xl space-y-6">
        {current ? (
          <Card className="p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h2 className="tnum text-xl font-semibold">v{current.version}</h2>
              <Badge tone="accent">Versión actual</Badge>
              <span className="text-[13px] text-adm-fg-muted">
                <EntryDate date={current.date} />
              </span>
            </div>
            <p className="mt-1 text-[15px] text-adm-fg">{current.title}</p>
            <div className="mt-5 border-t border-adm-border pt-5">
              <Sections entry={current} />
            </div>
          </Card>
        ) : null}

        {previous.length ? (
          <section>
            <h2 className="mb-2 text-xs font-medium tracking-[0.06em] text-adm-fg-muted uppercase">Versiones anteriores</h2>
            <Card>
              <ul className="divide-y divide-adm-border">
                {previous.map((entry) => (
                  <li key={entry.version}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-adm-hover [&::-webkit-details-marker]:hidden">
                        <ChevronRight className="size-4 shrink-0 text-adm-fg-muted transition-transform duration-100 group-open:rotate-90" aria-hidden />
                        <span className="tnum text-sm font-medium">v{entry.version}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-adm-fg-muted">{entry.title}</span>
                        <span className="text-[13px] text-adm-fg-muted">
                          <EntryDate date={entry.date} />
                        </span>
                      </summary>
                      <div className="px-4 pt-1 pb-4 pl-11">
                        <Sections entry={entry} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}
      </div>
    </>
  );
}

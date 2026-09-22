"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";

import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { AuditRow } from "@/lib/admin/audit";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/dates";

export function AuditTable({ rows, timeZone, filtered }: { rows: AuditRow[]; timeZone: string; filtered: boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Table>
      <THead>
        <tr>
          <TH className="w-8">
            <span className="sr-only">Detalle</span>
          </TH>
          <TH>Fecha</TH>
          <TH>Usuario</TH>
          <TH>Acción</TH>
          <TH>Entidad</TH>
          <TH>Resumen</TH>
        </tr>
      </THead>
      <TBody>
        {rows.length === 0 ? (
          <TableEmpty
            colSpan={6}
            title={filtered ? "No hay registros con estos filtros." : "Todavía no hay registros"}
            description={filtered ? undefined : "Cada cambio que se haga en el panel (productos, pedidos, configuración, usuarios) va a quedar anotado acá."}
          />
        ) : (
          rows.map((r) => {
            const expanded = open.has(r.id);
            const hasDetail = r.lines.length > 0;
            return (
              <Fragment key={r.id}>
                <TR
                  className={cn(hasDetail && "cursor-pointer")}
                  onClick={hasDetail ? () => toggle(r.id) : undefined}
                  aria-expanded={hasDetail ? expanded : undefined}
                >
                  <TD className="pr-0">
                    {hasDetail ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(r.id);
                        }}
                        aria-label={expanded ? "Ocultar detalle" : "Ver detalle"}
                        aria-expanded={expanded}
                        className="inline-flex size-6 items-center justify-center rounded-[4px] text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg"
                      >
                        <ChevronRight className={cn("size-4 transition-transform duration-100", expanded && "rotate-90")} aria-hidden />
                      </button>
                    ) : null}
                  </TD>
                  <TD muted className="whitespace-nowrap">
                    <time suppressHydrationWarning dateTime={r.created_at} title={formatDateTime(r.created_at, timeZone)}>
                      {formatRelative(r.created_at)}
                    </time>
                  </TD>
                  <TD className="max-w-[200px] truncate" title={r.actor_email ?? undefined}>
                    {r.actor_email ?? <span className="text-adm-fg-muted">Sistema</span>}
                  </TD>
                  <TD className="font-mono text-xs whitespace-nowrap">{r.action}</TD>
                  <TD className="whitespace-nowrap">
                    {r.entity ? (
                      r.href ? (
                        <Link
                          href={r.href}
                          onClick={(e) => e.stopPropagation()}
                          className="text-adm-accent underline-offset-2 hover:underline"
                          title={r.entity_id ?? undefined}
                        >
                          {r.entity}
                          {r.entity_id && r.entity_id.length <= 12 ? ` ${r.entity_id}` : ""}
                        </Link>
                      ) : (
                        <span title={r.entity_id ?? undefined}>{r.entity}</span>
                      )
                    ) : (
                      <span className="text-adm-fg-muted">—</span>
                    )}
                  </TD>
                  <TD className="max-w-[420px] truncate" title={r.summary ?? undefined}>
                    {r.summary ?? <span className="text-adm-fg-muted">—</span>}
                  </TD>
                </TR>
                {expanded ? (
                  <tr className="bg-adm-surface-2/60">
                    <td colSpan={6} className="border-b border-adm-border px-4 py-3">
                      <dl className="grid gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-[minmax(140px,max-content)_1fr]">
                        {r.lines.map((l) => (
                          <Fragment key={l.field}>
                            <dt className="font-mono text-xs text-adm-fg-muted">{l.field}</dt>
                            <dd className="min-w-0 break-words">
                              {l.before ? (
                                <>
                                  <span className="text-adm-fg-muted line-through decoration-adm-fg-muted/50">{l.before}</span>
                                  <span aria-label="pasó a" className="mx-1.5 text-adm-fg-muted">
                                    →
                                  </span>
                                </>
                              ) : null}
                              <span>{l.after}</span>
                            </dd>
                          </Fragment>
                        ))}
                      </dl>
                      <p className="mt-2 text-xs text-adm-fg-muted">
                        {formatDateTime(r.created_at, timeZone)}
                        {r.entity_id ? ` · ID ${r.entity_id}` : ""}
                      </p>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })
        )}
      </TBody>
    </Table>
  );
}

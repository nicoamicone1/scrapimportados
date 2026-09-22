"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, Checkbox, SearchInput, Table, TableEmpty, TBody, TD, TH, THead, TR, toast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";
import { ITEM_STATUS_LABELS, type ItemRow, type ItemStatus } from "@/lib/scraper/job";

import { ItemStatusBadge } from "./JobStatusBadge";

type Filter = ItemStatus | "all";

interface ItemsResponse {
  ok: true;
  rows: ItemRow[];
  total: number;
  counts: Record<Filter, number>;
  page: number;
  perPage: number;
}

const PER_PAGE = 50;
const FILTERS: Filter[] = ["all", "pending", "imported", "updated", "skipped", "error"];

const FIELD_LABELS: Record<string, string> = {
  price: "Precio",
  compare_at_price: "Tachado",
  cost: "Costo",
  stock: "Stock",
  status: "Estado",
};

const STATUS_WORDS: Record<string, string> = { draft: "Borrador", active: "Activo", archived: "Archivado" };

function fmtValue(field: string, v: number | string | null): string {
  if (v === null) return "—";
  if (field === "stock") return formatNumber(Number(v));
  if (field === "status") return STATUS_WORDS[String(v)] ?? String(v);
  return formatMoney(Number(v));
}

/**
 * Ítems de un job: filtro por estado, búsqueda y paginación resueltos en el
 * server (`/api/import/[jobId]/items`). En modo revisión suma checkboxes.
 */
export function JobItemsTable({
  jobId,
  refreshKey,
  reviewing,
  onImportSelected,
}: {
  jobId: string;
  /** Cambia cuando el job avanza: dispara una recarga. */
  refreshKey: string;
  reviewing: boolean;
  onImportSelected: (input: { itemIds: string[]; all: boolean }) => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>(reviewing ? "pending" : "all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ItemsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Debounce de la búsqueda.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ estado: filter, page: String(page), per: String(PER_PAGE) });
    if (query.trim()) params.set("q", query.trim());
    fetch(`/api/import/${jobId}/items?${params}`)
      .then((r) => r.json() as Promise<ItemsResponse | { ok: false; error: string }>)
      .then((d) => {
        if (!alive) return;
        if (d.ok) setData(d);
        else toast.error(d.error);
      })
      .catch(() => {
        if (alive) toast.error("No pudimos cargar los productos del job.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [jobId, filter, query, page, refreshKey]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const pendingOnPage = rows.filter((r) => r.status === "pending");
  const allOnPageSelected = pendingOnPage.length > 0 && pendingOnPage.every((r) => selected.has(r.id));
  const counts = data?.counts;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const showPrice = rows.some((r) => r.price !== null);
  const showChanges = rows.some((r) => r.changes.length > 0 || r.line !== null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async (all: boolean) => {
    setSubmitting(true);
    try {
      await onImportSelected({ itemIds: [...selected], all });
      setSelected(new Set());
    } finally {
      setSubmitting(false);
    }
  };

  const colSpan = 6 + (reviewing ? 1 : 0);

  return (
    <div className="space-y-3">
      <nav aria-label="Filtrar por estado" className="flex gap-5 overflow-x-auto border-b border-adm-border">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setPage(1);
              setLoading(true);
            }}
            aria-current={filter === f ? "true" : undefined}
            className={cn(
              "relative -mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-0.5 text-sm whitespace-nowrap transition-colors",
              filter === f
                ? "border-adm-accent font-medium text-adm-fg"
                : "border-transparent text-adm-fg-muted hover:border-adm-border hover:text-adm-fg",
            )}
          >
            {f === "all" ? "Todos" : ITEM_STATUS_LABELS[f]}
            {counts ? <span className="tnum rounded-[4px] bg-adm-surface-2 px-1 text-xs text-adm-fg-muted">{formatNumber(counts[f])}</span> : null}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o ID de origen" className="w-full sm:w-[280px]" aria-label="Buscar ítems" />
        {reviewing ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-adm-fg-muted">{formatNumber(selected.size)} seleccionados</span>
            <Button onClick={() => submit(false)} disabled={!selected.size} loading={submitting}>
              Importar seleccionados
            </Button>
            <Button variant="primary" onClick={() => submit(true)} disabled={!counts?.pending} loading={submitting}>
              Importar todos los pendientes ({formatNumber(counts?.pending ?? 0)})
            </Button>
          </div>
        ) : null}
      </div>

      <Table containerClassName="max-h-[640px]">
        <THead>
          <tr>
            {reviewing ? (
              <TH className="w-9">
                <Checkbox
                  aria-label="Seleccionar los pendientes de esta página"
                  checked={allOnPageSelected}
                  disabled={!pendingOnPage.length}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const r of pendingOnPage) {
                        if (allOnPageSelected) next.delete(r.id);
                        else next.add(r.id);
                      }
                      return next;
                    })
                  }
                />
              </TH>
            ) : null}
            <TH>Producto</TH>
            <TH>{showChanges ? "Cambios" : "Detalle"}</TH>
            <TH numeric>{showPrice ? "Precio final" : ""}</TH>
            <TH>Estado</TH>
            <TH>Motivo</TH>
            <TH className="w-10">
              <span className="sr-only">Abrir</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {loading && !data ? (
            <TableEmpty colSpan={colSpan} title="Cargando…" />
          ) : rows.length === 0 ? (
            <TableEmpty
              colSpan={colSpan}
              title={query || filter !== "all" ? "No hay ítems con estos filtros." : "Todavía no hay ítems"}
              description={query || filter !== "all" ? undefined : "Aparecen a medida que se lee el catálogo de origen."}
            />
          ) : (
            rows.map((r) => (
              <TR key={r.id} selected={selected.has(r.id)}>
                {reviewing ? (
                  <TD>
                    <Checkbox
                      aria-label={`Seleccionar ${r.name ?? "ítem"}`}
                      checked={selected.has(r.id)}
                      disabled={r.status !== "pending"}
                      onChange={() => toggle(r.id)}
                    />
                  </TD>
                ) : null}
                <TD className="max-w-[340px]">
                  <div className="flex items-center gap-2.5">
                    {r.image ? (
                      // Miniatura remota del origen (vista previa, dominio arbitrario).
                      // eslint-disable-next-line @next/next/no-img-element -- dominio arbitrario del origen
                      <img src={r.image} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-8 shrink-0 rounded-[4px] border border-adm-border object-cover" />
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-adm-fg">{r.name ?? "Sin nombre"}</p>
                      <p className="truncate font-mono text-xs text-adm-fg-muted">
                        {r.line !== null ? `Fila ${r.line}` : r.external_id}
                      </p>
                    </div>
                  </div>
                </TD>
                <TD className="max-w-[360px] text-adm-fg-muted">
                  {r.changes.length ? (
                    <ul className="space-y-0.5">
                      {r.changes.map((c) => (
                        <li key={c.field} className="tnum whitespace-nowrap">
                          <span className="text-adm-fg-muted">{FIELD_LABELS[c.field] ?? c.field}: </span>
                          <span className="text-adm-fg-muted line-through decoration-adm-fg-muted/60">{fmtValue(c.field, c.from)}</span>
                          <span aria-hidden> → </span>
                          <span className="sr-only"> pasa a </span>
                          <span className="font-medium text-adm-fg">{fmtValue(c.field, c.to)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="line-clamp-2">{r.summary || "—"}</span>
                  )}
                </TD>
                <TD numeric>{r.price !== null ? formatMoney(r.price) : ""}</TD>
                <TD>
                  <ItemStatusBadge status={r.status} />
                </TD>
                <TD className={cn("max-w-[260px] text-xs", r.status === "error" ? "text-adm-danger" : "text-adm-fg-muted")}>
                  <span className="line-clamp-2" title={r.error ?? undefined}>
                    {r.error ?? ""}
                  </span>
                </TD>
                <TD>
                  {r.product_id ? (
                    <Link
                      href={`/admin/productos/${r.product_id}`}
                      className="inline-flex size-7 items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg"
                      aria-label={`Abrir ${r.name ?? "producto"}`}
                      title="Abrir el producto"
                    >
                      <ExternalLink className="size-4" aria-hidden />
                    </Link>
                  ) : null}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <div className="flex items-center justify-between gap-4 py-1">
        <p className="tnum text-[13px] text-adm-fg-muted">
          {total === 0
            ? "0 ítems"
            : `${formatNumber((page - 1) * PER_PAGE + 1)}–${formatNumber(Math.min(page * PER_PAGE, total))} de ${formatNumber(total)}`}
        </p>
        <div className="flex gap-2">
          <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <Button size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

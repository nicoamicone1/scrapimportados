import type { Metadata } from "next";
import Link from "next/link";

import { JobRowActions } from "@/components/admin/import/JobRowActions";
import { JobStatusBadge } from "@/components/admin/import/JobStatusBadge";
import { NewImportPanel } from "@/components/admin/import/NewImportPanel";
import { PageHeader, Pagination, Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import { jobTitle } from "@/lib/scraper/job";
import { listJobs } from "@/lib/scraper/queries";
import { ADAPTER_LABELS, type AdapterId } from "@/lib/scraper/types";

export const metadata: Metadata = { title: "Importar" };

const PER_PAGE = 20;

function duration(from: string | null, to: string | null): string {
  if (!from || !to) return "—";
  const secs = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  if (secs < 60) return `${secs} s`;
  const m = Math.floor(secs / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export default async function ImportarPage({ searchParams }: PageProps<"/admin/importar">) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);

  const [jobs, cats] = await Promise.all([
    listJobs(ctx.supabase, page, PER_PAGE),
    ctx.supabase.from("categories").select("id, name").order("name"),
  ]);
  const categories = (cats.data ?? []).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader
        title="Importar"
        description="Traé productos desde otra tienda online (WooCommerce, Shopify o cualquier sitio con datos estructurados) o desde una planilla CSV."
      />

      <p className="mb-4 max-w-3xl rounded-adm border border-adm-border bg-adm-surface-2 px-3 py-2 text-[13px] text-adm-fg">
        Importá sólo catálogos que tengas permiso de usar: el tuyo, el de tu proveedor o uno que te hayan autorizado. Textos e
        imágenes de terceros pueden tener derechos de autor.
      </p>

      <NewImportPanel categories={categories} />

      <section className="mt-8" aria-labelledby="historial">
        <h2 id="historial" className="mb-3 text-base font-semibold text-adm-fg">
          Historial
        </h2>
        <Table>
          <THead>
            <tr>
              <TH>Fecha</TH>
              <TH>Fuente</TH>
              <TH>Estado</TH>
              <TH numeric>Encontrados</TH>
              <TH numeric>Creados</TH>
              <TH numeric>Actualizados</TH>
              <TH numeric>Omitidos</TH>
              <TH numeric>Errores</TH>
              <TH numeric>Duración</TH>
              <TH>Usuario</TH>
              <TH className="w-10">
                <span className="sr-only">Acciones</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {jobs.rows.length === 0 ? (
              <TableEmpty
                colSpan={11}
                title="Todavía no importaste nada"
                description="Pegá arriba la dirección de una tienda y tocá “Detectar” para ver qué se puede traer, o subí un CSV con tu lista de precios."
              />
            ) : (
              jobs.rows.map((j) => (
                <TR key={j.id}>
                  <TD className="whitespace-nowrap text-adm-fg-muted">
                    <span title={formatDateTime(j.created_at)}>{formatRelative(j.created_at)}</span>
                  </TD>
                  <TD className="max-w-[280px]">
                    <Link href={`/admin/importar/${j.id}`} className="block truncate font-medium text-adm-fg hover:underline">
                      {jobTitle(j)}
                    </Link>
                    <span className="text-xs text-adm-fg-muted">
                      {ADAPTER_LABELS[j.adapter as AdapterId] ?? j.adapter}
                      {j.csv ? ` · ${j.csv.mode === "update" ? "por SKU" : "crear"}` : ""}
                    </span>
                  </TD>
                  <TD>
                    <JobStatusBadge status={j.status} phase={j.phase} finishedAt={j.finished_at} />
                  </TD>
                  <TD numeric>{formatNumber(j.stats.found)}</TD>
                  <TD numeric>{formatNumber(j.stats.created)}</TD>
                  <TD numeric>{formatNumber(j.stats.updated)}</TD>
                  <TD numeric>{formatNumber(j.stats.skipped)}</TD>
                  <TD numeric className={j.stats.errors ? "text-adm-danger" : undefined}>
                    {formatNumber(j.stats.errors)}
                  </TD>
                  <TD numeric muted>
                    {duration(j.started_at, j.finished_at)}
                  </TD>
                  <TD muted className="max-w-[160px] truncate">
                    {j.created_by_email ?? "—"}
                  </TD>
                  <TD>
                    <JobRowActions jobId={j.id} canResync={j.status === "done" && j.adapter !== "csv"} />
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
        {jobs.total > PER_PAGE ? <Pagination page={page} perPage={PER_PAGE} total={jobs.total} /> : null}
      </section>
    </>
  );
}

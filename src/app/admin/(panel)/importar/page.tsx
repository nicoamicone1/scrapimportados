import type { Metadata } from "next";
import Link from "next/link";

import { JobRowActions } from "@/components/admin/import/JobRowActions";
import { JobStatusBadge } from "@/components/admin/import/JobStatusBadge";
import { NewImportPanel } from "@/components/admin/import/NewImportPanel";
import { LimitBanner } from "@/components/admin/LimitBanner";
import { PageHeader, Pagination, Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import { limitOf } from "@/lib/plans";
import { countUsage } from "@/lib/plans/server";
import { jobTitle } from "@/lib/scraper/job";
import { listJobs } from "@/lib/scraper/queries";
import { ADAPTER_LABELS, type AdapterId } from "@/lib/scraper/types";

export const metadata: Metadata = { title: "Importar" };

const PER_PAGE = 20;
const EMPTY_TITLE = "Todavía no importaste nada";
const EMPTY_DESCRIPTION =
  "Pegá arriba la dirección de una tienda y tocá «Detectar» para ver qué se puede traer, o subí un CSV con tu lista de precios.";

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

  const [jobs, cats, jobsThisMonth, productsCount] = await Promise.all([
    listJobs(ctx, page, PER_PAGE),
    ctx.supabase.from("categories").select("id, name").eq("store_id", ctx.store.id).order("name"),
    countUsage(ctx, "import_jobs_month"),
    countUsage(ctx, "products"),
  ]);
  const categories = (cats.data ?? []).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader
        title="Importar"
        description="Traé tu catálogo de otra tienda online, o actualizá precios y stock con la lista de tu proveedor en una planilla CSV."
      />

      {/* Con límite 0 (Free) ya bloquea el PlanGate de cada modo: el aviso sobra. */}
      {limitOf(ctx.plan, "import_jobs_month") ? (
        <LimitBanner limit="import_jobs_month" used={jobsThisMonth} className="mb-3" />
      ) : null}
      {/* Con productos cargados, lo habitual es actualizar precios por SKU; sin productos, traer un catálogo. */}
      <NewImportPanel categories={categories} hasProducts={productsCount > 0} />
      <p className="mt-3 max-w-3xl text-xs text-adm-fg-muted">
        Importá sólo catálogos que tengas permiso de usar: el tuyo, el de tu proveedor o uno que te hayan autorizado. Textos e
        imágenes de terceros pueden tener derechos de autor.
      </p>

      <section className="mt-8" aria-labelledby="historial">
        <h2 id="historial" className="mb-3 text-base font-semibold text-adm-fg">
          Historial
        </h2>
        {/* Mobile: una línea por importación con lo que pasó. */}
        <div className="rounded-adm-lg border border-adm-border bg-adm-surface md:hidden">
          {jobs.rows.length === 0 ? (
            <div className="px-4 py-6">
              <p className="text-[15px] font-semibold text-adm-fg">{EMPTY_TITLE}</p>
              <p className="mt-1 text-[13px] text-adm-fg-muted">{EMPTY_DESCRIPTION}</p>
            </div>
          ) : (
            <ul>
              {jobs.rows.map((j) => (
                <li key={j.id} className="flex items-start border-b border-adm-border last:border-b-0">
                  <Link href={`/admin/importar/${j.id}`} className="block min-h-14 min-w-0 flex-1 px-4 py-3">
                    <span className="block truncate text-sm font-medium text-adm-fg">{jobTitle(j)}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-adm-fg-muted">
                      <JobStatusBadge status={j.status} phase={j.phase} finishedAt={j.finished_at} />
                      <span className="tnum">
                        {formatNumber(j.stats.created)} creados · {formatNumber(j.stats.updated)} actualizados
                        {j.stats.errors ? ` · ${formatNumber(j.stats.errors)} con error` : ""}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-adm-fg-muted">
                      {ADAPTER_LABELS[j.adapter as AdapterId] ?? j.adapter} · <span title={formatDateTime(j.created_at)}>{formatRelative(j.created_at)}</span>
                    </span>
                  </Link>
                  <div className="flex h-14 w-12 shrink-0 items-center justify-center">
                    <JobRowActions jobId={j.id} canResync={j.status === "done" && j.adapter !== "csv"} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Table containerClassName="hidden md:block">
          <THead>
            <tr>
              <TH>Fecha</TH>
              <TH>Fuente</TH>
              <TH>Estado</TH>
              <TH numeric className="hidden xl:table-cell">
                Encontrados
              </TH>
              <TH numeric>Creados</TH>
              <TH numeric>Actualizados</TH>
              <TH numeric className="hidden xl:table-cell">
                Omitidos
              </TH>
              <TH numeric>Errores</TH>
              <TH numeric className="hidden xl:table-cell">
                Duración
              </TH>
              <TH className="hidden 2xl:table-cell">Usuario</TH>
              <TH className="w-10">
                <span className="sr-only">Acciones</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {jobs.rows.length === 0 ? (
              <TableEmpty
                colSpan={11}
                title={EMPTY_TITLE}
                description={EMPTY_DESCRIPTION}
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
                  <TD numeric className="hidden xl:table-cell">
                    {formatNumber(j.stats.found)}
                  </TD>
                  <TD numeric>{formatNumber(j.stats.created)}</TD>
                  <TD numeric>{formatNumber(j.stats.updated)}</TD>
                  <TD numeric className="hidden xl:table-cell">
                    {formatNumber(j.stats.skipped)}
                  </TD>
                  <TD numeric className={j.stats.errors ? "text-adm-danger" : undefined}>
                    {formatNumber(j.stats.errors)}
                  </TD>
                  <TD numeric muted className="hidden xl:table-cell">
                    {duration(j.started_at, j.finished_at)}
                  </TD>
                  <TD muted className="hidden max-w-[160px] truncate 2xl:table-cell">
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

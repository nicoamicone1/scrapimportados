import { Download } from "lucide-react";
import type { Metadata } from "next";

import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { Pagination } from "@/components/ui/Pagination";
import { AUDIT_PER_PAGE, getAuditFacets, listAudit } from "@/lib/admin/audit";
import { getAdminSettings } from "@/lib/admin/settings";
import { formatNumber } from "@/lib/money";

import { AuditFilters } from "./AuditFilters";
import { AuditTable } from "./AuditTable";

export const metadata: Metadata = { title: "Auditoría" };

const PARAMS = ["usuario", "accion", "entidad", "desde", "hasta", "q"] as const;

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const page = Math.max(1, Number(get("page")) || 1);
  const dateOk = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

  const filters = {
    actor: /^[0-9a-f-]{36}$/i.test(get("usuario")) ? get("usuario") : "",
    action: get("accion"),
    entity: get("entidad"),
    from: dateOk(get("desde")),
    to: dateOk(get("hasta")),
    q: get("q"),
  };

  const settings = await getAdminSettings();
  const [{ rows, total }, facets] = await Promise.all([listAudit({ ...filters, page }, settings.timezone), getAuditFacets()]);

  const exportParams = new URLSearchParams();
  for (const k of PARAMS) if (get(k)) exportParams.set(k, get(k));
  const exportQs = exportParams.toString();
  const filtered = PARAMS.some((k) => get(k));

  return (
    <>
      <PageHeader
        title="Auditoría"
        description={`${formatNumber(total)} ${total === 1 ? "registro" : "registros"}${filtered ? " con estos filtros" : ""} · quién cambió qué y cuándo.`}
        actions={
          <a href={`/admin/api/export/auditoria.csv${exportQs ? `?${exportQs}` : ""}`} download className={buttonClass("secondary", "md")}>
            <Download aria-hidden />
            Exportar CSV
          </a>
        }
      />
      <AuditFilters facets={facets} />
      <AuditTable rows={rows} timeZone={settings.timezone} filtered={filtered} />
      {total > AUDIT_PER_PAGE ? <Pagination page={page} perPage={AUDIT_PER_PAGE} total={total} /> : null}
    </>
  );
}

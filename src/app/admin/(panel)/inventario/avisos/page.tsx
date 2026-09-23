import type { Metadata } from "next";

import { TabsNav } from "@/components/ui/Tabs";
import { PageHeader } from "@/components/ui/display";
import { Pagination } from "@/components/ui/Pagination";
import { listStockAlerts, STOCK_ALERTS_PER_PAGE, type StockAlertFilter } from "@/lib/admin/inventory-alerts";
import { requireAdmin } from "@/lib/auth";
import { emailEnabled } from "@/lib/email/send";
import { formatNumber } from "@/lib/money";

import { StockAlertsTable } from "./StockAlertsTable";

export const metadata: Metadata = { title: "Avisos de stock" };

const FILTERS: { value: StockAlertFilter; label: string }[] = [
  { value: "pendientes", label: "Pendientes" },
  { value: "avisados", label: "Avisados" },
  { value: "todos", label: "Todos" },
];

const BASE = "/admin/inventario/avisos";

export default async function StockAlertsPage({ searchParams }: PageProps<"/admin/inventario/avisos">) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const raw = typeof sp.estado === "string" ? sp.estado : "pendientes";
  const current = FILTERS.find((f) => f.value === raw)?.value ?? "pendientes";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(typeof sp.page === "string" ? sp.page : "", 10) || 1));
  const list = await listStockAlerts(ctx, current, page);
  const mailOff = !emailEnabled();

  const description = !list.available
    ? "Quién pidió que le avisemos cuando vuelva un producto agotado."
    : list.pending
      ? `${formatNumber(list.pending)} ${list.pending === 1 ? "persona espera" : "personas esperan"} que vuelva un producto. El mail sale solo cuando cargás stock desde el panel.`
      : "Quién pidió que le avisemos cuando vuelva un producto agotado. El mail sale solo cuando cargás stock desde el panel.";

  return (
    <>
      <PageHeader breadcrumb={[{ label: "Inventario", href: "/admin/inventario" }, { label: "Avisos de stock" }]} title="Avisos de stock" description={description}>
        {list.available ? (
          <TabsNav
            label="Estado del aviso"
            items={FILTERS.map((f) => ({
              href: f.value === "pendientes" ? BASE : `${BASE}?estado=${f.value}`,
              label: f.label,
              active: f.value === current,
              count: f.value === "pendientes" ? list.pending : undefined,
            }))}
          />
        ) : null}
      </PageHeader>

      {list.available && mailOff ? (
        <p className="mb-3 text-[13px] text-adm-fg-muted">
          Los mails están apagados en este entorno (falta la clave de envío): los avisos quedan pendientes hasta que se configure.
        </p>
      ) : null}

      <StockAlertsTable rows={list.items} filter={current} available={list.available} />
      {list.available && list.total > STOCK_ALERTS_PER_PAGE ? <Pagination page={page} perPage={STOCK_ALERTS_PER_PAGE} total={list.total} /> : null}
    </>
  );
}

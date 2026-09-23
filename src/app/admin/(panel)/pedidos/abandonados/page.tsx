import type { Metadata } from "next";
import Link from "next/link";

import { PlanGate } from "@/components/admin/PlanGate";
import { PageHeader } from "@/components/ui/display";
import { Pagination } from "@/components/ui/Pagination";
import { TabsNav } from "@/components/ui/Tabs";
import { getAdminSettings } from "@/lib/admin/settings";
import { requireAdmin } from "@/lib/auth";
import { emailEnabled } from "@/lib/email/send";
import { formatNumber } from "@/lib/money";

import { AbandonedTable } from "./AbandonedTable";
import { ABANDONED_PER_PAGE, listAbandoned, type AbandonedFilter } from "./data";

export const metadata: Metadata = { title: "Carritos abandonados" };

const FILTERS: { value: AbandonedFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendientes", label: "Pendientes" },
  { value: "avisados", label: "Avisados" },
  { value: "recuperados", label: "Recuperados" },
  { value: "bajas", label: "Bajas" },
];

const BASE = "/admin/pedidos/abandonados";

export default async function AbandonedPage({ searchParams }: PageProps<"/admin/pedidos/abandonados">) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const raw = typeof sp.estado === "string" ? sp.estado : "todos";
  const current = FILTERS.find((f) => f.value === raw)?.value ?? "todos";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(typeof sp.page === "string" ? sp.page : "", 10) || 1));
  const [list, settings] = await Promise.all([listAbandoned(ctx, current, page), getAdminSettings()]);
  const on = settings.checkout.abandoned_reminders;

  const { sessions, recovered } = list.last30;
  const description =
    list.available && sessions
      ? `Últimos 30 días: ${formatNumber(sessions)} ${sessions === 1 ? "carrito guardado" : "carritos guardados"} · ${formatNumber(recovered)} ${recovered === 1 ? "recuperado" : "recuperados"}. Un solo mail por carrito, entre 3 y 27 horas después de que dejan el checkout.`
      : "Quién dejó el checkout sin confirmar después de aceptar el aviso por mail. Un solo mail por carrito, entre 3 y 27 horas después de que dejan el checkout.";

  return (
    <>
      <PageHeader breadcrumb={[{ label: "Pedidos", href: "/admin/pedidos" }, { label: "Carritos abandonados" }]} title="Carritos abandonados" description={description}>
        {list.available ? (
          <TabsNav
            label="Estado"
            items={FILTERS.map((f) => ({
              href: f.value === "todos" ? BASE : `${BASE}?estado=${f.value}`,
              label: f.label,
              active: f.value === current,
            }))}
          />
        ) : null}
      </PageHeader>

      <PlanGate feature="marketing.abandoned" plan={ctx.plan} description="Guardá el carrito de quien deja el checkout y mandale un aviso con el link para terminarlo.">
        {list.available && !on ? (
          <p className="mb-3 text-[13px] text-adm-fg-muted">
            El aviso está apagado: el checkout no ofrece guardar el carrito.{" "}
            <Link href="/admin/configuracion/pagos" className="font-medium text-adm-accent hover:underline">
              Prenderlo en Pagos y checkout
            </Link>
          </p>
        ) : null}
        {list.available && on && !emailEnabled() ? (
          <p className="mb-3 text-[13px] text-adm-fg-muted">
            Los mails están apagados en este entorno (falta la clave de envío): los carritos quedan pendientes hasta que se configure.
          </p>
        ) : null}
        <AbandonedTable rows={list.items} filter={current} available={list.available} />
        {list.available && list.total > ABANDONED_PER_PAGE ? <Pagination page={page} perPage={ABANDONED_PER_PAGE} total={list.total} /> : null}
      </PlanGate>
    </>
  );
}

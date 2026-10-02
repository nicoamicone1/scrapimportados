import { Download } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getOrderPrint3d } from "@/lib/admin/print3d-production";
import { failureReasonLabel, formatGrams, formatMinutes } from "@/lib/admin/print3d-production-utils";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatMoney, formatPercent } from "@/lib/money";
import { hasModule } from "@/lib/modules/registry";

import { DueChip, JobStatusBadge, Swatch } from "./bits";
import { QueueOrderButton } from "./QueueOrderButton";

/**
 * Panel "Impresión 3D" del detalle del pedido (TALLER-3D §6): trabajos con
 * su estado, archivos de la cotización y costo real contra precio con el
 * margen (§3.6). No renderiza nada si la tienda no tiene la app o el pedido
 * no tiene nada que imprimir.
 */
export async function Print3dOrderPanel({ orderId }: { orderId: string }) {
  const ctx = await requireAdmin();
  if (!hasModule(ctx, "print3d")) return null;
  const data = await getOrderPrint3d(ctx.supabase, ctx.store.id, orderId);
  if (!data) return null;

  const { jobs, workshop, costs, totalCost } = data;
  const printers = new Map(workshop.printers.map((p) => [p.id, p]));
  const colors = new Map(workshop.colors.map((c) => [c.id, c]));
  const materials = new Map(workshop.materials.map((m) => [m.id, m]));
  const active = jobs.filter((j) => j.status === "queued" || j.status === "printing" || j.status === "post").length;
  const done = jobs.filter((j) => j.status === "done").length;
  const live = jobs.filter((j) => j.status !== "cancelled");
  const pendingCount = data.pending.length;

  return (
    <Card>
      <CardHeader
        title="Impresión 3D"
        description={
          jobs.length
            ? `${live.length} ${live.length === 1 ? "trabajo" : "trabajos"} · ${done} ${done === 1 ? "terminado" : "terminados"}${active ? ` · ${active} en la cola` : ""}`
            : "Todavía no se mandó a la cola."
        }
        actions={
          <ButtonLink href="/admin/taller-3d/cola" size="sm" variant="ghost">
            Ver la cola
          </ButtonLink>
        }
      />

      {pendingCount && data.canQueue ? (
        <div className="flex flex-col gap-2 border-b border-adm-border bg-adm-accent-2-soft/50 px-4 py-3 text-[13px] sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1">
            {pendingCount === 1 ? "Un producto se imprime y no está en la cola: " : `${pendingCount} productos se imprimen y no están en la cola: `}
            <span className="text-adm-fg-muted">{data.pending.map((p) => `${p.name} × ${p.qty}`).join(", ")}</span>.
          </p>
          <QueueOrderButton orderId={orderId} />
        </div>
      ) : null}

      {jobs.length ? (
        <ul className="divide-y divide-adm-border">
          {jobs.map((j) => {
            const color = j.color_id ? colors.get(j.color_id) : undefined;
            const material = j.material_id ? materials.get(j.material_id) : undefined;
            const printer = j.printer_id ? printers.get(j.printer_id) : undefined;
            const cost = costs.get(j.id);
            const real = j.status === "done";
            return (
              <li
                key={j.id}
                className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]", j.status === "cancelled" && "opacity-60")}
              >
                <Swatch hex={color?.hex} size={14} title={color?.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{j.title}</p>
                  <p className="tnum truncate text-xs text-adm-fg-muted">
                    {[material?.type, color?.name].filter(Boolean).join(" ")}
                    {j.qty > 1 ? ` · × ${j.qty}` : ""}
                    {" · "}
                    {real
                      ? `${formatGrams(j.actual_grams)} en ${formatMinutes(j.actual_minutes)} (estimado ${formatGrams(j.est_grams)})`
                      : `${formatGrams(j.est_grams)} · ${formatMinutes(j.est_minutes)}`}
                    {printer ? ` · ${printer.name}` : ""}
                    {j.status === "failed" && j.failure_reason
                      ? ` · ${failureReasonLabel(j.failure_reason)?.toLowerCase()}, ${formatGrams(j.wasted_grams)} tirados`
                      : ""}
                  </p>
                </div>
                <DueChip due={j.due_date} today={data.today} status={j.status} />
                <JobStatusBadge status={j.status} />
                <span className="tnum w-20 text-right text-xs text-adm-fg-muted" title="Costo del trabajo">
                  {cost ? formatMoney(cost.total) : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {data.files.length ? (
        <div className="border-t border-adm-border px-4 py-3 text-[13px]">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">Archivos del cliente</p>
            {data.quote ? (
              <Link href={`/admin/taller-3d/cotizaciones/${data.quote.id}`} className="text-xs text-adm-accent hover:underline">
                Ver cotización
              </Link>
            ) : null}
          </div>
          <ul className="mt-1.5 space-y-1">
            {data.files.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                {f.url ? (
                  <a href={f.url} className="inline-flex min-w-0 items-center gap-1.5 text-adm-accent hover:underline">
                    <Download className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{f.name}</span>
                  </a>
                ) : (
                  <span className="truncate text-adm-fg-muted">{f.name} (ya no está en el depósito)</span>
                )}
                <span className="tnum shrink-0 text-xs text-adm-fg-muted">× {f.qty}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {live.length ? (
        <CardBody className="border-t border-adm-border">
          <dl className="tnum ml-auto max-w-sm space-y-1.5 text-[13px]">
            <Row label={data.quote ? "Precio (sin envío)" : "Precio de lo que se imprime"} value={formatMoney(data.revenue)} />
            <Row label="Filamento" value={`− ${formatMoney(totalCost.material)}`} muted />
            <Row label="Luz" value={`− ${formatMoney(totalCost.energy)}`} muted />
            <Row label="Desgaste de la máquina" value={`− ${formatMoney(totalCost.amortization)}`} muted />
            {totalCost.labor > 0 ? <Row label="Post-proceso" value={`− ${formatMoney(totalCost.labor)}`} muted /> : null}
            {totalCost.waste > 0 ? <Row label="Fallas" value={`− ${formatMoney(totalCost.waste)}`} muted /> : null}
            <div className="flex justify-between gap-4 border-t border-adm-border pt-2 text-sm font-semibold">
              <dt>Margen{done < live.length ? " estimado" : ""}</dt>
              <dd className={cn(data.margin.amount < 0 && "text-adm-danger")}>
                {formatMoney(data.margin.amount)}
                {data.margin.pct !== null ? ` (${formatPercent(Math.round(data.margin.pct * 100))})` : ""}
              </dd>
            </div>
          </dl>
          {totalCost.incomplete ? (
            <p className="mt-2 text-right text-xs text-adm-fg-muted">Falta el costo de alguna bobina o impresora: el margen real es menor.</p>
          ) : null}
        </CardBody>
      ) : null}
    </Card>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", muted && "text-adm-fg-muted")}>
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

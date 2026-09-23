"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { resolveWithdrawal, saveWithdrawalNotes } from "@/app/admin/(panel)/pedidos/actions";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Checkbox, Textarea } from "@/components/ui/Input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { WithdrawalView } from "@/lib/admin/orders";
import { formatMoney } from "@/lib/money";

import { AutosaveNotes } from "./AutosaveNotes";
import { OrderStatusBadge, RelativeTime } from "./OrderBadges";

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  new: { label: "Nueva", tone: "amber" },
  processed: { label: "Procesada", tone: "green" },
  rejected: { label: "Rechazada", tone: "neutral" },
};

/** Bandeja de solicitudes de arrepentimiento (Res. SCI 424/2020). */
export function WithdrawalsTable({ rows, timeZone, empty }: { rows: WithdrawalView[]; timeZone: string; empty: ReactNode }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [target, setTarget] = useState<{ row: WithdrawalView; action: "process" | "reject" } | null>(null);
  const [cancelOrder, setCancelOrder] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const start = (row: WithdrawalView, action: "process" | "reject") => {
    setTarget({ row, action });
    setCancelOrder(Boolean(row.order && row.order.status !== "cancelled"));
    setNotes(row.admin_notes ?? "");
  };

  const confirm = async () => {
    if (!target) return;
    setSaving(true);
    const res = await resolveWithdrawal({
      id: target.row.id,
      action: target.action,
      cancelOrder: target.action === "process" && cancelOrder,
      notes,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      target.action === "reject"
        ? `Solicitud ${target.row.code} rechazada.`
        : res.data.cancelled
          ? `Solicitud ${target.row.code} procesada y pedido #${target.row.order?.number} cancelado.`
          : `Solicitud ${target.row.code} procesada.`,
    );
    setTarget(null);
    startTransition(() => router.refresh());
  };

  const orderLive = target?.row.order && target.row.order.status !== "cancelled";

  return (
    <>
      <Table pending={refreshing || undefined}>
        <THead>
          <tr>
            <TH>Código</TH>
            <TH>Recibida</TH>
            <TH>Cliente</TH>
            <TH>Pedido</TH>
            <TH>Motivo</TH>
            <TH>Estado</TH>
            <TH className="text-right">Acciones</TH>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0
            ? empty
            : rows.map((w) => {
                const st = STATUS[w.status] ?? STATUS.new;
                return (
                  <TR key={w.id} className="align-top">
                    <TD className="font-mono text-xs whitespace-nowrap">{w.code}</TD>
                    <TD className="whitespace-nowrap">
                      <RelativeTime value={w.created_at} timeZone={timeZone} />
                    </TD>
                    <TD className="max-w-56">
                      <div className="font-medium">{w.name}</div>
                      <div className="truncate text-xs text-adm-fg-muted">{w.contact}</div>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {w.order ? (
                        <div className="space-y-0.5">
                          <Link href={`/admin/pedidos/${w.order.id}`} className="tnum font-medium hover:underline">
                            #{w.order.number}
                          </Link>
                          <div className="flex items-center gap-1.5">
                            <OrderStatusBadge status={w.order.status} fulfillment={w.order.fulfillment} />
                            <span className="tnum text-xs text-adm-fg-muted">{formatMoney(Number(w.order.total))}</span>
                          </div>
                        </div>
                      ) : w.order_number ? (
                        <span className="text-adm-fg-muted" title="No hay un pedido con ese número">
                          #{w.order_number} (no existe)
                        </span>
                      ) : (
                        <span className="text-adm-fg-muted">Sin número</span>
                      )}
                    </TD>
                    <TD className="max-w-72">
                      <p className="line-clamp-3 text-[13px]">{w.reason || <span className="text-adm-fg-muted">Sin motivo</span>}</p>
                      {w.status !== "new" ? (
                        <p className="mt-1 text-xs text-adm-fg-muted">
                          {st.label} por {w.processedByName ?? "el equipo"}
                          {w.admin_notes ? ` · ${w.admin_notes}` : ""}
                        </p>
                      ) : open === w.id ? (
                        <div className="mt-2">
                          <AutosaveNotes
                            id={`w-notes-${w.id}`}
                            label="Notas internas"
                            rows={2}
                            initial={w.admin_notes ?? ""}
                            save={(text) => saveWithdrawalNotes({ id: w.id, notes: text })}
                          />
                        </div>
                      ) : (
                        <button type="button" className="mt-1 text-xs text-adm-accent hover:underline" onClick={() => setOpen(w.id)}>
                          {w.admin_notes ? `Nota: ${w.admin_notes}` : "Agregar nota"}
                        </button>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </TD>
                    <TD className="text-right whitespace-nowrap">
                      {w.status === "new" ? (
                        <div className="inline-flex gap-1.5">
                          <Button size="sm" onClick={() => start(w, "reject")}>
                            Rechazar
                          </Button>
                          <Button size="sm" variant="primary" onClick={() => start(w, "process")}>
                            Procesar
                          </Button>
                        </div>
                      ) : null}
                    </TD>
                  </TR>
                );
              })}
        </TBody>
      </Table>

      <Dialog
        open={target !== null}
        onOpenChange={(o) => !o && !saving && setTarget(null)}
        title={target?.action === "reject" ? `Rechazar la solicitud ${target?.row.code}` : `Procesar la solicitud ${target?.row.code}`}
        description={
          target?.action === "reject"
            ? "Usalo si la solicitud no corresponde (por ejemplo, fuera de plazo o de otro comercio). Informale el motivo al cliente."
            : "El cliente tiene 10 días corridos desde que recibió el producto. Recordá informarle la aceptación por el mismo medio dentro de las 24 h."
        }
        dismissable={!saving}
        footer={
          <>
            <Button onClick={() => setTarget(null)} disabled={saving}>
              Volver
            </Button>
            <Button variant={target?.action === "reject" ? "danger" : "primary"} onClick={confirm} loading={saving}>
              {target?.action === "reject"
                ? "Rechazar solicitud"
                : cancelOrder && orderLive
                  ? `Procesar y cancelar #${target?.row.order?.number}`
                  : "Marcar como procesada"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {target?.action === "process" && orderLive ? (
            <Checkbox
              checked={cancelOrder}
              onChange={(e) => setCancelOrder(e.target.checked)}
              label={`Cancelar el pedido #${target.row.order?.number}`}
              description="Motivo: arrepentimiento. Si descontó stock, vuelve al inventario."
            />
          ) : null}
          <Field label="Notas internas">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

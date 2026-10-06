"use client";

import { ArrowRight, ChevronDown, Ellipsis, Eye, Printer, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { bulkChangeOrderStatus, changeOrderStatus, markOrdersPaid } from "@/app/admin/(panel)/pedidos/actions";
import { PlanGate, usePlanFeature } from "@/components/admin/PlanGate";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Checkbox } from "@/components/ui/Input";
import { PendingOverlay } from "@/components/ui/PendingOverlay";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { FULFILLMENT_LABELS, hasReservation, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/admin/order-utils";
import type { OrderListItem } from "@/lib/admin/orders";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";

import { CancelDialog, ShipDialog, type ShipValues } from "./OrderDialogs";
import { ExpiryText, OrderStatusBadge, PaymentStatusBadge, RelativeTime } from "./OrderBadges";
import { OrderJourneyMini } from "./OrderJourney";
import { quickActionFor, type QuickAction } from "./quick-action";

const BULK_STATUSES: OrderStatus[] = ["confirmed", "preparing", "shipped", "delivered", "cancelled"];

export interface OrdersTableProps {
  rows: OrderListItem[];
  methodNames: Record<string, string>;
  timeZone: string;
  /** Barra de filtros (se reemplaza por la de acciones masivas al seleccionar). */
  filters: ReactNode;
  /** Fila vacía (sin pedidos o sin resultados con filtros). */
  empty: ReactNode;
}

/**
 * Listado de pedidos. En escritorio es una tabla; en celular (< lg) cada pedido
 * es una tarjeta táctil con su siguiente paso a un toque ("Confirmar pago",
 * "Marcar enviado"…). Las acciones en línea se pueden deshacer desde el toast.
 */
export function OrdersTable({ rows, methodNames, timeZone, filters, empty }: OrdersTableProps) {
  const router = useRouter();
  // Remitos desde Starter (`orders.print`): en Free no se ofrece imprimir desde la fila.
  const canPrint = usePlanFeature("orders.print");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paidTarget, setPaidTarget] = useState<string[] | null>(null);
  const [shipTarget, setShipTarget] = useState<OrderListItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Si cambia la página/filtros, se descartan los seleccionados que ya no están.
  const visible = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const sel = [...selected].filter((id) => visible.has(id));
  const allChecked = rows.length > 0 && sel.length === rows.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const refresh = () => startTransition(() => router.refresh());

  const changeStatus = async (status: OrderStatus, reason?: string) => {
    const res = await bulkChangeOrderStatus({ ids: sel, status, reason });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    const { updated, skipped } = res.data;
    if (updated) toast.success(`${updated} ${updated === 1 ? "pedido pasó" : "pedidos pasaron"} a ${ORDER_STATUS_LABELS[status].toLowerCase()}.`);
    if (skipped.length) toast.warning(`${skipped.length} sin cambiar: ${skipped[0].error}`);
    if (!updated && !skipped.length) toast.info("Los pedidos elegidos ya estaban en ese estado.");
    setSelected(new Set());
    refresh();
    return true;
  };

  const markPaid = async (ids: string[]) => {
    const res = await markOrdersPaid({ ids });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data.updated
        ? `${res.data.updated} ${res.data.updated === 1 ? "pedido marcado" : "pedidos marcados"} como pagados.`
        : "No había saldo pendiente en los pedidos elegidos.",
    );
    setSelected(new Set());
    refresh();
  };

  const printIds = (ids: string[]) => {
    window.open(`/admin/pedidos/imprimir?ids=${ids.join(",")}`, "_blank", "noopener");
  };

  /** Pasa un pedido de estado con Deshacer (vuelve al estado anterior). */
  const moveOrder = async (o: OrderListItem, to: OrderStatus, ship?: ShipValues) => {
    setBusyId(o.id);
    const res = await changeOrderStatus({ orderId: o.id, status: to, ...(ship ?? {}) });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    const from = o.status as OrderStatus;
    toast.success(`Pedido #${o.number}: ${ORDER_STATUS_LABELS[to].toLowerCase()}.`, {
      action: {
        label: "Deshacer",
        onClick: () => {
          void changeOrderStatus({ orderId: o.id, status: from }).then((r) => {
            if (r.ok) toast.success(`Pedido #${o.number} volvió a ${ORDER_STATUS_LABELS[from].toLowerCase()}.`);
            else toast.error(r.error);
            refresh();
          });
        },
      },
    });
    refresh();
    return true;
  };

  /** "Confirmar pago": registra el saldo como cobrado y confirma el pedido. */
  const confirmPayment = async (o: OrderListItem) => {
    setBusyId(o.id);
    const paid = await markOrdersPaid({ ids: [o.id] });
    if (!paid.ok) {
      setBusyId(null);
      toast.error(paid.error);
      return;
    }
    const res = await changeOrderStatus({ orderId: o.id, status: "confirmed" });
    setBusyId(null);
    if (!res.ok) {
      toast.warning(`Pedido #${o.number} quedó pagado, pero no se pudo confirmar: ${res.error}`);
    } else {
      toast.success(`Pedido #${o.number}: pago confirmado.`, {
        action: { label: "Avisar al cliente", onClick: () => router.push(`/admin/pedidos/${o.id}`) },
      });
    }
    refresh();
  };

  const runQuick = (o: OrderListItem, q: QuickAction) => {
    if (q.kind === "confirm_payment") void confirmPayment(o);
    else if (q.needsTracking) setShipTarget(o);
    else void moveOrder(o, q.to);
  };

  const rowMenu = (o: OrderListItem, className?: string) => {
    const unpaid = o.status !== "cancelled" && (o.paymentStatus === "pending" || o.paymentStatus === "partial");
    return (
      <DropdownMenu
        trigger={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Más acciones del pedido #${o.number}`}
            className={cn("max-lg:size-11", className)}
          >
            <Ellipsis />
          </Button>
        }
      >
        <DropdownItem href={`/admin/pedidos/${o.id}`} icon={<Eye />}>
          Ver pedido
        </DropdownItem>
        <DropdownItem icon={<Wallet />} disabled={!unpaid} onSelect={() => setPaidTarget([o.id])}>
          Marcar pagado
        </DropdownItem>
        {canPrint ? (
          <>
            <DropdownSeparator />
            <DropdownItem icon={<Printer />} onSelect={() => printIds([o.id])}>
              Imprimir remito
            </DropdownItem>
          </>
        ) : null}
      </DropdownMenu>
    );
  };

  const quickButton = (o: OrderListItem, className?: string) => {
    const q = quickActionFor(o);
    if (!q) return null;
    return (
      <Button
        size="sm"
        className={className}
        loading={busyId === o.id}
        disabled={busyId !== null && busyId !== o.id}
        iconRight={<ArrowRight />}
        onClick={() => runQuick(o, q)}
        aria-label={`${q.label}, pedido #${o.number}`}
      >
        {q.label}
      </Button>
    );
  };

  return (
    <div aria-busy={pending || undefined}>
      <div className="mb-3 min-h-8">
        {sel.length ? (
          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Acciones masivas">
            <span className="text-sm font-medium text-adm-fg tnum">
              {formatNumber(sel.length)} {sel.length === 1 ? "seleccionado" : "seleccionados"}
            </span>
            <span aria-hidden className="text-adm-border">
              |
            </span>
            <DropdownMenu
              align="start"
              trigger={
                <Button size="sm" iconRight={<ChevronDown />} className="max-lg:h-11">
                  Cambiar estado
                </Button>
              }
            >
              {BULK_STATUSES.map((s) => (
                <DropdownItem
                  key={s}
                  danger={s === "cancelled"}
                  onSelect={() => (s === "cancelled" ? setCancelOpen(true) : void changeStatus(s))}
                >
                  {s === "cancelled" ? "Cancelar pedidos" : ORDER_STATUS_LABELS[s]}
                </DropdownItem>
              ))}
            </DropdownMenu>
            <Button size="sm" icon={<Wallet />} className="max-lg:h-11" onClick={() => setPaidTarget(sel)}>
              Marcar pagados
            </Button>
            <PlanGate feature="orders.print" mode="inline" label="Imprimir remitos" className="max-lg:h-11">
              <Button size="sm" icon={<Printer />} className="max-lg:h-11" onClick={() => printIds(sel)}>
                Imprimir remitos
              </Button>
            </PlanGate>
            <Button size="sm" variant="ghost" icon={<X />} className="max-lg:h-11" onClick={() => setSelected(new Set())}>
              Deseleccionar
            </Button>
          </div>
        ) : (
          filters
        )}
      </div>

      {/* Celular y tablet: tarjetas táctiles. */}
      <div className="relative lg:hidden">
        {rows.length === 0 ? (
          <div className="rounded-adm border border-adm-border bg-adm-surface shadow-adm-card">
            <table className="w-full">
              <tbody>{empty}</tbody>
            </table>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((o) => {
              const isNew = !o.seenAt && o.status !== "cancelled";
              const checked = selected.has(o.id);
              return (
                <li
                  key={o.id}
                  className={cn(
                    "relative flex gap-1 rounded-adm-lg border border-adm-border bg-adm-surface p-3 shadow-adm-card",
                    o.status === "cancelled" && "bg-adm-surface-2/60",
                    checked && "bg-adm-accent-2-soft/60",
                  )}
                >
                  <label className="relative z-10 -mt-1 -ml-2 flex size-11 shrink-0 cursor-pointer items-center justify-center">
                    <Checkbox aria-label={`Seleccionar pedido #${o.number}`} checked={checked} onChange={() => toggle(o.id)} />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {isNew ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-eco-pomelo" /> : null}
                        <Link
                          href={`/admin/pedidos/${o.id}`}
                          className={cn(
                            "tnum text-[15px] text-adm-fg after:absolute after:inset-0 after:content-['']",
                            isNew ? "font-semibold" : "font-medium",
                          )}
                        >
                          #{o.number}
                          {isNew ? <span className="sr-only"> (nuevo)</span> : null}
                        </Link>
                        {o.source === "manual" ? <span className="text-xs text-adm-fg-muted">Manual</span> : null}
                      </div>
                      <span className={cn("eco-num shrink-0 text-[17px]", o.status === "cancelled" && "text-adm-fg-muted line-through decoration-1")}>
                        {formatMoney(o.total, { currency: o.currency })}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="truncate">{o.customer.name}</span>
                      <RelativeTime value={o.createdAt} timeZone={timeZone} className="shrink-0 text-xs text-adm-fg-muted" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <OrderStatusBadge status={o.status} fulfillment={o.fulfillment} />
                      <PaymentStatusBadge status={o.paymentStatus} />
                      <OrderJourneyMini status={o.status} className="ml-auto" />
                      {hasReservation({ status: o.status, payment_status: o.paymentStatus, expires_at: o.expiresAt }) ? (
                        <ExpiryText expiresAt={o.expiresAt} timeZone={timeZone} />
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-adm-fg-muted">
                      {formatNumber(o.itemsCount)} {o.itemsCount === 1 ? "ítem" : "ítems"} ·{" "}
                      {FULFILLMENT_LABELS[o.fulfillment as "delivery" | "pickup"] ?? o.fulfillment}
                      {o.paymentMethodCode ? ` · ${methodNames[o.paymentMethodCode] ?? o.paymentMethodCode}` : ""}
                    </p>
                    <div className="relative z-10 mt-2 flex items-center gap-2">
                      {quickButton(o, "max-lg:h-11 flex-1")}
                      <div className={cn(!quickActionFor(o) && "ml-auto")}>{rowMenu(o)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <PendingOverlay pending={pending || undefined} />
      </div>

      {/* Escritorio: tabla. */}
      <div className="hidden lg:block">
        <Table pending={pending || undefined}>
          <THead>
            <tr>
              <TH className="w-9 pr-0">
                <Checkbox
                  aria-label="Seleccionar todos"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = sel.length > 0 && !allChecked;
                  }}
                  onChange={toggleAll}
                  disabled={!rows.length}
                />
              </TH>
              <TH>Pedido</TH>
              <TH>Cliente</TH>
              <TH numeric>Total</TH>
              <TH>Estado</TH>
              <TH>Pago</TH>
              <TH>Entrega</TH>
              <TH>
                <span className="sr-only">Siguiente paso</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {rows.length === 0
              ? empty
              : rows.map((o) => {
                  const isNew = !o.seenAt && o.status !== "cancelled";
                  const checked = selected.has(o.id);
                  return (
                    <TR key={o.id} selected={checked}>
                      <TD className="w-9 pr-0">
                        <Checkbox aria-label={`Seleccionar pedido #${o.number}`} checked={checked} onChange={() => toggle(o.id)} />
                      </TD>
                      <TD className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isNew ? <span aria-hidden className="size-1.5 rounded-full bg-eco-pomelo" /> : null}
                          <Link
                            href={`/admin/pedidos/${o.id}`}
                            className={cn("tnum text-adm-fg hover:text-adm-link hover:underline", isNew ? "font-semibold" : "font-medium")}
                          >
                            #{o.number}
                          </Link>
                          {isNew ? <span className="sr-only">(nuevo)</span> : null}
                          {o.source === "manual" ? <span className="text-xs text-adm-fg-muted">Manual</span> : null}
                        </div>
                        <RelativeTime value={o.createdAt} timeZone={timeZone} className="text-xs text-adm-fg-muted" />
                      </TD>
                      <TD className="max-w-60">
                        <div className="truncate font-medium">{o.customer.name}</div>
                        <div className="truncate text-xs text-adm-fg-muted">{o.customer.email ?? o.customer.phone ?? "—"}</div>
                      </TD>
                      <TD numeric>
                        <div className={cn("font-semibold text-adm-fg", o.status === "cancelled" && "font-normal text-adm-fg-muted line-through")}>
                          {formatMoney(o.total, { currency: o.currency })}
                        </div>
                        <div className="text-xs font-normal text-adm-fg-muted">
                          {formatNumber(o.itemsCount)} {o.itemsCount === 1 ? "ítem" : "ítems"}
                        </div>
                      </TD>
                      <TD>
                        <div className="flex flex-col items-start gap-1.5">
                          <OrderStatusBadge status={o.status} fulfillment={o.fulfillment} />
                          <OrderJourneyMini status={o.status} className="pl-0.5" />
                        </div>
                      </TD>
                      <TD>
                        <div className="flex flex-col items-start gap-0.5">
                          <PaymentStatusBadge status={o.paymentStatus} />
                          <span className="text-xs text-adm-fg-muted">
                            {o.paymentMethodCode ? (methodNames[o.paymentMethodCode] ?? o.paymentMethodCode) : "Sin método"}
                          </span>
                          {hasReservation({ status: o.status, payment_status: o.paymentStatus, expires_at: o.expiresAt }) ? (
                            <ExpiryText expiresAt={o.expiresAt} timeZone={timeZone} />
                          ) : null}
                        </div>
                      </TD>
                      <TD muted>{FULFILLMENT_LABELS[o.fulfillment as "delivery" | "pickup"] ?? o.fulfillment}</TD>
                      <TD className="w-px whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {quickButton(o)}
                          {rowMenu(o)}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
          </TBody>
        </Table>
      </div>

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancelar ${sel.length} ${sel.length === 1 ? "pedido" : "pedidos"}`}
        confirmLabel={`Cancelar ${sel.length} ${sel.length === 1 ? "pedido" : "pedidos"}`}
        onConfirm={(reason) => changeStatus("cancelled", reason)}
      />
      <ConfirmDialog
        open={paidTarget !== null}
        onOpenChange={(o) => !o && setPaidTarget(null)}
        title={
          paidTarget && paidTarget.length > 1 ? `Marcar ${paidTarget.length} pedidos como pagados` : "Marcar el pedido como pagado"
        }
        description="Se registra un pago por el saldo pendiente de cada pedido, con su método de pago. Lo podés anular desde el detalle."
        confirmLabel={paidTarget && paidTarget.length > 1 ? `Marcar ${paidTarget.length} pagados` : "Marcar pagado"}
        onConfirm={async () => {
          if (paidTarget) await markPaid(paidTarget);
        }}
      />
      {shipTarget ? (
        <ShipDialog
          open
          onOpenChange={(o) => !o && setShipTarget(null)}
          title={`Despachar el pedido #${shipTarget.number}`}
          confirmLabel="Marcar enviado"
          onConfirm={(v) => moveOrder(shipTarget, "shipped", v)}
        />
      ) : null}
    </div>
  );
}

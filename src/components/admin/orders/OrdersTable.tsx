"use client";

import { ChevronDown, Ellipsis, Eye, Printer, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { bulkChangeOrderStatus, markOrdersPaid } from "@/app/admin/(panel)/pedidos/actions";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Checkbox } from "@/components/ui/Input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { FULFILLMENT_LABELS, hasReservation, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/admin/order-utils";
import type { OrderListItem } from "@/lib/admin/orders";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";

import { CancelDialog } from "./OrderDialogs";
import { ExpiryText, OrderStatusBadge, PaymentStatusBadge, RelativeTime } from "./OrderBadges";

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

export function OrdersTable({ rows, methodNames, timeZone, filters, empty }: OrdersTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paidTarget, setPaidTarget] = useState<string[] | null>(null);
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
    startTransition(() => router.refresh());
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
    startTransition(() => router.refresh());
  };

  const printIds = (ids: string[]) => {
    window.open(`/admin/pedidos/imprimir?ids=${ids.join(",")}`, "_blank", "noopener");
  };

  return (
    <div className={cn(pending && "opacity-80")}>
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
                <Button size="sm" iconRight={<ChevronDown />}>
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
            <Button size="sm" icon={<Wallet />} onClick={() => setPaidTarget(sel)}>
              Marcar pagados
            </Button>
            <Button size="sm" icon={<Printer />} onClick={() => printIds(sel)}>
              Imprimir remitos
            </Button>
            <Button size="sm" variant="ghost" icon={<X />} onClick={() => setSelected(new Set())}>
              Deseleccionar
            </Button>
          </div>
        ) : (
          filters
        )}
      </div>

      <Table>
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
            <TH numeric>Ítems</TH>
            <TH numeric>Total</TH>
            <TH>Método</TH>
            <TH>Estado</TH>
            <TH>Pago</TH>
            <TH>Entrega</TH>
            <TH className="w-10">
              <span className="sr-only">Acciones</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0
            ? empty
            : rows.map((o) => {
                const isNew = !o.seenAt && o.status !== "cancelled";
                const checked = selected.has(o.id);
                const unpaid = o.status !== "cancelled" && (o.paymentStatus === "pending" || o.paymentStatus === "partial");
                return (
                  <TR key={o.id} selected={checked}>
                    <TD className="w-9 pr-0">
                      <Checkbox aria-label={`Seleccionar pedido #${o.number}`} checked={checked} onChange={() => toggle(o.id)} />
                    </TD>
                    <TD className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isNew ? <span aria-hidden className="size-1.5 rounded-full bg-adm-accent" /> : null}
                        <Link
                          href={`/admin/pedidos/${o.id}`}
                          className={cn("tnum text-adm-fg hover:underline", isNew ? "font-semibold" : "font-medium")}
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
                    <TD numeric>{formatNumber(o.itemsCount)}</TD>
                    <TD numeric className="font-medium">
                      {formatMoney(o.total, { currency: o.currency })}
                    </TD>
                    <TD muted className="whitespace-nowrap">
                      {o.paymentMethodCode ? (methodNames[o.paymentMethodCode] ?? o.paymentMethodCode) : "—"}
                    </TD>
                    <TD>
                      <OrderStatusBadge status={o.status} fulfillment={o.fulfillment} />
                    </TD>
                    <TD>
                      <div className="flex flex-col items-start gap-0.5">
                        <PaymentStatusBadge status={o.paymentStatus} />
                        {hasReservation({ status: o.status, payment_status: o.paymentStatus, expires_at: o.expiresAt }) ? (
                          <ExpiryText expiresAt={o.expiresAt} timeZone={timeZone} />
                        ) : null}
                      </div>
                    </TD>
                    <TD muted>{FULFILLMENT_LABELS[o.fulfillment as "delivery" | "pickup"] ?? o.fulfillment}</TD>
                    <TD className="w-10 pl-0 text-right">
                      <DropdownMenu
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Acciones del pedido #${o.number}`}
                            className="opacity-60 group-hover/row:opacity-100 focus-visible:opacity-100"
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
                        <DropdownSeparator />
                        <DropdownItem icon={<Printer />} onSelect={() => printIds([o.id])}>
                          Imprimir remito
                        </DropdownItem>
                      </DropdownMenu>
                    </TD>
                  </TR>
                );
              })}
        </TBody>
      </Table>

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
    </div>
  );
}

"use client";

import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { changeOrderStatus, markOrdersPaid } from "@/app/admin/(panel)/pedidos/actions";
import { ShipDialog, type ShipValues } from "@/components/admin/orders/OrderDialogs";
import { ExpiryText, OrderStatusBadge, PaymentStatusBadge, RelativeTime } from "@/components/admin/orders/OrderBadges";
import { quickActionFor, type QuickAction } from "@/components/admin/orders/quick-action";
import { WhatsAppDialog } from "@/components/admin/orders/WhatsAppComposer";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/admin/order-utils";
import { whatsAppTemplateFor, type WhatsAppMessageContext, type WhatsAppTemplateKind } from "@/lib/admin/whatsapp";
import { groupWorkQueue, WORK_QUEUE_GROUP_LABELS, type WorkQueueItem } from "@/lib/admin/work-queue";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";

import "./dashboard.css";

interface OpenWhatsApp {
  orderId: string;
  phone: string;
  kind: WhatsAppTemplateKind;
  context: WhatsAppMessageContext;
}

/**
 * "Resolver desde acá" (PRODUCT-THESIS §4.1, DESIGN §7.8): los pedidos
 * accionables con su siguiente paso en un toque (`quickActionFor`), Deshacer
 * en el toast y "Avisar por WhatsApp" sin salir del inicio. Al resolver, el
 * server vuelve a pintar el inicio: la fila cambia de paso o desaparece y los
 * contadores de "Para hacer" se actualizan.
 */
export function WorkQueue({ items, total, timeZone }: { items: WorkQueueItem[]; total: number; timeZone: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shipTarget, setShipTarget] = useState<WorkQueueItem | null>(null);
  const [wa, setWa] = useState<OpenWhatsApp | null>(null);
  const [refreshing, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  /** WhatsApp con la plantilla del estado nuevo (después de resolver). */
  const waAfter = (o: WorkQueueItem, status: OrderStatus, paymentStatus: string, ship?: ShipValues): OpenWhatsApp | null => {
    if (!o.whatsApp) return null;
    return {
      orderId: o.id,
      phone: o.whatsApp.phone,
      kind: whatsAppTemplateFor({ status, payment_status: paymentStatus, fulfillment: o.fulfillment }),
      context: {
        ...o.whatsApp.context,
        balance: paymentStatus === "paid" ? null : o.whatsApp.context.balance,
        expiresLabel: status === "pending" ? o.whatsApp.context.expiresLabel : null,
        tracking: ship ? { carrier: ship.carrier || null, number: ship.trackingNumber || null, url: ship.trackingUrl || null } : null,
      },
    };
  };

  /** Pasa el pedido al siguiente estado, con Deshacer (y avisar, si hay teléfono). */
  const moveOrder = async (o: WorkQueueItem, to: OrderStatus, ship?: ShipValues) => {
    setBusyId(o.id);
    const res = await changeOrderStatus({ orderId: o.id, status: to, ...(ship ?? {}) });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    const from = o.status as OrderStatus;
    const notify = waAfter(o, to, o.paymentStatus, ship);
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
      cancel: notify ? { label: "Avisar por WhatsApp", onClick: () => setWa(notify) } : undefined,
      duration: notify ? 8_000 : undefined,
    });
    refresh();
    return true;
  };

  /** "Confirmar pago": registra el saldo como cobrado, confirma y ofrece avisar. */
  const confirmPayment = async (o: WorkQueueItem) => {
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
      const notify = waAfter(o, "confirmed", "paid");
      toast.success(`Pedido #${o.number}: pago confirmado.`, {
        action: notify ? { label: "Avisar por WhatsApp", onClick: () => setWa(notify) } : undefined,
        duration: notify ? 10_000 : undefined,
      });
    }
    refresh();
  };

  const runQuick = (o: WorkQueueItem, q: QuickAction) => {
    if (q.kind === "confirm_payment") void confirmPayment(o);
    else if (q.needsTracking) setShipTarget(o);
    else void moveOrder(o, q.to);
  };

  const groups = groupWorkQueue(items);
  const locked = busyId !== null || refreshing;

  return (
    <section aria-labelledby="resolver" aria-busy={refreshing || undefined} className="@container min-w-0">
      <div className="mb-2.5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id="resolver" className="text-[15px] font-semibold text-adm-fg">
            Resolver desde acá
          </h2>
          <p className="mt-0.5 text-[13px] text-adm-fg-muted">El siguiente paso de cada pedido, sin abrirlo.</p>
        </div>
        {total > items.length ? (
          <Link
            href="/admin/pedidos"
            className="group inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-adm-link hover:bg-adm-accent-soft pointer-coarse:h-11"
          >
            Ver los {formatNumber(total)}
            <ArrowRight aria-hidden className="dsh-go size-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface shadow-adm-card">
        {groups.map((g, gi) => (
          <div key={g.group} className={cn(gi > 0 && "border-t border-adm-border")}>
            <h3 className="bg-adm-surface-2/60 px-4 py-1.5 text-[11px] font-semibold tracking-[0.1em] text-adm-fg-muted uppercase sm:px-5">
              {WORK_QUEUE_GROUP_LABELS[g.group]}
            </h3>
            <ul className="divide-y divide-adm-border">
              {g.items.map((o) => {
                const q = quickActionFor(o);
                const busy = busyId === o.id;
                return (
                  <li key={o.id} className="flex flex-col gap-2.5 px-4 py-3 text-[13px] sm:px-5 @xl:flex-row @xl:items-center @xl:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-2">
                        <span className="tnum shrink-0 font-semibold text-adm-fg">#{o.number}</span>
                        <span className="min-w-0 truncate text-adm-fg">{o.customer.name}</span>
                        <span className="tnum ml-auto shrink-0 font-semibold text-adm-fg">{formatMoney(o.total, { currency: o.currency })}</span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <OrderStatusBadge status={o.status} fulfillment={o.fulfillment} />
                        <PaymentStatusBadge status={o.paymentStatus} />
                        <RelativeTime value={o.createdAt} timeZone={timeZone} className="text-xs text-adm-fg-muted" />
                        <ExpiryText expiresAt={o.status === "pending" && o.paymentStatus === "pending" ? o.expiresAt : null} timeZone={timeZone} />
                      </p>
                    </div>
                    <div className="flex items-center gap-2 @xl:shrink-0">
                      {q ? (
                        <Button
                          size="sm"
                          className="flex-1 pointer-coarse:h-11 @xl:flex-none"
                          loading={busy}
                          disabled={locked && !busy}
                          iconRight={<ArrowRight />}
                          onClick={() => runQuick(o, q)}
                          aria-label={`${q.label}, pedido #${o.number}`}
                        >
                          {q.label}
                        </Button>
                      ) : null}
                      {o.whatsApp ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<MessageCircle />}
                          className="pointer-coarse:h-11"
                          onClick={() => o.whatsApp && setWa({ orderId: o.id, ...o.whatsApp })}
                          aria-label={`Avisar por WhatsApp a ${o.customer.name}, pedido #${o.number}`}
                        >
                          Avisar
                        </Button>
                      ) : null}
                      <ButtonLink
                        href={`/admin/pedidos/${o.id}`}
                        size="sm"
                        variant="ghost"
                        className="pointer-coarse:h-11"
                        aria-label={`Ver pedido #${o.number}`}
                      >
                        Ver pedido
                      </ButtonLink>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {shipTarget ? (
        <ShipDialog
          open
          onOpenChange={(open) => !open && setShipTarget(null)}
          title={`Despachar el pedido #${shipTarget.number}`}
          confirmLabel="Marcar enviado"
          onConfirm={(v) => moveOrder(shipTarget, "shipped", v)}
        />
      ) : null}
      {wa ? <WhatsAppDialog orderId={wa.orderId} phone={wa.phone} initialKind={wa.kind} context={wa.context} onClose={() => setWa(null)} /> : null}
    </section>
  );
}

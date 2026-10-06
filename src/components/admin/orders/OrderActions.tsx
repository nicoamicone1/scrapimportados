"use client";

import { ChevronDown, MessageCircle, Printer, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { changeOrderStatus, markOrdersPaid, updateOrderTracking } from "@/app/admin/(panel)/pedidos/actions";
import { PlanGate } from "@/components/admin/PlanGate";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import {
  canTransition,
  nextStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  statusActionLabel,
  type OrderStatus,
} from "@/lib/admin/order-utils";
import { toWhatsAppNumber, type WhatsAppMessageContext, type WhatsAppTemplateKind } from "@/lib/admin/whatsapp";
import { formatMoney } from "@/lib/money";

import { CancelDialog, ShipDialog, type ShipValues } from "./OrderDialogs";
import { WhatsAppDialog } from "./WhatsAppComposer";

/*
 * Acciones del detalle de un pedido. Un solo proveedor concentra los cambios
 * de estado, el cobro y el WhatsApp para que el "Siguiente paso" (arriba de
 * todo), el menú del encabezado y la tarjeta del cliente usen el mismo flujo.
 */

export interface OrderActionsProviderProps {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillment: string;
  paymentStatus: string;
  paymentMethodCode: string | null;
  /** Saldo pendiente (0 si está cancelado o pagado). */
  balance: number;
  currency: string;
  tracking: { carrier: string | null; number: string | null; url: string | null };
  phone: string | null;
  defaultWhatsApp: WhatsAppTemplateKind;
  whatsApp: WhatsAppMessageContext;
  children: ReactNode;
}

interface OrderActionsValue {
  props: Omit<OrderActionsProviderProps, "children">;
  loading: boolean;
  canWhatsApp: boolean;
  go: (to: OrderStatus) => void;
  confirmPayment: () => Promise<void>;
  markPaid: () => Promise<void>;
  reopen: () => void;
  editTracking: () => void;
  cancel: () => void;
  openWhatsApp: (kind?: WhatsAppTemplateKind) => void;
}

const Ctx = createContext<OrderActionsValue | null>(null);

function useOrderActions(): OrderActionsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("OrderActionsProvider ausente");
  return v;
}

export function OrderActionsProvider({ children, ...props }: OrderActionsProviderProps) {
  const { id, number, status, fulfillment, tracking, phone, defaultWhatsApp, whatsApp, balance, currency } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [shipMode, setShipMode] = useState<"ship" | "edit">("ship");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [wa, setWa] = useState<{ kind: WhatsAppTemplateKind } | null>(null);
  const pickup = fulfillment === "pickup";
  const canWhatsApp = Boolean(toWhatsAppNumber(phone));

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  const openWhatsApp = useCallback((kind?: WhatsAppTemplateKind) => setWa({ kind: kind ?? defaultWhatsApp }), [defaultWhatsApp]);

  const run = async (to: OrderStatus, extra: { reason?: string } & Partial<ShipValues> = {}) => {
    setBusy(true);
    const res = await changeOrderStatus({ orderId: id, status: to, ...extra });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    const stock = res.data.stockDelta;
    const message =
      to === "cancelled"
        ? `Pedido #${number} cancelado.${stock > 0 ? ` Volvieron ${stock} ${stock === 1 ? "unidad" : "unidades"} al stock.` : ""}`
        : to === "pending" && status === "cancelled"
          ? `Pedido #${number} reabierto.`
          : `Pedido #${number}: ${ORDER_STATUS_LABELS[to].toLowerCase()}.`;
    // Deshacer vuelve al estado anterior (no desde un cancelado: ahí se reabre).
    if (to !== "cancelled" && status !== "cancelled") {
      toast.success(message, {
        action: {
          label: "Deshacer",
          onClick: () => {
            void changeOrderStatus({ orderId: id, status }).then((r) => {
              if (r.ok) toast.success(`Pedido #${number} volvió a ${ORDER_STATUS_LABELS[status].toLowerCase()}.`);
              else toast.error(r.error);
              refresh();
            });
          },
        },
      });
    } else {
      toast.success(message);
    }
    refresh();
    return true;
  };

  const go = (to: OrderStatus) => {
    if (to === "cancelled") setCancelOpen(true);
    else if (to === "shipped" && !pickup) {
      setShipMode("ship");
      setShipOpen(true);
    } else void run(to);
  };

  const markPaid = async () => {
    setBusy(true);
    const res = await markOrdersPaid({ ids: [id] });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else toast.success(res.data.updated ? `Pedido #${number} pagado.` : "No había saldo pendiente.");
    refresh();
  };

  /** Comprobante recibido: cobra el saldo, confirma el pedido y ofrece avisar. */
  const confirmPayment = async () => {
    setBusy(true);
    const paid = await markOrdersPaid({ ids: [id] });
    if (!paid.ok) {
      setBusy(false);
      toast.error(paid.error);
      return;
    }
    const res = await changeOrderStatus({ orderId: id, status: "confirmed" });
    setBusy(false);
    if (!res.ok) {
      toast.warning(`El pedido #${number} quedó pagado, pero no se pudo confirmar: ${res.error}`);
    } else {
      toast.success(`Pago confirmado: ${formatMoney(balance, { currency })} cobrados.`, {
        action: canWhatsApp ? { label: "Avisar por WhatsApp", onClick: () => openWhatsApp("confirmed") } : undefined,
        duration: 10_000,
      });
    }
    refresh();
  };

  const saveTracking = async (v: ShipValues) => {
    const res = await updateOrderTracking({ orderId: id, ...v });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success("Seguimiento actualizado.");
    refresh();
    return true;
  };

  const value: OrderActionsValue = {
    props: { id, number, status, fulfillment, paymentStatus: props.paymentStatus, paymentMethodCode: props.paymentMethodCode, balance, currency, tracking, phone, defaultWhatsApp, whatsApp },
    loading: busy || pending,
    canWhatsApp,
    go,
    confirmPayment,
    markPaid,
    reopen: () => void run("pending"),
    editTracking: () => {
      setShipMode("edit");
      setShipOpen(true);
    },
    cancel: () => setCancelOpen(true),
    openWhatsApp,
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      {shipOpen ? (
        <ShipDialog
          open={shipOpen}
          onOpenChange={setShipOpen}
          title={shipMode === "ship" ? `Despachar el pedido #${number}` : `Seguimiento del pedido #${number}`}
          confirmLabel={shipMode === "ship" ? "Marcar enviado" : "Guardar seguimiento"}
          initial={{
            carrier: tracking.carrier ?? "",
            trackingNumber: tracking.number ?? "",
            trackingUrl: tracking.url ?? "",
          }}
          onConfirm={(v) => (shipMode === "ship" ? run("shipped", v) : saveTracking(v))}
        />
      ) : null}
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancelar el pedido #${number}`}
        confirmLabel="Cancelar pedido"
        onConfirm={(reason) => run("cancelled", { reason })}
      />
      {wa ? (
        <WhatsAppDialog orderId={id} phone={phone} initialKind={wa.kind} context={whatsApp} onClose={() => setWa(null)} />
      ) : null}
    </Ctx.Provider>
  );
}

/** Botones del encabezado: imprimir y "Más acciones" (el paso principal va en `OrderNextStep`). */
export function OrderHeaderActions() {
  const a = useOrderActions();
  const { status, fulfillment, id } = a.props;
  const pickup = fulfillment === "pickup";
  const next = nextStatus(status);
  const others = ORDER_STATUSES.filter((s) => s !== next && s !== "cancelled" && canTransition(status, s));

  return (
    <>
      {/* Remitos desde Starter (`orders.print`): en Free, el candado que lleva a Plan. */}
      <PlanGate feature="orders.print" mode="inline" label="Imprimir remito" className="max-sm:h-11">
        <ButtonLink href={`/admin/pedidos/imprimir?ids=${id}`} external icon={<Printer />} className="max-sm:h-11">
          Imprimir remito
        </ButtonLink>
      </PlanGate>
      {status === "cancelled" ? (
        <Button variant="primary" icon={<RotateCcw />} loading={a.loading} onClick={a.reopen} className="max-sm:h-11">
          Reabrir pedido
        </Button>
      ) : (
        <DropdownMenu
          width={232}
          trigger={
            <Button iconRight={<ChevronDown />} disabled={a.loading} className="max-sm:h-11">
              Más acciones
            </Button>
          }
        >
          {a.canWhatsApp ? (
            <DropdownItem icon={<MessageCircle />} onSelect={() => a.openWhatsApp()}>
              Mensaje por WhatsApp
            </DropdownItem>
          ) : null}
          {a.canWhatsApp ? <DropdownSeparator /> : null}
          {next || others.length ? <DropdownLabel>Cambiar estado</DropdownLabel> : null}
          {next ? <DropdownItem onSelect={() => a.go(next)}>{statusActionLabel(next, fulfillment, status)}</DropdownItem> : null}
          {others.map((s) => (
            <DropdownItem key={s} onSelect={() => a.go(s)}>
              {statusActionLabel(s, fulfillment, status)}
            </DropdownItem>
          ))}
          {!pickup && (status === "shipped" || status === "delivered") ? (
            <>
              <DropdownSeparator />
              <DropdownItem onSelect={a.editTracking}>Editar seguimiento</DropdownItem>
            </>
          ) : null}
          <DropdownSeparator />
          <DropdownItem danger onSelect={a.cancel}>
            Cancelar pedido
          </DropdownItem>
        </DropdownMenu>
      )}
    </>
  );
}

/** Botón "Mensaje por WhatsApp" de la tarjeta del cliente. */
export function OrderWhatsAppButton() {
  const a = useOrderActions();
  if (!a.canWhatsApp) {
    return <p className="text-xs text-adm-fg-muted">Sin un teléfono válido no se puede abrir WhatsApp.</p>;
  }
  return (
    <Button className="w-full max-sm:h-11" icon={<MessageCircle />} onClick={() => a.openWhatsApp()}>
      Mensaje por WhatsApp
    </Button>
  );
}

interface Step {
  title: string;
  text: string;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void; icon?: ReactNode };
}

/**
 * "Siguiente paso": lo que el comerciante tiene que hacer ahora con este
 * pedido, con su botón. Es la única acción primaria de la vista.
 */
export function OrderNextStep({ expiryLabel, journey }: { expiryLabel?: string | null; /** Recorrido del pedido (`OrderJourney`), arriba del paso. */ journey?: ReactNode }) {
  const a = useOrderActions();
  const { status, fulfillment, paymentStatus, paymentMethodCode, balance, currency } = a.props;
  const money = formatMoney(balance, { currency });
  const pickup = fulfillment === "pickup";
  const unpaid = (paymentStatus === "pending" || paymentStatus === "partial") && balance > 0;
  const next = nextStatus(status);
  const wa = (label: string, kind?: WhatsAppTemplateKind) =>
    a.canWhatsApp ? { label, icon: <MessageCircle />, onClick: () => a.openWhatsApp(kind) } : undefined;

  let step: Step | null = null;
  if (status === "pending") {
    if (unpaid && paymentMethodCode === "transfer") {
      step = {
        title: "Esperando el pago",
        text: `Falta cobrar ${money} por transferencia${expiryLabel ? `. ${expiryLabel}` : ""}. Al confirmarlo se registra el pago y el pedido pasa a confirmado.`,
        primary: { label: "Confirmar pago", onClick: () => void a.confirmPayment() },
        secondary: wa("Pedir el pago por WhatsApp", "payment_pending"),
      };
    } else if (unpaid) {
      step = {
        title: "Pedido nuevo",
        text: `Total a cobrar: ${money}. Confirmalo para empezar a prepararlo; el cobro lo registrás cuando llegue.`,
        primary: { label: "Confirmar pedido", onClick: () => a.go("confirmed") },
        secondary: { label: "Marcar pagado", onClick: () => void a.markPaid() },
      };
    } else {
      step = {
        title: "Pago recibido",
        text: "Falta confirmar el pedido para empezar a prepararlo.",
        primary: { label: "Confirmar pedido", onClick: () => a.go("confirmed") },
        secondary: wa("Avisar por WhatsApp", "confirmed"),
      };
    }
  } else if (next) {
    const label = statusActionLabel(next, fulfillment, status);
    const text =
      status === "confirmed"
        ? unpaid
          ? `Confirmado. Todavía falta cobrar ${money}.`
          : "Confirmado y pago. Cuando empieces a armarlo, pasalo a preparación."
        : status === "preparing"
          ? pickup
            ? "Cuando esté armado, marcalo como listo y avisale al cliente."
            : "Al despacharlo cargás el transporte y el seguimiento, y el cliente lo ve en su pedido."
          : pickup
            ? "Esperando que el cliente retire el pedido."
            : "En camino. Marcalo como entregado cuando llegue.";
    step = {
      title: status === "confirmed" ? "Para preparar" : status === "preparing" ? (pickup ? "En preparación" : "Para despachar") : pickup ? "Listo para retirar" : "En camino",
      text,
      primary: { label, onClick: () => a.go(next) },
      secondary:
        status === "shipped" || status === "preparing"
          ? wa(status === "shipped" ? "Avisar por WhatsApp" : "Mensaje por WhatsApp")
          : unpaid
            ? { label: "Marcar pagado", onClick: () => void a.markPaid() }
            : undefined,
    };
  } else if (status === "delivered" && unpaid) {
    step = {
      title: "Entregado con saldo pendiente",
      text: `Falta cobrar ${money}.`,
      primary: { label: "Marcar pagado", onClick: () => void a.markPaid() },
    };
  }
  if (!step && !journey) return null;

  return (
    <section aria-label={step ? "Siguiente paso" : "Recorrido del pedido"} className="mb-4 overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface shadow-adm-card">
      {journey ? <div className="adm-scroll overflow-x-auto px-3 pt-4 pb-3 sm:px-5">{journey}</div> : null}
      {step ? (
        <div className={journey ? "px-2 pb-2 sm:px-3 sm:pb-3" : "p-2 sm:p-3"}>
          <div className="eco-bubble flex flex-col gap-3 bg-adm-surface-2 p-4 [--eco-bubble-r:20px] sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.1em] text-adm-accent-2-ink uppercase">Siguiente paso</p>
              <p className="eco-display mt-1 text-[19px] leading-6 text-adm-fg">{step.title}</p>
              <p className="mt-1 max-w-prose text-[13px] text-adm-fg-muted">{step.text}</p>
            </div>
            <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row-reverse sm:items-center">
              {step.primary ? (
                <Button variant="primary" size="lg" className="h-11 px-5 text-[15px]" loading={a.loading} onClick={step.primary.onClick}>
                  {step.primary.label}
                </Button>
              ) : null}
              {step.secondary ? (
                <Button size="lg" className="max-sm:h-11" icon={step.secondary.icon} disabled={a.loading} onClick={step.secondary.onClick}>
                  {step.secondary.label}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

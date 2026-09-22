"use client";

import {
  Banknote,
  Boxes,
  CalendarClock,
  CircleX,
  Clock,
  Eye,
  MapPin,
  MessageCircle,
  MessageSquare,
  Printer,
  RefreshCw,
  ShoppingBag,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { addOrderNote } from "@/app/admin/(panel)/pedidos/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Input";
import { formatDateTime, formatRelative } from "@/lib/dates";

export interface TimelineEvent {
  id: string;
  type: string;
  message: string | null;
  createdAt: string;
  authorName: string | null;
  visibleToCustomer: boolean;
}

const ICONS: Record<string, LucideIcon> = {
  created: ShoppingBag,
  status_changed: RefreshCw,
  payment_status_changed: Banknote,
  payment_added: Banknote,
  note: MessageSquare,
  shipped: Truck,
  tracking_updated: MapPin,
  whatsapp_opened: MessageCircle,
  stock_adjusted: Boxes,
  cancelled: CircleX,
  printed: Printer,
  withdrawal_requested: Undo2,
  expired: Clock,
  reservation_extended: CalendarClock,
};

/** Actividad del pedido (más reciente arriba) + nota interna o visible al cliente. */
export function OrderTimeline({ orderId, events, timeZone }: { orderId: string; events: TimelineEvent[]; timeZone: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSaving(true);
    const res = await addOrderNote({ orderId, message, visibleToCustomer: visible });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setMessage("");
    toast.success(visible ? "Nota agregada. El cliente la ve en su pedido." : "Nota interna agregada.");
    startTransition(() => router.refresh());
  };

  return (
    <Card>
      <CardHeader title="Actividad" description="Lo marcado con el ojo lo ve el cliente en la página de su pedido." />
      <div className="border-b border-adm-border p-4">
        <label htmlFor="order-note" className="sr-only">
          Nueva nota
        </label>
        <Textarea
          id="order-note"
          rows={2}
          placeholder="Agregá una nota: qué hablaste con el cliente, qué falta, etc."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit();
          }}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <Switch
            checked={visible}
            onCheckedChange={setVisible}
            label="Visible para el cliente"
            className="flex-row-reverse justify-end gap-2"
          />
          <Button size="sm" variant="primary" onClick={submit} loading={saving} disabled={!message.trim()}>
            {visible ? "Publicar nota" : "Agregar nota interna"}
          </Button>
        </div>
      </div>
      <ol className="px-4 py-3">
        {events.map((e, i) => {
          const Icon = ICONS[e.type] ?? MessageSquare;
          return (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-1">
              {i < events.length - 1 ? (
                <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-adm-border" />
              ) : null}
              <span className="relative z-[1] mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-adm-border bg-adm-surface text-adm-fg-muted">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[13px] whitespace-pre-line text-adm-fg">{e.message ?? e.type}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-adm-fg-muted">
                  <time dateTime={e.createdAt} title={formatDateTime(e.createdAt, timeZone)} suppressHydrationWarning>
                    {formatRelative(e.createdAt)}
                  </time>
                  <span aria-hidden>·</span>
                  <span>{e.authorName ?? (e.type === "created" || e.type === "withdrawal_requested" ? "Cliente" : "Sistema")}</span>
                  {e.visibleToCustomer ? (
                    <span className="inline-flex items-center gap-1" title="Visible para el cliente">
                      <span aria-hidden>·</span>
                      <Eye className="size-3.5" aria-hidden />
                      <span className="sr-only">Visible para el cliente</span>
                    </span>
                  ) : null}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

import { Badge, STATUS_BADGES, type BadgeTone } from "@/components/ui/Badge";
import { expiryInfo } from "@/lib/admin/order-utils";
import { orderStatusLabel } from "@/lib/admin/order-utils";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/dates";

/* Piezas de presentación de pedidos (sirven en server y client components). */

export function OrderStatusBadge({ status, fulfillment }: { status: string; fulfillment?: string | null }) {
  const entry = (STATUS_BADGES.order as Record<string, { tone: BadgeTone }>)[status];
  return <Badge tone={entry?.tone ?? "neutral"}>{orderStatusLabel(status, fulfillment)}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const entry = (STATUS_BADGES.payment as Record<string, { label: string; tone: BadgeTone }>)[status];
  return <Badge tone={entry?.tone ?? "neutral"}>{entry?.label ?? status}</Badge>;
}

/** "hace 2 h" con la fecha absoluta en el tooltip nativo (DESIGN.md §7.5). */
export function RelativeTime({ value, timeZone, className }: { value: string; timeZone?: string; className?: string }) {
  return (
    <time dateTime={value} title={formatDateTime(value, timeZone)} className={className} suppressHydrationWarning>
      {formatRelative(value)}
    </time>
  );
}

/** "Vence en 5 h" (texto muted; en alerta si faltan menos de 6 h). */
export function ExpiryText({
  expiresAt,
  timeZone,
  className,
}: {
  expiresAt: string | null;
  timeZone?: string;
  className?: string;
}) {
  const info = expiryInfo(expiresAt);
  if (!info || !expiresAt) return null;
  return (
    <span
      title={`Reserva hasta el ${formatDateTime(expiresAt, timeZone)}`}
      suppressHydrationWarning
      className={cn("text-xs whitespace-nowrap", info.soon ? "font-medium text-adm-warning" : "text-adm-fg-muted", className)}
    >
      {info.label}
    </span>
  );
}

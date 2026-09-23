import Link from "next/link";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

import type { AbandonedFilter, AbandonedRow, AbandonedStatus } from "./data";

const STATUS: Record<AbandonedStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Pendiente", tone: "amber" },
  expired: { label: "Vencido", tone: "neutral" },
  reminded: { label: "Avisado", tone: "blue" },
  recovered: { label: "Recuperado", tone: "green" },
  unsubscribed: { label: "Baja", tone: "neutral" },
};

const EMPTY: Record<AbandonedFilter, { title: string; description: string }> = {
  todos: {
    title: "Todavía no hay carritos abandonados",
    description:
      "Cuando alguien deje su email en el checkout, tilde el aviso y no confirme el pedido, lo vas a ver acá con lo que tenía en el carrito.",
  },
  pendientes: {
    title: "No hay carritos esperando el aviso",
    description: "El mail sale solo dentro del día en que la persona deja el checkout. Pasadas 48 horas sin aviso, el carrito queda vencido.",
  },
  avisados: { title: "Todavía no avisamos a nadie", description: "Acá quedan los carritos a los que ya les llegó el mail, con la fecha." },
  recuperados: {
    title: "Todavía no hay carritos recuperados",
    description: "Cuando alguien termine el pedido después de guardar su carrito, lo ves acá con el número de pedido.",
  },
  bajas: { title: "Nadie se dio de baja", description: "Si alguien usa «No quiero recibir estos avisos» del mail, no le volvemos a escribir." },
};

function Time({ value }: { value: string }) {
  return (
    <time suppressHydrationWarning dateTime={value} title={formatDateTime(value)}>
      {formatRelative(value)}
    </time>
  );
}

function ItemsSummary({ items }: { items: AbandonedRow["items"] }) {
  if (!items.length) return <span className="text-adm-fg-muted">Sin productos</span>;
  const first = items.slice(0, 2);
  const rest = items.length - first.length;
  return (
    <div className="min-w-0">
      {first.map((i, idx) => (
        <div key={`${idx}-${i.name}`} className="truncate">
          <span className="tnum text-adm-fg-muted">{i.qty} ×</span> {i.name}
        </div>
      ))}
      {rest > 0 ? <div className="text-xs text-adm-fg-muted">y {rest === 1 ? "1 producto más" : `${rest} productos más`}</div> : null}
    </div>
  );
}

/** Bandeja de carritos abandonados (DESIGN.md §7.5 y §7.7). Sólo lectura: sin acciones masivas. */
export function AbandonedTable({
  rows,
  filter,
  available,
  currency,
}: {
  rows: AbandonedRow[];
  filter: AbandonedFilter;
  available: boolean;
  currency: string;
}) {
  const empty = EMPTY[filter];
  return (
    <Table>
      <THead>
        <tr>
          <TH>Cliente</TH>
          <TH>Carrito</TH>
          <TH numeric>Total</TH>
          <TH>Último cambio</TH>
          <TH>Estado</TH>
        </tr>
      </THead>
      <TBody>
        {!available ? (
          <TableEmpty
            colSpan={5}
            title="Los carritos abandonados todavía no están activos"
            description="Falta aplicar una actualización de la base de datos (migración 0020). Cuando esté, prendé el aviso en Configuración › Pagos y checkout."
          />
        ) : rows.length === 0 ? (
          <TableEmpty
            colSpan={5}
            title={empty.title}
            description={empty.description}
            action={
              filter === "todos" ? (
                <ButtonLink href="/admin/configuracion/pagos" size="sm">
                  Ir a Pagos y checkout
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          rows.map((r) => {
            const st = STATUS[r.status];
            return (
              <TR key={r.id} className="align-top">
                <TD className="max-w-64">
                  <div className="truncate font-medium">{r.email}</div>
                  {r.name ? <div className="truncate text-xs text-adm-fg-muted">{r.name}</div> : null}
                </TD>
                <TD className="max-w-0 min-w-56">
                  <ItemsSummary items={r.items} />
                </TD>
                <TD numeric className="whitespace-nowrap">
                  {r.items.length ? formatMoney(r.subtotal, { currency }) : "—"}
                </TD>
                <TD className="whitespace-nowrap" muted>
                  <Time value={r.updatedAt} />
                </TD>
                <TD className="whitespace-nowrap">
                  <Badge
                    tone={st.tone}
                    title={
                      r.remindedAt
                        ? `Mail enviado el ${formatDateTime(r.remindedAt)}`
                        : r.status === "expired"
                          ? "Pasaron más de 48 horas sin aviso: este carrito ya no se avisa."
                          : undefined
                    }
                  >
                    {st.label}
                  </Badge>
                  {r.order ? (
                    <Link href={`/admin/pedidos/${r.order.id}`} className="tnum ml-2 text-[13px] font-medium hover:underline">
                      #{r.order.number}
                    </Link>
                  ) : r.status === "reminded" && r.remindedAt ? (
                    <span className="ml-2 text-xs text-adm-fg-muted">
                      <Time value={r.remindedAt} />
                    </span>
                  ) : null}
                </TD>
              </TR>
            );
          })
        )}
      </TBody>
    </Table>
  );
}

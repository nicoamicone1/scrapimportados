"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { StockAlertFilter, StockAlertRow } from "@/lib/admin/inventory-alerts";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatNumber } from "@/lib/money";

import { deleteStockAlerts } from "./actions";

const EMPTY: Record<StockAlertFilter, { title: string; description: string }> = {
  pendientes: {
    title: "No hay avisos pendientes",
    description:
      "Cuando alguien deje su email en un producto agotado de la tienda, lo vas a ver acá. Al cargar stock de esa variante le llega un mail con el link al producto.",
  },
  avisados: {
    title: "Todavía no avisamos a nadie",
    description: "Acá quedan los avisos que ya salieron, con la fecha del mail.",
  },
  todos: {
    title: "Todavía no hay avisos de stock",
    description: "En la ficha de un producto agotado aparece «¿Querés que te avisemos cuando vuelva?». Los pedidos de aviso llegan a esta bandeja.",
  },
};

function Time({ value }: { value: string }) {
  return (
    <time suppressHydrationWarning dateTime={value} title={formatDateTime(value)}>
      {formatRelative(value)}
    </time>
  );
}

/** Bandeja de "Avisame cuando haya stock" (DESIGN.md §7.5 y §7.7). */
export function StockAlertsTable({ rows, filter, available }: { rows: StockAlertRow[]; filter: StockAlertFilter; available: boolean }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [target, setTarget] = useState<StockAlertRow | null>(null);

  const remove = async () => {
    if (!target) return;
    const res = await deleteStockAlerts({ ids: [target.id] });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Aviso borrado.");
    startTransition(() => router.refresh());
  };

  const empty = EMPTY[filter];

  return (
    <>
      <Table pending={refreshing || undefined}>
        <THead>
          <tr>
            <TH>Producto</TH>
            <TH>Email</TH>
            <TH>Pedido</TH>
            <TH numeric className="hidden md:table-cell">
              Stock hoy
            </TH>
            <TH>Estado</TH>
            <TH className="text-right">
              <span className="sr-only">Acciones</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {!available ? (
            <TableEmpty
              colSpan={6}
              title="Los avisos de stock todavía no están activos"
              description="Falta aplicar una actualización de la base de datos (migración 0016). Cuando esté, en la ficha de los productos agotados aparece el formulario y los pedidos llegan acá."
            />
          ) : rows.length === 0 ? (
            <TableEmpty colSpan={6} title={empty.title} description={empty.description} />
          ) : (
            rows.map((a) => {
              const title = a.variant && a.variant.title !== "Default" ? a.variant.title : null;
              return (
                <TR key={a.id}>
                  <TD className="max-w-0 min-w-56">
                    {a.product ? (
                      <Link href={`/admin/productos/${a.product.id}`} className="block truncate font-medium hover:underline">
                        {a.product.name}
                      </Link>
                    ) : (
                      <span className="text-adm-fg-muted">Producto borrado</span>
                    )}
                    <div className="truncate text-xs text-adm-fg-muted">
                      {a.variant ? (
                        <>
                          {title ?? "Variante única"}
                          {a.variant.sku ? <span className="font-mono"> · {a.variant.sku}</span> : null}
                        </>
                      ) : (
                        "Cualquier variante"
                      )}
                    </div>
                  </TD>
                  <TD className="max-w-64 truncate">{a.email}</TD>
                  <TD className="whitespace-nowrap" muted>
                    <Time value={a.createdAt} />
                  </TD>
                  <TD numeric className="hidden md:table-cell">
                    {a.variant ? (a.variant.trackInventory ? formatNumber(a.variant.stock) : "Sin seguimiento") : "—"}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {a.notifiedAt ? (
                      <Badge tone="green" title={`Mail enviado el ${formatDateTime(a.notifiedAt)}`}>
                        Avisado <Time value={a.notifiedAt} />
                      </Badge>
                    ) : (
                      <Badge tone="amber">Pendiente</Badge>
                    )}
                  </TD>
                  <TD className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setTarget(a)}>
                      Borrar
                    </Button>
                  </TD>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Borrar el aviso"
        description={
          target
            ? target.notifiedAt
              ? `El aviso a ${target.email} ya salió. Se borra de la bandeja.`
              : `${target.email} no va a recibir el mail cuando vuelva el stock.`
            : undefined
        }
        confirmLabel="Borrar aviso"
        cancelLabel="Volver"
        destructive
        onConfirm={remove}
      />
    </>
  );
}

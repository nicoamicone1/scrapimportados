import type { Metadata } from "next";
import Link from "next/link";

import { MovementsFilters } from "@/components/admin/inventory/MovementsFilters";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/display";
import { Pagination } from "@/components/ui/Pagination";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { getVariantLabel, listMovements, parseMovementFilters } from "@/lib/admin/inventory";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import { MOVEMENT_REASON_LABELS, type MovementReason } from "@/lib/schemas/inventory";

export const metadata: Metadata = { title: "Movimientos de stock" };

const REASON_TONES: Record<MovementReason, BadgeTone> = {
  sale: "blue",
  cancel: "neutral",
  restock: "green",
  adjustment: "neutral",
  return: "teal",
  import: "purple",
  correction: "amber",
};

export default async function MovementsPage({ searchParams }: PageProps<"/admin/inventario/movimientos">) {
  const params = (await searchParams) as Record<string, string | string[] | undefined>;
  const filters = parseMovementFilters(params);
  const [list, variant] = await Promise.all([
    listMovements(filters),
    filters.variantId ? getVariantLabel(filters.variantId) : Promise.resolve(null),
  ]);
  const hasFilters = Boolean(filters.variantId || filters.reason || filters.from || filters.to);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Inventario", href: "/admin/inventario" }, { label: "Movimientos" }]}
        title="Movimientos de stock"
        description={
          variant
            ? `Historial de ${variant.label}${variant.sku ? ` (${variant.sku})` : ""}.`
            : "Cada venta, cancelación, reposición y ajuste, con quién lo hizo y por qué."
        }
      />
      <MovementsFilters variantLabel={variant?.label ?? null} />
      <Table containerClassName="max-h-[calc(100dvh-15rem)] min-h-40">
        <THead>
          <tr>
            <TH>Fecha</TH>
            <TH>Producto</TH>
            <TH>Motivo</TH>
            <TH numeric>Cambio</TH>
            <TH numeric>Queda</TH>
            <TH className="hidden lg:table-cell">Nota</TH>
            <TH className="hidden md:table-cell">Pedido</TH>
            <TH className="hidden xl:table-cell">Usuario</TH>
          </tr>
        </THead>
        <TBody>
          {list.items.length === 0 ? (
            <TableEmpty
              colSpan={8}
              title={hasFilters ? "No hay movimientos con estos filtros." : "Todavía no hay movimientos."}
              description={hasFilters ? "Probá con otras fechas u otro motivo." : "Cuando se venda o se ajuste stock lo vas a ver acá."}
            />
          ) : (
            list.items.map((m) => (
              <TR key={m.id}>
                <TD className="whitespace-nowrap" muted>
                  <time suppressHydrationWarning dateTime={m.created_at} title={formatRelative(m.created_at)}>
                    {formatDateTime(m.created_at)}
                  </time>
                </TD>
                <TD className="max-w-0 min-w-48">
                  {m.product ? (
                    <Link href={`/admin/productos/${m.product.id}`} className="block truncate font-medium hover:underline">
                      {m.product.name}
                    </Link>
                  ) : (
                    <span className="text-adm-fg-muted">Variante borrada</span>
                  )}
                  {m.variant ? (
                    <Link
                      href={`/admin/inventario/movimientos?variante=${m.variant.id}`}
                      className="block truncate text-xs text-adm-fg-muted hover:text-adm-fg hover:underline"
                      title="Ver sólo esta variante"
                    >
                      {m.variant.title !== "Default" ? m.variant.title : "Variante única"}
                      {m.variant.sku ? <span className="font-mono"> · {m.variant.sku}</span> : null}
                    </Link>
                  ) : null}
                </TD>
                <TD>
                  <Badge tone={REASON_TONES[m.reason]}>{MOVEMENT_REASON_LABELS[m.reason]}</Badge>
                </TD>
                <TD numeric className={cn("font-medium", m.delta > 0 ? "text-adm-success" : "text-adm-danger")}>
                  {m.delta > 0 ? "+" : "−"}
                  {formatNumber(Math.abs(m.delta))}
                </TD>
                <TD numeric>{formatNumber(m.stock_after)}</TD>
                <TD className="hidden max-w-64 lg:table-cell" muted>
                  <span className="block truncate" title={m.note ?? undefined}>
                    {m.note ?? "—"}
                  </span>
                </TD>
                <TD className="hidden md:table-cell">
                  {m.order ? (
                    <Link href={`/admin/pedidos/${m.order.id}`} className="tnum text-adm-accent hover:underline">
                      #{m.order.number}
                    </Link>
                  ) : (
                    <span className="text-adm-fg-muted">—</span>
                  )}
                </TD>
                <TD className="hidden xl:table-cell" muted>
                  {m.actor ?? "Sistema"}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
      {list.total > 0 ? <Pagination page={list.page} perPage={list.perPage} total={list.total} /> : null}
    </>
  );
}

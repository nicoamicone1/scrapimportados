"use client";

import { Package, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { AdminCalibration, AdminProductSpec, AdminQuality } from "@/lib/admin/print3d-config";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber, formatPercent } from "@/lib/money";

import { deleteProductSpec } from "@/app/admin/(panel)/taller-3d/productos/actions";

import { formatDuration } from "./PriceSimulator";
import { ProductSpecDrawer, type SpecDrawerTarget } from "./ProductSpecDrawer";
import { specUnitCost, type SpecCostContext } from "./spec-cost";
import { Swatch } from "./Swatch";

/** Productos del catálogo que se imprimen: ficha, costo estimado y margen por unidad (TALLER-3D §5). */
export function ProductSpecsManager({
  specs,
  ctx,
  qualities,
  calibration,
}: {
  specs: AdminProductSpec[];
  ctx: SpecCostContext;
  qualities: AdminQuality[];
  calibration: AdminCalibration[];
}) {
  const [target, setTarget] = useState<SpecDrawerTarget | null>(null);
  const [toDelete, setToDelete] = useState<AdminProductSpec | null>(null);
  const ready = ctx.materials.length > 0 && qualities.length > 0;

  const rows = specs.map((s) => {
    const material = ctx.materials.find((m) => m.id === s.material_id);
    const color = material?.colors.find((c) => c.id === s.color_id) ?? null;
    const quality = qualities.find((q) => q.id === s.quality_id);
    const cost = specUnitCost(s, ctx);
    const margin = cost && s.price !== null ? s.price - cost.total : null;
    return { spec: s, material, color, quality, cost, margin };
  });
  const withMargin = rows.filter((r) => r.margin !== null && r.spec.price);
  const negative = withMargin.filter((r) => (r.margin ?? 0) < 0).length;
  const madeToOrder = specs.filter((s) => s.made_to_order).length;

  // Productos con ficha "para todas las variantes": no se ofrecen de nuevo en el buscador.
  const takenProductIds = specs.filter((s) => !s.variant_id).map((s) => s.product_id);

  const description =
    specs.length === 0
      ? "Los productos de tu catálogo que imprimís vos: costo real y margen por unidad."
      : [
          `${specs.length} ${specs.length === 1 ? "producto" : "productos"} con ficha`,
          madeToOrder ? `${madeToOrder} a pedido` : null,
          negative ? `${negative} a pérdida` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const remove = async () => {
    if (!toDelete) return;
    const res = await deleteProductSpec(toDelete.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Ficha quitada");
    setTarget(null);
  };

  return (
    <>
      <PageHeader
        title="Productos que se imprimen"
        description={description}
        section="store"
        icon={<Package />}
        actions={
          specs.length && ready ? (
            <Button variant="primary" icon={<Plus aria-hidden />} onClick={() => setTarget({ mode: "new" })}>
              Agregar producto
            </Button>
          ) : null
        }
      />

      {!ready ? (
        <EmptyState
          icon={<Package />}
          title="Primero cargá materiales y calidades"
          description="La ficha de cada producto dice en qué material y calidad se imprime. Configuralos y volvé."
          actions={
            <>
              <ButtonLink href="/admin/taller-3d/filamento" variant="primary">
                Ir a Filamento
              </ButtonLink>
              <ButtonLink href="/admin/taller-3d/configuracion">Ir a Configuración</ButtonLink>
            </>
          }
        />
      ) : specs.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="Ningún producto del catálogo tiene ficha de impresión"
          description="Si vendés llaveros, macetas o figuras que imprimís vos, cargá cuánto filamento y tiempo lleva cada uno: vas a ver cuánto ganás por unidad, y los «a pedido» muestran la fecha estimada en la tienda."
          actions={
            <Button variant="primary" icon={<Plus aria-hidden />} onClick={() => setTarget({ mode: "new" })}>
              Agregar producto
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Producto</TH>
              <TH>Se imprime en</TH>
              <TH numeric>Por unidad</TH>
              <TH numeric>Costo</TH>
              <TH numeric>Precio</TH>
              <TH numeric>Margen</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map(({ spec: s, material, color, quality, cost, margin }) => (
              <TR key={s.id} className="cursor-pointer" onClick={() => setTarget({ mode: "edit", spec: s })}>
                <TD className="max-w-[280px]">
                  <button
                    type="button"
                    className="block max-w-full truncate text-left font-medium hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTarget({ mode: "edit", spec: s });
                    }}
                  >
                    {s.product_name}
                  </button>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-adm-fg-muted">
                    {s.variant_title ?? "Todas las variantes"}
                    {s.made_to_order ? <Badge tone="blue">A pedido</Badge> : null}
                    {s.product_status === "archived" ? <Badge tone="neutral">Archivado</Badge> : null}
                  </span>
                </TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    {color ? <Swatch hex={color.hex} size={12} /> : null}
                    {material?.name ?? "—"}
                    {color ? ` ${color.name}` : ""}
                  </span>
                  <span className="block text-xs text-adm-fg-muted">{quality?.name ?? "—"}</span>
                </TD>
                <TD numeric>
                  {formatNumber(s.grams_per_unit, "es-AR", s.grams_per_unit % 1 ? 1 : 0)} g
                  <span className="block text-xs text-adm-fg-muted">
                    {formatDuration(s.minutes_per_unit)}
                    {s.units_per_plate > 1 ? ` · ${s.units_per_plate} por plato` : ""}
                  </span>
                </TD>
                <TD numeric title={cost ? `Filamento ${formatMoney(cost.material)} · luz ${formatMoney(cost.energy)} · amortización ${formatMoney(cost.amortization)} · post-proceso ${formatMoney(cost.labor)}` : undefined}>
                  {cost ? formatMoney(cost.total) : "—"}
                  {cost?.incomplete ? <span className="block text-xs text-adm-fg-muted">sin costo de bobinas</span> : null}
                </TD>
                <TD numeric>{s.price !== null ? formatMoney(s.price) : "—"}</TD>
                <TD numeric>
                  {margin !== null && s.price ? (
                    <>
                      <span className={cn("font-medium", margin < 0 ? "text-adm-danger" : "text-adm-success")}>{formatMoney(margin)}</span>
                      <span className="block text-xs text-adm-fg-muted">{formatPercent(Math.round((margin / s.price) * 100))}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <ProductSpecDrawer
        target={target}
        ctx={ctx}
        qualities={qualities}
        calibration={calibration}
        takenProductIds={takenProductIds}
        onOpenChange={(o) => !o && setTarget(null)}
        onDelete={(s) => setToDelete(s)}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete ? `¿Quitar la ficha de ${toDelete.product_name}?` : ""}
        description="El producto sigue a la venta; sólo deja de costearse y de mostrar la fecha de «a pedido»."
        confirmLabel="Quitar ficha"
        destructive
        onConfirm={remove}
      />
    </>
  );
}

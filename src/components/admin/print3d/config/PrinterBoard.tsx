"use client";

import { MoreHorizontal, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/display";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import type { AdminPrinter } from "@/lib/admin/print3d-config";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";

import { deletePrinter, setPrinterStatus } from "@/app/admin/(panel)/taller-3d/impresoras/actions";

import { BedDiagram } from "./BedDiagram";
import { machineHourCost } from "./math";
import { PRINTER_STATUS_LABELS, PRINTER_STATUSES, type PrinterStatus } from "./presets";
import { PrinterDrawer, type PrinterDrawerTarget } from "./PrinterDrawer";
import { SeedDefaultsButton } from "./SeedDefaultsButton";

const STATUS_TONE: Record<PrinterStatus, BadgeTone> = { active: "green", maintenance: "amber", inactive: "neutral" };
const STATUS_SHORT: Record<PrinterStatus, string> = { active: "Activa", maintenance: "Mant.", inactive: "Inactiva" };

function bedLabel([x, y, z]: [number, number, number]) {
  return `${formatNumber(x)} × ${formatNumber(y)} × ${formatNumber(z)} mm`;
}

/** Tablero de impresoras: tarjetas con la cama dibujada a escala (TALLER-3D §5). */
export function PrinterBoard({ printers, kwhPrice }: { printers: AdminPrinter[]; kwhPrice: number }) {
  const [target, setTarget] = useState<PrinterDrawerTarget | null>(null);
  const [toDelete, setToDelete] = useState<AdminPrinter | null>(null);

  const remove = async () => {
    if (!toDelete) return;
    const res = await deletePrinter(toDelete.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Borraste ${toDelete.name}`);
    setTarget(null);
  };

  return (
    <>
      {printers.length === 0 ? (
        <EmptyState
          icon={<Printer />}
          title="Todavía no cargaste impresoras"
          description="Con la cama de cada una el cotizador sabe qué piezas entran, y con el consumo y lo que te costó calculamos cuánto te sale la hora de máquina."
          actions={
            <>
              <Button variant="primary" icon={<Plus aria-hidden />} onClick={() => setTarget({ mode: "new" })}>
                Agregar impresora
              </Button>
              <SeedDefaultsButton variant="secondary" />
            </>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {printers.map((p) => (
            <PrinterCard
              key={p.id}
              printer={p}
              kwhPrice={kwhPrice}
              onEdit={() => setTarget({ mode: "edit", printer: p })}
              onDelete={() => setToDelete(p)}
            />
          ))}
          <button
            type="button"
            onClick={() => setTarget({ mode: "new" })}
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-adm border border-dashed border-adm-input-border text-[13px] text-adm-fg-muted transition-colors hover:border-adm-input-border-hover hover:bg-adm-surface hover:text-adm-fg"
          >
            <Plus className="size-5" aria-hidden />
            Agregar impresora
          </button>
        </div>
      )}

      <PrinterDrawer
        target={target}
        kwhPrice={kwhPrice}
        takenColors={printers.map((p) => p.color.toUpperCase())}
        onOpenChange={(o) => !o && setTarget(null)}
        onDelete={(p) => setToDelete(p)}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete ? `¿Borrar ${toDelete.name}?` : ""}
        description="Si ya imprimió trabajos no se puede borrar: pasala a Inactiva y queda el historial."
        confirmLabel="Borrar impresora"
        destructive
        onConfirm={remove}
      />
    </>
  );
}

function PrinterCard({
  printer: p,
  kwhPrice,
  onEdit,
  onDelete,
}: {
  printer: AdminPrinter;
  kwhPrice: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<PrinterStatus | null>(null);
  const status = optimistic ?? p.status;
  const hour = machineHourCost(p, kwhPrice);
  const life = p.lifetime_hours > 0 ? Math.min(1, p.hours_used / p.lifetime_hours) : 0;

  const changeStatus = (next: PrinterStatus) => {
    if (next === status) return;
    setOptimistic(next);
    startTransition(async () => {
      const res = await setPrinterStatus(p.id, next);
      setOptimistic(null);
      if (!res.ok) toast.error(res.error);
    });
  };

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface",
        status !== "active" && "bg-adm-surface/70",
      )}
    >
      <span aria-hidden className="h-1 w-full" style={{ backgroundColor: p.color }} />
      <header className="flex items-start gap-3 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] leading-6 font-semibold text-adm-fg">
            <button type="button" onClick={onEdit} className="max-w-full truncate text-left hover:underline">
              {p.name}
            </button>
          </h3>
          <p className="truncate text-[13px] text-adm-fg-muted">{[p.brand, p.model].filter(Boolean).join(" ") || "Sin modelo"}</p>
        </div>
        <Badge tone={STATUS_TONE[status]}>{PRINTER_STATUS_LABELS[status]}</Badge>
        <DropdownMenu
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${p.name}`} className="-mr-1.5">
              <MoreHorizontal aria-hidden />
            </Button>
          }
        >
          <DropdownItem onSelect={onEdit} icon={<Pencil aria-hidden />}>
            Editar
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem onSelect={onDelete} icon={<Trash2 aria-hidden />} danger>
            Borrar
          </DropdownItem>
        </DropdownMenu>
      </header>

      <div className="flex items-center gap-4 px-4 py-3">
        <BedDiagram bed={p.bed} color={p.color} className={cn("w-24 shrink-0", status !== "active" && "opacity-60")} />
        <dl className="grid min-w-0 flex-1 gap-1.5 text-[13px]">
          <div>
            <dt className="sr-only">Cama</dt>
            <dd className="tnum font-medium text-adm-fg">{bedLabel(p.bed)}</dd>
          </div>
          <div className="flex flex-wrap gap-1">
            <dt className="sr-only">Materiales</dt>
            {p.materials.map((m) => (
              <dd key={m} className="rounded-adm-sm bg-adm-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-adm-fg-muted">
                {m}
              </dd>
            ))}
          </div>
          <div className="text-adm-fg-muted">
            <dt className="sr-only">Boquilla y consumo</dt>
            <dd className="tnum">
              Boquilla {formatNumber(p.nozzle_mm, "es-AR", 1)} mm · {formatNumber(p.watts)} W
            </dd>
          </div>
        </dl>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-baseline justify-between text-xs text-adm-fg-muted">
          <span>
            <span className="tnum font-medium text-adm-fg">{formatNumber(p.hours_used)} h</span> de uso
          </span>
          <span className="tnum">vida útil {formatNumber(p.lifetime_hours)} h</span>
        </div>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-adm-surface-2"
          role="meter"
          aria-label="Horas usadas sobre la vida útil"
          aria-valuemin={0}
          aria-valuemax={p.lifetime_hours}
          aria-valuenow={p.hours_used}
        >
          <div className="h-full rounded-full bg-adm-fg/70" style={{ width: `${life * 100}%` }} />
        </div>
        {p.open_jobs > 0 ? (
          <p className="mt-2 text-xs text-adm-fg-muted">
            {p.open_jobs} {p.open_jobs === 1 ? "trabajo en cola" : "trabajos en cola"}
          </p>
        ) : null}
      </div>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-adm-border bg-adm-table-head px-4 py-2.5">
        <p className="tnum text-[13px] text-adm-fg" title={`Luz ${formatMoney(hour.energy)} + amortización ${formatMoney(hour.amortization)} por hora`}>
          Hora-máquina <strong className="font-semibold">{formatMoney(hour.total)}</strong>
        </p>
        <div role="radiogroup" aria-label={`Estado de ${p.name}`} className="inline-flex rounded-adm border border-adm-input-border bg-adm-surface p-0.5">
          {PRINTER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              disabled={pending}
              onClick={() => changeStatus(s)}
              className={cn(
                "h-9 rounded-[4px] px-2.5 text-xs transition-colors sm:h-6 sm:px-2",
                status === s ? "bg-adm-fg text-adm-surface" : "text-adm-fg-muted hover:text-adm-fg",
              )}
            >
              {STATUS_SHORT[s]}
            </button>
          ))}
        </div>
      </footer>
    </article>
  );
}

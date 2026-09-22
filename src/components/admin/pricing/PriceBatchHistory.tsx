"use client";

import { ChevronDown, ChevronRight, Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";

import { loadBatchChanges, undoPriceBatch } from "@/app/admin/(panel)/precios/actions";
import { toast } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { PriceBatchRow, PriceChangeDetail } from "@/lib/admin/pricing";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatNumber } from "@/lib/money";

import { PriceChange } from "./shared";

const SOURCE_LABELS: Record<string, string> = {
  bulk: "Masivo",
  import: "Importación",
  other: "Otro",
};

export function PriceBatchHistory({ rows }: { rows: PriceBatchRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, PriceChangeDetail[] | "loading" | { error: string }>>({});
  const [undoTarget, setUndoTarget] = useState<PriceBatchRow | null>(null);

  const toggle = async (batchId: string) => {
    const next = !open[batchId];
    setOpen((o) => ({ ...o, [batchId]: next }));
    if (next && !details[batchId]) {
      setDetails((d) => ({ ...d, [batchId]: "loading" }));
      const res = await loadBatchChanges(batchId);
      setDetails((d) => ({ ...d, [batchId]: res.ok ? res.data : { error: res.error } }));
    }
  };

  const undo = async () => {
    if (!undoTarget) return;
    const res = await undoPriceBatch(undoTarget.batchId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { restored, skipped } = res.data;
    toast.success(
      skipped
        ? `Se restauraron ${formatNumber(restored)} variantes. ${formatNumber(skipped)} no se pudieron restaurar porque su precio cambió después.`
        : `Listo: se restauraron ${formatNumber(restored)} variantes.`,
      { duration: 8000 },
    );
    setDetails((d) => {
      const copy = { ...d };
      delete copy[undoTarget.batchId];
      return copy;
    });
    setOpen((o) => ({ ...o, [undoTarget.batchId]: false }));
    router.refresh();
  };

  return (
    <>
      <Table>
        <THead>
          <tr>
            <TH className="w-10">
              <span className="sr-only">Detalle</span>
            </TH>
            <TH>Fecha</TH>
            <TH>Regla</TH>
            <TH>Alcance</TH>
            <TH numeric>Variantes</TH>
            <TH>Usuario</TH>
            <TH>Estado</TH>
            <TH className="w-28">
              <span className="sr-only">Acciones</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((row) => {
            const isOpen = Boolean(open[row.batchId]);
            const detail = details[row.batchId];
            return (
              <Fragment key={row.batchId}>
                <TR selected={isOpen}>
                  <TD>
                    <button
                      type="button"
                      onClick={() => void toggle(row.batchId)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? "Ocultar detalle" : "Ver detalle por variante"}
                      className="inline-flex size-7 items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg"
                    >
                      {isOpen ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                    </button>
                  </TD>
                  <TD className="whitespace-nowrap">
                    <time suppressHydrationWarning dateTime={row.createdAt} title={formatDateTime(row.createdAt)}>
                      {formatRelative(row.createdAt)}
                    </time>
                  </TD>
                  <TD className="max-w-[340px]">
                    <span className="line-clamp-2">{row.ruleSummary || SOURCE_LABELS[row.source] || "—"}</span>
                  </TD>
                  <TD className="max-w-[260px] text-adm-fg-muted">
                    <span className="line-clamp-2">{row.scopeSummary || "—"}</span>
                  </TD>
                  <TD numeric>{formatNumber(row.variantCount)}</TD>
                  <TD className="max-w-[180px] truncate text-adm-fg-muted">{row.createdByEmail ?? "—"}</TD>
                  <TD>
                    {row.undoneAt ? (
                      <Badge
                        tone="neutral"
                        title={row.undoResult ? `${row.undoResult.restored} restauradas, ${row.undoResult.skipped} sin tocar` : undefined}
                      >
                        Deshecho
                      </Badge>
                    ) : (
                      <Badge tone="green">Aplicado</Badge>
                    )}
                  </TD>
                  <TD className="text-right">
                    {!row.undoneAt ? (
                      <Button size="sm" icon={<Undo2 aria-hidden />} onClick={() => setUndoTarget(row)}>
                        Deshacer
                      </Button>
                    ) : row.undoResult?.skipped ? (
                      <span className="text-xs text-adm-fg-muted">{formatNumber(row.undoResult.skipped)} sin restaurar</span>
                    ) : null}
                  </TD>
                </TR>
                {isOpen ? (
                  <tr>
                    <td colSpan={8} className="border-b border-adm-border bg-adm-surface-2/50 px-4 py-3">
                      {detail === "loading" || detail === undefined ? (
                        <p className="inline-flex items-center gap-2 text-[13px] text-adm-fg-muted">
                          <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando variantes…
                        </p>
                      ) : "error" in detail ? (
                        <p className="text-[13px] text-adm-danger">{detail.error}</p>
                      ) : (
                        <BatchDetail changes={detail} undone={Boolean(row.undoneAt)} />
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </TBody>
      </Table>

      <ConfirmDialog
        open={undoTarget !== null}
        onOpenChange={(o) => !o && setUndoTarget(null)}
        title="Deshacer cambio de precios"
        description={
          undoTarget
            ? `Vuelve a los precios anteriores en las ${formatNumber(undoTarget.variantCount)} variantes de este cambio. Si alguna se modificó después, se deja como está.`
            : undefined
        }
        confirmLabel="Deshacer cambio"
        destructive
        onConfirm={undo}
      >
        {undoTarget ? <p className="text-[13px]">{undoTarget.ruleSummary}</p> : null}
      </ConfirmDialog>
    </>
  );
}

function BatchDetail({ changes, undone }: { changes: PriceChangeDetail[]; undone: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? changes : changes.slice(0, 50);
  return (
    <div>
      <div className="adm-scroll max-h-[420px] overflow-auto rounded-adm border border-adm-border bg-adm-surface">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 bg-adm-surface-2">
            <tr>
              <TH>Producto</TH>
              <TH>SKU</TH>
              <TH numeric>Precio</TH>
              <TH numeric>Tachado</TH>
              <TH numeric>Precio actual</TH>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const stillSame = c.currentPrice === c.newPrice && c.currentCompareAt === c.newCompareAt;
              return (
                <tr key={c.id}>
                  <TD className="max-w-[320px]">
                    <span className="block truncate font-medium">{c.productName}</span>
                    {c.variantTitle && c.variantTitle !== "Default" ? (
                      <span className="block truncate text-xs text-adm-fg-muted">{c.variantTitle}</span>
                    ) : null}
                  </TD>
                  <TD className="font-mono text-xs text-adm-fg-muted">{c.sku ?? "—"}</TD>
                  <TD numeric>
                    <PriceChange from={c.oldPrice} to={c.newPrice} />
                  </TD>
                  <TD numeric>
                    <PriceChange from={c.oldCompareAt} to={c.newCompareAt} />
                  </TD>
                  <TD numeric>
                    <PriceChange from={c.currentPrice} to={c.currentPrice} />
                    {!undone && !stillSame ? (
                      <span className="ml-1.5 text-xs text-adm-warning" title="Se modificó después de este cambio: deshacer no la toca">
                        cambió después
                      </span>
                    ) : null}
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {changes.length > 50 && !showAll ? (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShowAll(true)}>
          Ver las {formatNumber(changes.length)} variantes
        </Button>
      ) : null}
    </div>
  );
}

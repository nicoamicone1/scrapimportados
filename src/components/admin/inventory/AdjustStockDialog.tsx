"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/money";
import { MANUAL_REASONS, MOVEMENT_REASON_LABELS, type ManualReason } from "@/lib/schemas/inventory";

import { adjustStock, bulkAdjustStock } from "@/app/admin/(panel)/inventario/actions";

export type AdjustTarget =
  | { kind: "single"; variantId: string; label: string; stock: number }
  | { kind: "bulk"; variantIds: string[] };

const REASON_HINTS: Record<ManualReason, string> = {
  restock: "Entró mercadería.",
  adjustment: "Cambio manual general.",
  return: "Un cliente devolvió el producto.",
  correction: "Se corrige un error de carga o de recuento.",
};

/** Ajuste de stock: sumar/restar N o fijar en N, con motivo y nota (queda en movimientos). */
export function AdjustStockDialog({
  target,
  onOpenChange,
  onDone,
}: {
  target: AdjustTarget | null;
  onOpenChange: (open: boolean) => void;
  onDone?: (stock?: number) => void;
}) {
  const [mode, setMode] = useState<"delta" | "set">("delta");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState<ManualReason>("restock");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lastTarget, setLastTarget] = useState<AdjustTarget | null>(null);

  if (target !== lastTarget) {
    setLastTarget(target);
    if (target) {
      setMode("delta");
      setValue("");
      setReason("restock");
      setNote("");
      setError(null);
    }
  }

  const parsed = /^-?\d+$/.test(value.trim()) ? Number.parseInt(value.trim(), 10) : Number.NaN;
  const current = target?.kind === "single" ? target.stock : null;
  const result = current === null || !Number.isFinite(parsed) ? null : mode === "set" ? parsed : current + parsed;

  const step = (d: number) => {
    const base = Number.isFinite(parsed) ? parsed : 0;
    setValue(String(mode === "set" ? Math.max(0, base + d) : base + d));
  };

  const submit = async () => {
    if (!target) return;
    if (!Number.isFinite(parsed)) {
      setError("Ingresá un número entero.");
      return;
    }
    if (mode === "delta" && parsed === 0) {
      setError("Ingresá una cantidad distinta de 0.");
      return;
    }
    if (mode === "set" && parsed < 0) {
      setError("El stock no puede quedar negativo.");
      return;
    }
    setPending(true);
    const payload = { mode, value: parsed, reason, note };
    const res =
      target.kind === "single"
        ? await adjustStock({ ...payload, variantId: target.variantId })
        : await bulkAdjustStock({ ...payload, variantIds: target.variantIds });
    setPending(false);
    if (!res.ok) {
      setError(res.fieldErrors?.value?.[0] ?? null);
      toast.error(res.error);
      return;
    }
    if ("stock" in res.data) {
      toast.success(`Stock actualizado: ${formatNumber(res.data.stock)}`);
      onDone?.(res.data.stock);
    } else {
      toast.success(`Stock ajustado en ${formatNumber(res.data.count)} variante${res.data.count === 1 ? "" : "s"}`);
      onDone?.();
    }
    onOpenChange(false);
  };

  const title = target?.kind === "bulk" ? `Ajustar stock de ${target.variantIds.length} variantes` : "Ajustar stock";

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      dismissable={!pending}
      title={title}
      description={target?.kind === "single" ? `${target.label} · Stock actual: ${formatNumber(target.stock)}` : "El ajuste se aplica a cada variante elegida."}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={pending}>
            Aplicar ajuste
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div role="radiogroup" aria-label="Tipo de ajuste" className="grid grid-cols-2 gap-1 rounded-adm bg-adm-surface-2 p-1">
          {(
            [
              ["delta", "Sumar o restar"],
              ["set", "Fijar cantidad"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                "h-8 rounded-[4px] text-sm",
                mode === m ? "bg-adm-surface font-medium text-adm-fg shadow-[0_0_0_1px_var(--adm-border)]" : "text-adm-fg-muted hover:text-adm-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Field
          label={mode === "set" ? "Nuevo stock" : "Cantidad"}
          hint={
            mode === "delta"
              ? `Usá números negativos para restar (ej. -2).${result !== null ? ` Queda en ${formatNumber(result)}.` : ""}`
              : result !== null && current !== null
                ? `Diferencia: ${result - current > 0 ? "+" : ""}${formatNumber(result - current)}.`
                : "Cada variante queda con esta cantidad."
          }
          error={error}
        >
          <div className="flex items-center gap-2">
            <Button size="icon" aria-label="Uno menos" onClick={() => step(-1)}>
              <Minus />
            </Button>
            <Input
              inputMode="numeric"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              className="tnum w-28 text-right"
              autoFocus
              placeholder="0"
            />
            <Button size="icon" aria-label="Uno más" onClick={() => step(1)}>
              <Plus />
            </Button>
          </div>
        </Field>

        <Field label="Motivo" hint={REASON_HINTS[reason]}>
          <Select
            value={reason}
            onChange={(e) => setReason(e.target.value as ManualReason)}
            options={MANUAL_REASONS.map((r) => ({ value: r, label: MOVEMENT_REASON_LABELS[r] }))}
          />
        </Field>
        <Field label="Nota" hint="Opcional. Queda en el historial de movimientos.">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ej.: remito 4521 del proveedor" />
        </Field>
      </form>
    </Dialog>
  );
}

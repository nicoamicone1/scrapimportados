"use client";

import { Scale, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { AdminColor, AdminSpool } from "@/lib/admin/print3d-config";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/money";

import { adjustSpool, deleteSpool, markSpoolEmpty } from "@/app/admin/(panel)/taller-3d/filamento/actions";

import { spoolFill } from "./math";
import { SPOOL_STATUS_LABELS } from "./presets";
import { SpoolGlyph } from "./SpoolGlyph";

export interface SpoolTarget {
  spool: AdminSpool;
  color: AdminColor;
  materialName: string;
}

/** Tara típica del carrete vacío. */
const TARES = [
  { label: "Cartón", grams: 150 },
  { label: "Plástico", grams: 250 },
];

const str = (n: number) => String(n).replace(".", ",");
const toNum = (s: string) => {
  const v = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : Number.NaN;
};

/** Ficha de una bobina: pesaje (gramos que quedan o peso − tara), costo y acciones. */
export function SpoolDialog({ target, onOpenChange }: { target: SpoolTarget | null; onOpenChange: (open: boolean) => void }) {
  const [mode, setMode] = useState<"grams" | "scale">("grams");
  const [grams, setGrams] = useState("");
  const [weight, setWeight] = useState("");
  const [tare, setTare] = useState("250");
  const [cost, setCost] = useState("");
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, setPending] = useState<null | "save" | "empty">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastTarget, setLastTarget] = useState<SpoolTarget | null>(null);

  // Se conserva la última bobina para que el dialog no quede vacío mientras se cierra.
  if (target && target !== lastTarget) {
    setLastTarget(target);
    setMode("grams");
    setGrams(str(target.spool.remaining_grams));
    setWeight("");
    setCost(str(target.spool.cost));
    setBrand(target.spool.brand ?? "");
    setNotes(target.spool.notes ?? "");
    setErrors({});
  }

  const shown = target ?? lastTarget;
  if (!shown) return null;
  const { spool, color, materialName } = shown;
  const remaining = mode === "grams" ? toNum(grams) : Math.max(0, toNum(weight) - toNum(tare));
  const preview = Number.isFinite(remaining) ? Math.min(remaining, spool.net_grams) : spool.remaining_grams;
  const costPerKg = spool.net_grams > 0 ? (spool.cost / spool.net_grams) * 1000 : 0;

  const save = async () => {
    if (!Number.isFinite(remaining)) {
      setErrors({ remaining_grams: [mode === "grams" ? "Ingresá los gramos que quedan." : "Ingresá el peso y la tara."] });
      return;
    }
    setPending("save");
    const res = await adjustSpool({ id: spool.id, remaining_grams: Math.round(remaining * 10) / 10, cost, brand, notes });
    setPending(null);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(`Listo: quedan ${formatNumber(Math.round(remaining))} g de ${color.name}`);
    onOpenChange(false);
  };

  const empty = async () => {
    setPending("empty");
    const res = await markSpoolEmpty(spool.id);
    setPending(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Bobina marcada como vacía");
    onOpenChange(false);
  };

  const remove = async () => {
    const res = await deleteSpool(spool.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Bobina borrada");
    onOpenChange(false);
  };

  return (
    <>
      <Dialog
        open={Boolean(target)}
        onOpenChange={onOpenChange}
        size="md"
        title={`${materialName} · ${color.name}`}
        description={[spool.brand, spool.purchased_at ? `comprada el ${formatDate(spool.purchased_at)}` : null].filter(Boolean).join(" · ") || undefined}
        dismissable={!pending}
        footer={
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Borrar bobina"
              className="mr-auto text-adm-danger hover:text-adm-danger"
              onClick={() => setConfirmDelete(true)}
              disabled={Boolean(pending)}
            >
              <Trash2 aria-hidden />
            </Button>
            {spool.status !== "empty" ? (
              <Button onClick={() => void empty()} loading={pending === "empty"} disabled={pending === "save"}>
                Marcar vacía
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => void save()} loading={pending === "save"} disabled={pending === "empty"}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-4">
          <SpoolGlyph hex={color.hex} fill={spoolFill(preview, spool.net_grams)} className="size-20 shrink-0" />
          <div className="min-w-0 text-[13px]">
            <p className="tnum text-xl font-semibold text-adm-fg">
              {formatNumber(Math.round(preview))} g
              <span className="ml-1 text-sm font-normal text-adm-fg-muted">de {formatNumber(spool.net_grams)} g</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-adm-fg-muted">
              <Badge tone={spool.status === "empty" ? "red" : spool.status === "open" ? "blue" : "neutral"}>{SPOOL_STATUS_LABELS[spool.status]}</Badge>
              {spool.cost > 0 ? <span className="tnum">{formatMoney(costPerKg)}/kg</span> : <span>Sin costo cargado</span>}
            </div>
          </div>
        </div>

        <div className="mt-4 inline-flex rounded-adm border border-adm-input-border bg-adm-surface p-0.5" role="radiogroup" aria-label="Cómo cargar lo que queda">
          {(
            [
              ["grams", "Gramos que quedan"],
              ["scale", "Pesar en balanza"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2.5 text-[13px] transition-colors [&_svg]:size-3.5",
                mode === value ? "bg-adm-fg text-adm-surface" : "text-adm-fg-muted hover:text-adm-fg",
              )}
            >
              {value === "scale" ? <Scale aria-hidden /> : null}
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {mode === "grams" ? (
            <Field label="Quedan" error={errors.remaining_grams}>
              <Input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} trailing="g" autoFocus />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pesa (con carrete)" error={errors.remaining_grams}>
                <Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} trailing="g" autoFocus />
              </Field>
              <Field label="Tara del carrete" hint={TARES.map((t) => `${t.label} ≈ ${t.grams} g`).join(" · ")}>
                <Input inputMode="decimal" value={tare} onChange={(e) => setTare(e.target.value)} trailing="g" />
              </Field>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Costo de la bobina" error={errors.cost}>
            <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} leading="$" />
          </Field>
          <Field label="Marca" error={errors.brand}>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Nota" className="col-span-2" error={errors.notes}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Secada, lote, humedad…" />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Borrar esta bobina?"
        description="Usalo si la cargaste por error. Si ya se usó en trabajos, marcala vacía: así queda el costo real de esos pedidos."
        confirmLabel="Borrar bobina"
        destructive
        onConfirm={remove}
      />
    </>
  );
}

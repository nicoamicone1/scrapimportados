"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { isModuleStatus, MODULE_STATUS_LABELS, MODULE_STATUSES, type ModuleCode, type ModuleStatus } from "@/lib/modules/registry";

import { setStoreModule } from "./actions";

export interface ModulesPanelItem {
  code: ModuleCode;
  name: string;
  tagline: string;
  /** Precio informativo ya formateado ("$ 24.999/mes") o null. */
  price: string | null;
  isPublic: boolean;
  /** Fila actual (`null` = nunca se activó). */
  current: {
    status: ModuleStatus;
    /** "YYYY-MM-DD" o "". */
    expiresAt: string;
    notes: string;
    /** Texto del estado vigente ("Activa", "Prueba hasta el 12/10/2026", "Venció el …"). */
    stateLabel: string;
    stateTone: BadgeTone;
    /** "Activada el 01/09/2026". */
    since: string | null;
  } | null;
}

export interface ModulesPanelProps {
  storeId: string;
  items: ModulesPanelItem[];
  /** `false` si falta la migración 0022 (no hay tablas todavía). */
  available: boolean;
}

const STATUS_OPTIONS = MODULE_STATUSES.map((s) => ({ value: s, label: MODULE_STATUS_LABELS[s] }));

function inDays(days: number): string {
  // Fecha local de Buenos Aires (UTC-3, sin horario de verano).
  return new Date(Date.now() - 3 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
}

function ModuleRow({ storeId, item }: { storeId: string; item: ModulesPanelItem }) {
  const router = useRouter();
  const [status, setStatus] = useState<ModuleStatus>(item.current?.status ?? "disabled");
  const [expiresAt, setExpiresAt] = useState(item.current?.expiresAt ?? "");
  const [notes, setNotes] = useState(item.current?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const save = (next?: { status: ModuleStatus; expiresAt: string }) =>
    startTransition(async () => {
      const payload = { storeId, code: item.code, status: next?.status ?? status, expiresAt: next?.expiresAt ?? expiresAt, notes };
      const res = await setStoreModule(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      if (next) {
        setStatus(next.status);
        setExpiresAt(next.expiresAt);
      }
      toast.success(`${item.name}: guardado.`);
      router.refresh();
    });

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-adm-fg">{item.name}</span>
        <span className="font-mono text-xs text-adm-fg-muted">{item.code}</span>
        {item.current ? <Badge tone={item.current.stateTone}>{item.current.stateLabel}</Badge> : <Badge tone="neutral">Nunca activada</Badge>}
        {!item.isPublic ? <Badge tone="neutral" dot={false}>Oculta en el catálogo</Badge> : null}
      </div>
      <p className="mt-0.5 text-[13px] text-adm-fg-muted">
        {item.tagline}
        {item.price ? ` · ${item.price} (se cobra por fuera)` : ""}
        {item.current?.since ? ` · ${item.current.since}` : ""}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_11rem_minmax(0,1fr)]">
        <Field label="Estado">
          <Select value={status} onChange={(e) => {
              const next = e.target.value;
              if (isModuleStatus(next)) setStatus(next);
            }} options={STATUS_OPTIONS} />
        </Field>
        <Field label="Vence" hint="Vacío = sin vencimiento." error={errors.expiresAt}>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={status === "disabled"} />
        </Field>
        <Field label="Nota interna" hint="Sólo la ve la plataforma." error={errors.notes}>
          <Input value={notes} maxLength={500} placeholder="Ej.: cobrado por transferencia hasta octubre" onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" loading={pending} onClick={() => save()}>
          Guardar
        </Button>
        {item.current?.status !== "active" ? (
          <Button disabled={pending} onClick={() => save({ status: "trial", expiresAt: inDays(14) })}>
            Prueba de 14 días
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** Apps de la tienda (superadmin): estado, vencimiento y nota por app. */
export function ModulesPanel({ storeId, items, available }: ModulesPanelProps) {
  return (
    <Card>
      <CardHeader
        title="Apps"
        description="Se activan a mano y el cobro va por fuera de MercadoPago. El panel de la tienda lo ve enseguida; la tienda pública, en la próxima visita."
      />
      {available ? (
        <ul className="divide-y divide-adm-border">
          {items.map((item) => (
            <ModuleRow key={item.code} storeId={storeId} item={item} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-[13px] text-adm-fg-muted">Falta aplicar la migración 0022: todavía no hay tablas de apps.</p>
      )}
    </Card>
  );
}

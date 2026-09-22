"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { CANCEL_REASONS } from "@/lib/admin/order-utils";

/* Dialogs reutilizables del flujo de pedidos (detalle y acciones masivas). */

export interface CancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Cancelar pedido #1043" · "Cancelar 3 pedidos" */
  title: string;
  confirmLabel: string;
  description?: ReactNode;
  onConfirm: (reason: string) => Promise<boolean>;
}

/** Cancelación con motivo obligatorio. Devuelve el stock si se había descontado. */
export function CancelDialog({ open, onOpenChange, title, confirmLabel, description, onConfirm }: CancelDialogProps) {
  const [choice, setChoice] = useState<string>(CANCEL_REASONS[0]);
  const [other, setOther] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reason = choice === "otro" ? other.trim() : choice;

  const submit = async () => {
    if (!reason) {
      setError("Escribí el motivo.");
      return;
    }
    setPending(true);
    const done = await onConfirm(reason);
    setPending(false);
    if (done) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={title}
      description={
        description ?? "Si el pedido descontó stock, las unidades vuelven al inventario. El cliente ve el pedido como cancelado."
      }
      dismissable={!pending}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Volver
          </Button>
          <Button variant="danger" onClick={submit} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Motivo" required>
          <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
            {CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="otro">Otro motivo</option>
          </Select>
        </Field>
        {choice === "otro" ? (
          <Field label="Contá el motivo" error={error}>
            <Textarea rows={2} value={other} onChange={(e) => setOther(e.target.value)} maxLength={300} autoFocus />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}

export interface ShipValues {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
}

const CARRIERS = ["Correo Argentino", "Andreani", "OCA", "Vía Cargo", "Mensajería propia", "Moto"];

export interface ShipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  initial?: Partial<ShipValues>;
  onConfirm: (values: ShipValues) => Promise<boolean>;
}

/** Datos de seguimiento al despachar (todos opcionales). */
export function ShipDialog({ open, onOpenChange, title, confirmLabel, initial, onConfirm }: ShipDialogProps) {
  const [values, setValues] = useState<ShipValues>({
    carrier: initial?.carrier ?? "",
    trackingNumber: initial?.trackingNumber ?? "",
    trackingUrl: initial?.trackingUrl ?? "",
  });
  const [pending, setPending] = useState(false);
  const urlError = values.trackingUrl && !/^https?:\/\//i.test(values.trackingUrl) ? "Tiene que empezar con https://" : null;

  const submit = async () => {
    if (urlError) return;
    setPending(true);
    const done = await onConfirm(values);
    setPending(false);
    if (done) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={title}
      description="El cliente ve el transporte y el número de seguimiento en la página de su pedido."
      size="lg"
      dismissable={!pending}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Volver
          </Button>
          <Button variant="primary" onClick={submit} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Transporte" hint="Elegí uno o escribilo.">
          <Input
            list="ecommy-carriers"
            value={values.carrier}
            onChange={(e) => setValues((v) => ({ ...v, carrier: e.target.value }))}
            maxLength={80}
            autoFocus
          />
        </Field>
        <datalist id="ecommy-carriers">
          {CARRIERS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Field label="Número de seguimiento">
          <Input
            value={values.trackingNumber}
            onChange={(e) => setValues((v) => ({ ...v, trackingNumber: e.target.value }))}
            maxLength={120}
            className="font-mono"
          />
        </Field>
        <Field label="Link de seguimiento" hint="Opcional. La página del transporte con el envío." error={urlError} className="sm:col-span-2">
          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={values.trackingUrl}
            onChange={(e) => setValues((v) => ({ ...v, trackingUrl: e.target.value }))}
            maxLength={500}
          />
        </Field>
      </div>
    </Dialog>
  );
}

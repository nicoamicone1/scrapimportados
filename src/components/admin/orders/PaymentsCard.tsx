"use client";

import { Paperclip, Plus, Trash2, Upload, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deletePayment, markOrdersPaid, recordPayment } from "@/app/admin/(panel)/pedidos/actions";
import { getClientStoreId } from "@/components/admin/AdminStoreContext";
import { PaymentStatusBadge } from "@/components/admin/orders/OrderBadges";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/dates";
import { mediaPath } from "@/lib/media";
import { formatMoney, parseMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";

export interface PaymentView {
  id: string;
  amount: number;
  methodCode: string | null;
  reference: string | null;
  receiptUrl: string | null;
  paidAt: string;
  note: string | null;
  authorName: string | null;
}

export interface PaymentsCardProps {
  orderId: string;
  number: number;
  currency: string;
  total: number;
  paid: number;
  balance: number;
  paymentStatus: string;
  defaultMethod: string | null;
  methods: { code: string; name: string }[];
  payments: PaymentView[];
  cancelled: boolean;
  timeZone: string;
}

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/** Pagos del pedido: lista, registrar pago (con comprobante) y "marcar pagado". */
export function PaymentsCard(props: PaymentsCardProps) {
  const { orderId, number, currency, total, paid, balance, paymentStatus, methods, payments, cancelled, timeZone } = props;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const money = (v: number) => formatMoney(v, { currency });
  const methodName = (code: string | null) => methods.find((m) => m.code === code)?.name ?? code ?? "Sin método";

  const refresh = () => startTransition(() => router.refresh());

  return (
    <Card>
      <CardHeader
        title="Pagos"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <PaymentStatusBadge status={paymentStatus} />
            <span className="tnum">
              Cobrado {money(paid)} de {money(total)}
              {balance > 0 ? ` · Saldo ${money(balance)}` : ""}
            </span>
          </span>
        }
        actions={
          cancelled ? null : (
            <>
              {balance > 0 ? (
                <Button size="sm" icon={<Wallet />} onClick={() => setMarkOpen(true)}>
                  Marcar pagado
                </Button>
              ) : null}
              <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>
                Registrar pago
              </Button>
            </>
          )
        }
      />
      {payments.length ? (
        <ul className="divide-y divide-adm-border">
          {payments.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-4 px-4 py-3 text-[13px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="tnum text-sm font-medium">{money(p.amount)}</span>
                  <span className="text-adm-fg-muted">{methodName(p.methodCode)}</span>
                  {p.reference ? <span className="font-mono text-xs text-adm-fg-muted">Ref. {p.reference}</span> : null}
                </div>
                <div className="mt-0.5 text-xs text-adm-fg-muted">
                  <time dateTime={p.paidAt}>{formatDateTime(p.paidAt, timeZone)}</time>
                  {p.authorName ? ` · ${p.authorName}` : ""}
                </div>
                {p.note ? <p className="mt-1 text-adm-fg">{p.note}</p> : null}
                {p.receiptUrl ? (
                  <a
                    href={p.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-adm-accent hover:underline"
                  >
                    <Paperclip className="size-3.5" aria-hidden />
                    Ver comprobante
                  </a>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Anular pago de ${money(p.amount)}`}
                title="Anular pago"
                onClick={() => setDeleteId(p.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-[13px] text-adm-fg-muted">
          {cancelled
            ? "El pedido está cancelado."
            : "Todavía no registraste pagos. Cuando el cliente te mande el comprobante, registralo acá."}
        </p>
      )}

      {open ? (
        <PaymentDialog
          {...props}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={markOpen}
        onOpenChange={setMarkOpen}
        title={`Marcar el pedido #${number} como pagado`}
        description={`Se registra un pago de ${money(balance)} con ${methodName(props.defaultMethod)}.`}
        confirmLabel="Marcar pagado"
        onConfirm={async () => {
          const res = await markOrdersPaid({ ids: [orderId] });
          if (!res.ok) toast.error(res.error);
          else toast.success(`Pedido #${number} pagado.`);
          refresh();
        }}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Anular este pago"
        description="El estado de pago del pedido se recalcula. Queda registrado en la actividad."
        confirmLabel="Anular pago"
        destructive
        onConfirm={async () => {
          if (!deleteId) return;
          const res = await deletePayment({ id: deleteId });
          if (!res.ok) toast.error(res.error);
          else toast.success("Pago anulado.");
          refresh();
        }}
      />
    </Card>
  );
}

function PaymentDialog({
  orderId,
  number,
  currency,
  balance,
  defaultMethod,
  methods,
  onClose,
  onSaved,
}: PaymentsCardProps & { onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(balance > 0 ? String(balance).replace(".", ",") : "");
  const [method, setMethod] = useState(defaultMethod ?? methods[0]?.code ?? "");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [receiptUrl, setReceiptUrl] = useState("");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (file.size > MAX_RECEIPT_BYTES) {
      toast.error("El archivo pesa más de 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = mediaPath(getClientStoreId(), "receipts", orderId, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
      const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setReceiptUrl(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
      toast.success("Comprobante subido.");
    } catch {
      toast.error("No se pudo subir el comprobante. Probá con una imagen o PDF.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const value = parseMoney(amount);
    setSaving(true);
    const res = await recordPayment({
      orderId,
      amount: Number.isFinite(value) ? value : amount,
      methodCode: method,
      reference,
      receiptUrl,
      paidAt: paidAt ? new Date(paidAt).toISOString() : "",
      note,
    });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(res.data.paymentStatus === "paid" ? `Pedido #${number} pagado.` : "Pago registrado.");
    onSaved();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !saving && onClose()}
      title={`Registrar un pago del pedido #${number}`}
      description={balance > 0 ? `Saldo pendiente: ${formatMoney(balance, { currency })}.` : "El pedido no tiene saldo pendiente."}
      size="lg"
      dismissable={!saving}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={uploading}>
            Registrar pago
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Monto" required error={errors.amount}>
          <Input inputMode="decimal" leading="$" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Método" required error={errors.methodCode}>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} options={methods.map((m) => ({ value: m.code, label: m.name }))} />
        </Field>
        <Field label="Referencia" hint="Número de operación o de comprobante." error={errors.reference}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className="font-mono" />
        </Field>
        <Field label="Fecha del pago" error={errors.paidAt}>
          <Input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </Field>
        <Field
          label="Comprobante"
          hint="Pegá un link o subí una imagen o PDF (máx. 10 MB)."
          error={errors.receiptUrl}
          className="sm:col-span-2"
        >
          <Input type="url" placeholder="https://" value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} />
        </Field>
        <div className="-mt-1 sm:col-span-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" icon={<Upload />} loading={uploading} onClick={() => fileRef.current?.click()}>
            Subir archivo
          </Button>
        </div>
        <Field label="Nota" error={errors.note} className="sm:col-span-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </Dialog>
  );
}

"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { logWhatsAppOpened } from "@/app/admin/(panel)/pedidos/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Select, Textarea } from "@/components/ui/Input";
import {
  buildWhatsAppMessage,
  toWhatsAppNumber,
  WHATSAPP_TEMPLATE_LABELS,
  type WhatsAppMessageContext,
  type WhatsAppTemplateKind,
} from "@/lib/admin/whatsapp";

const KINDS = Object.keys(WHATSAPP_TEMPLATE_LABELS) as WhatsAppTemplateKind[];

/**
 * "Enviar mensaje por WhatsApp": elige la plantilla según el estado del
 * pedido (editable antes de abrir) y abre `wa.me` con el texto. No envía nada
 * solo: el vendedor lo manda desde su WhatsApp.
 */
export function WhatsAppComposer({
  orderId,
  phone,
  defaultKind,
  context,
}: {
  orderId?: string;
  phone: string | null;
  defaultKind: WhatsAppTemplateKind;
  context: WhatsAppMessageContext;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WhatsAppTemplateKind>(defaultKind);
  const [text, setText] = useState(() => buildWhatsAppMessage(defaultKind, context));
  const number = toWhatsAppNumber(phone);

  const openWa = () => {
    if (!number) return;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    if (orderId) void logWhatsAppOpened({ orderId, template: kind });
    setOpen(false);
  };

  if (!number) {
    return <p className="text-xs text-adm-fg-muted">Sin un teléfono válido no se puede abrir WhatsApp.</p>;
  }

  return (
    <>
      <Button
        className="w-full"
        icon={<MessageCircle />}
        onClick={() => {
          setKind(defaultKind);
          setText(buildWhatsAppMessage(defaultKind, context));
          setOpen(true);
        }}
      >
        Enviar mensaje por WhatsApp
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Mensaje por WhatsApp"
        description="Revisalo y editalo si hace falta. Se abre WhatsApp con el texto listo para mandar."
        size="lg"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" icon={<MessageCircle />} onClick={openWa} disabled={!text.trim()}>
              Abrir WhatsApp
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Plantilla">
            <Select
              value={kind}
              onChange={(e) => {
                const k = e.target.value as WhatsAppTemplateKind;
                setKind(k);
                setText(buildWhatsAppMessage(k, context));
              }}
              options={KINDS.map((k) => ({ value: k, label: WHATSAPP_TEMPLATE_LABELS[k] }))}
            />
          </Field>
          <Field label="Mensaje" aside={`${text.length} caracteres`} hint="Menos de 1.000 caracteres para que WhatsApp no lo corte.">
            <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

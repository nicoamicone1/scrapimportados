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
 * Diálogo "Mensaje por WhatsApp": arranca con la plantilla que corresponde al
 * estado del pedido (editable antes de abrir) y abre `wa.me` con el texto. No
 * envía nada solo: el vendedor lo manda desde su WhatsApp. Se monta sólo
 * cuando está abierto (el estado inicial sale de las props).
 */
export function WhatsAppDialog({
  orderId,
  phone,
  initialKind,
  context,
  onClose,
}: {
  orderId?: string;
  phone: string | null;
  initialKind: WhatsAppTemplateKind;
  context: WhatsAppMessageContext;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<WhatsAppTemplateKind>(initialKind);
  const [text, setText] = useState(() => buildWhatsAppMessage(initialKind, context));
  const number = toWhatsAppNumber(phone);

  const openWa = () => {
    if (!number) return;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    if (orderId) void logWhatsAppOpened({ orderId, template: kind });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Mensaje por WhatsApp"
      description="Revisalo y editalo si hace falta. Se abre WhatsApp con el texto listo para mandar."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
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
  );
}

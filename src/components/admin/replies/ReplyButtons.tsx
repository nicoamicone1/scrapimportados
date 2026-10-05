"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { waLink } from "@/lib/store/whatsapp";

/*
 * Botones de `/admin/responder`. Ecommy no manda nada: "Copiar respuesta"
 * deja el texto en el portapapeles y "Abrir WhatsApp" abre `wa.me` sin
 * número, con el texto listo, para que el comerciante elija el chat.
 */

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback (HTTP sin contexto seguro, navegadores viejos).
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("copy");
}

export function CopyReplyButton({
  text,
  label = "Copiar respuesta",
  ariaLabel,
  variant = "secondary",
  size = "md",
  className,
}: {
  text: string;
  label?: string;
  ariaLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await writeClipboard(text);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
      return;
    }
    toast.success("Respuesta copiada");
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={cn("max-sm:h-11", className)}
      icon={copied ? <Check /> : <Copy />}
      onClick={copy}
      disabled={!text.trim()}
      aria-label={ariaLabel}
    >
      {copied ? "Copiada" : label}
    </Button>
  );
}

export function OpenWhatsAppLink({
  text,
  label = "Abrir WhatsApp",
  ariaLabel,
  variant = "secondary",
  size = "md",
  className,
}: {
  text: string;
  label?: string;
  ariaLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <a
      href={waLink(null, text)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel ? `${ariaLabel} (se abre en otra pestaña)` : undefined}
      className={buttonClass(variant, size, cn("max-sm:h-11", className))}
    >
      <MessageCircle aria-hidden strokeWidth={1.5} />
      {label}
      {ariaLabel ? null : <span className="sr-only"> (se abre en otra pestaña)</span>}
    </a>
  );
}

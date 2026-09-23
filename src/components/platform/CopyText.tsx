"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

/*
 * "Copiar" genérico para las pantallas de /platform (kit de redes). Es el
 * mismo comportamiento que `CopyButton` de /admin/compartir, sin el paso de
 * onboarding de la tienda que ese arrastra.
 */

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("copy");
}

/** "Copiar texto" → "Copiado" durante 1.5 s, con aviso para lectores de pantalla. */
export function CopyText({
  text,
  label = "Copiar texto",
  ariaLabel,
  variant = "secondary",
  size = "sm",
}: {
  text: string;
  label?: string;
  ariaLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
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
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Button variant={variant} size={size} className="min-w-[112px]" icon={copied ? <Check strokeWidth={1.5} /> : <Copy strokeWidth={1.5} />} onClick={copy} aria-label={ariaLabel}>
        {copied ? "Copiado" : label}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copiado al portapapeles." : ""}
      </span>
    </>
  );
}

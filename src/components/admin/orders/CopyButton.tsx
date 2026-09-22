"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

/** Copia un texto al portapapeles con feedback "Copiado" (1,5 s). */
export function CopyButton({
  value,
  label = "Copiar",
  variant = "secondary",
  size = "sm",
  className,
}: {
  value: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button variant={variant} size={size} onClick={copy} icon={copied ? <Check /> : <Copy />} className={className} aria-live="polite">
      {copied ? "Copiado" : label}
    </Button>
  );
}

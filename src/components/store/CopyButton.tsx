"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

/** "Copiar" con feedback "Copiado" (DESIGN.md §6.11). */
export function CopyButton({ value, label = "Copiar", className, ariaLabel }: { value: string; label?: string; className?: string; ariaLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback para navegadores sin Clipboard API (o http).
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button type="button" onClick={copy} className={cn("link min-h-9 shrink-0 text-sm", className)} aria-label={ariaLabel}>
      <span aria-live="polite">{copied ? "Copiado" : label}</span>
    </button>
  );
}

/** "Copiar link" de la página actual. */
export function CopyCurrentUrl({ label = "Copiar link" }: { label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href.split("?")[0]);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          // sin permiso: no hacemos nada
        }
      }}
    >
      <span aria-live="polite">{copied ? "Link copiado" : label}</span>
    </button>
  );
}

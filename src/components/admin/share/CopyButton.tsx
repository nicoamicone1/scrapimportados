"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { markOnboardingStep } from "@/app/admin/(panel)/onboarding-actions";
import { Button, buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

import { whatsappShareUrl } from "./messages";

/*
 * Botones de `/admin/compartir`. Copiar o mandar cualquier link tilda el
 * paso "Compartí el link de tu tienda" del onboarding (una sola vez por
 * visita, y nunca si ya estaba hecho).
 */

const MarkSharedContext = createContext<() => void>(() => {});

export function ShareOnboarding({ done, children }: { done: boolean; children: ReactNode }) {
  const router = useRouter();
  const sent = useRef(done);
  const mark = useCallback(() => {
    if (sent.current) return;
    sent.current = true;
    void markOnboardingStep({ step: "shared" }).then((res) => {
      if (res.ok) router.refresh();
      else sent.current = false;
    });
  }, [router]);
  return <MarkSharedContext.Provider value={mark}>{children}</MarkSharedContext.Provider>;
}

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
  const okCopy = document.execCommand("copy");
  area.remove();
  if (!okCopy) throw new Error("copy");
}

export interface CopyButtonProps {
  text: string;
  label?: string;
  /** Nombre accesible si el label visible no alcanza ("Copiar mensaje para la bio"). */
  ariaLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** Tildar el paso "compartí tu link" del onboarding (default true). */
  marksShared?: boolean;
}

/** "Copiar" → "Copiado" durante 1.5 s, con aviso para lectores de pantalla. */
export function CopyButton({ text, label = "Copiar", ariaLabel, variant = "secondary", size = "sm", className, marksShared = true }: CopyButtonProps) {
  const mark = useContext(MarkSharedContext);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

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
    if (marksShared) mark();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn("min-w-[92px]", className)}
        icon={copied ? <Check /> : <Copy />}
        onClick={copy}
        aria-label={ariaLabel}
      >
        {copied ? "Copiado" : label}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copiado al portapapeles." : ""}
      </span>
    </>
  );
}

/** Abre WhatsApp (sin destinatario: elegís el chat) con el texto armado. */
export function WhatsAppShareLink({
  text,
  label = "Compartir por WhatsApp",
  variant = "secondary",
  size = "sm",
  className,
}: {
  text: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const mark = useContext(MarkSharedContext);
  return (
    <a
      href={whatsappShareUrl(text)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={mark}
      className={buttonClass(variant, size, className)}
    >
      <MessageCircle aria-hidden strokeWidth={1.5} />
      {label}
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  );
}

"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { markOnboardingStep } from "@/app/admin/(panel)/onboarding-actions";
import { Button, buttonClass } from "@/components/ui/Button";

/**
 * "Compartí tu link": copiar o mandar por WhatsApp (y tildar el paso), más
 * el acceso a `/admin/compartir` (QR y mensajes listos). Con `shareText`
 * (el texto para la historia), se copia y se manda ese texto, que ya trae el
 * link; sin él, el link solo.
 */
export function ShareStoreLink({
  url,
  storeName,
  shareText,
  moreHref,
  primary = true,
}: {
  url: string;
  storeName: string;
  shareText?: string;
  moreHref?: string;
  /** Es el próximo paso: botón pomelo (máximo uno por pantalla, BRAND §5.3). */
  primary?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const mark = () =>
    startTransition(async () => {
      const res = await markOnboardingStep({ step: "shared" });
      if (res.ok) router.refresh();
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText ?? url);
      toast.success(shareText ? "Texto copiado. Pegalo en tu historia o en tu estado." : "Link copiado.");
      mark();
    } catch {
      toast.error(shareText ? "No se pudo copiar. Seleccioná el texto y copialo a mano." : "No se pudo copiar. Seleccioná el link y copialo a mano.");
    }
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(shareText ?? `Mirá mi tienda online, ${storeName}: ${url}`)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size={primary ? "lg" : "sm"} variant={primary ? "accent" : "secondary"} icon={<Copy />} onClick={copy} loading={pending}>
        {shareText ? "Copiar texto" : "Copiar link"}
      </Button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        onClick={mark}
        className={buttonClass("secondary", primary ? "lg" : "sm")}
      >
        <MessageCircle aria-hidden />
        Mandar por WhatsApp
      </a>
      {moreHref ? (
        <Link href={moreHref} className="text-[13px] font-medium text-adm-link underline decoration-2 underline-offset-4 hover:text-adm-link-hover">
          QR y mensajes listos
        </Link>
      ) : null}
    </div>
  );
}

/**
 * "Copiar link" del encabezado del dashboard: compartir la tienda a un toque
 * (BRAND §11). Si el paso "compartí tu link" del checklist sigue abierto, lo
 * tilda.
 */
export function CopyStoreLinkButton({ url, markShared = false }: { url: string; markShared?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link de la tienda copiado.", { description: url });
      if (markShared)
        startTransition(async () => {
          const res = await markOnboardingStep({ step: "shared" });
          if (res.ok) router.refresh();
        });
    } catch {
      toast.error("No se pudo copiar. Abrí Compartir para ver el link.");
    }
  };
  return (
    <Button icon={<Copy />} onClick={copy} loading={pending} aria-label={`Copiar el link de la tienda: ${url}`}>
      Copiar link
    </Button>
  );
}

/**
 * El link de la tienda como campo copiable (tarjeta "Tu tienda" del inicio):
 * se lee la dirección y se copia con un toque. Tilda "compartí tu link".
 */
export function CopyStoreHost({ url, host, markShared = false }: { url: string; host: string; markShared?: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast.success("Link de la tienda copiado.", { description: url });
      if (markShared) {
        const res = await markOnboardingStep({ step: "shared" });
        if (res.ok) router.refresh();
      }
    } catch {
      toast.error("No se pudo copiar. Abrí Compartir para ver el link.");
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copiar el link de la tienda: ${url}`}
      className="group flex h-10 w-full min-w-0 items-center gap-2 rounded-adm border border-adm-border bg-adm-surface-2 pr-1.5 pl-3 text-left transition-colors duration-[140ms] ease-eco-out hover:border-adm-input-border pointer-coarse:h-11"
    >
      <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-adm-fg">{host}</span>
      <span
        aria-hidden
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[7px] bg-adm-surface px-2 text-xs font-medium text-adm-fg shadow-adm-card"
      >
        {copied ? <Check className="size-3.5 text-adm-success" /> : <Copy className="size-3.5" />}
        {copied ? "Copiado" : "Copiar"}
      </span>
    </button>
  );
}

export function DismissOnboarding() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await markOnboardingStep({ step: "dismissed" });
          if (res.ok) router.refresh();
          else toast.error(res.error);
        })
      }
    >
      Ocultar
    </Button>
  );
}

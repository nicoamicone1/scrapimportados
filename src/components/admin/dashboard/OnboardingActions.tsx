"use client";

import { Copy, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { markOnboardingStep } from "@/app/admin/(panel)/onboarding-actions";
import { Button, buttonClass } from "@/components/ui/Button";

/**
 * "Compartí tu link": copiar o mandar por WhatsApp (y tildar el paso), más
 * el acceso a `/admin/compartir` (QR y mensajes listos).
 */
export function ShareStoreLink({
  url,
  storeName,
  moreHref,
  primary = true,
}: {
  url: string;
  storeName: string;
  moreHref?: string;
  /** Es el próximo paso: botón ámbar (máximo uno por pantalla, BRAND §5.3). */
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
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
      mark();
    } catch {
      toast.error("No se pudo copiar. Seleccioná el link y copialo a mano.");
    }
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Mirá mi tienda online, ${storeName}: ${url}`)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant={primary ? "accent" : "secondary"} icon={<Copy />} onClick={copy} loading={pending}>
        Copiar link
      </Button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        onClick={mark}
        className={buttonClass("secondary", "sm")}
      >
        <MessageCircle aria-hidden />
        Mandar por WhatsApp
      </a>
      {moreHref ? (
        <Link href={moreHref} className="text-[13px] font-medium text-adm-accent underline underline-offset-2 hover:no-underline">
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

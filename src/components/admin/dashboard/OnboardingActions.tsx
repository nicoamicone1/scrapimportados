"use client";

import { Copy, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { markOnboardingStep } from "@/app/admin/(panel)/onboarding-actions";
import { Button } from "@/components/ui/Button";

/**
 * "Compartí tu link": copiar o mandar por WhatsApp (y tildar el paso), más
 * el acceso a `/admin/compartir` (QR y mensajes listos).
 */
export function ShareStoreLink({ url, storeName, moreHref }: { url: string; storeName: string; moreHref?: string }) {
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
      <Button size="sm" variant="accent" icon={<Copy />} onClick={copy} loading={pending}>
        Copiar link
      </Button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        onClick={mark}
        className="inline-flex h-7 items-center gap-1.5 rounded-adm border border-adm-input-border bg-adm-surface px-2.5 text-[13px] font-medium hover:bg-adm-hover"
      >
        <MessageCircle className="size-3.5" aria-hidden />
        Mandar por WhatsApp
      </a>
      {moreHref ? (
        <Link href={moreHref} className="text-[13px] font-medium text-adm-accent underline-offset-2 hover:underline">
          QR y mensajes listos
        </Link>
      ) : null}
    </div>
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

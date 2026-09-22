"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";
import { buildProductMessage, waLink } from "@/lib/store/whatsapp";

/*
 * Botón flotante de WhatsApp (P0-19). En la ficha el mensaje es contextual
 * ("consulto por *Producto* URL"): la página monta <FabProduct/> y el botón
 * lo lee de este mini-store.
 */

type FabContext = { name: string; url: string } | null;
let context: FabContext = null;
const listeners = new Set<() => void>();

function setContext(next: FabContext) {
  context = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Lo monta la ficha de producto: cambia el mensaje del botón mientras está visible. */
export function FabProduct({ name, url }: { name: string; url: string }) {
  useEffect(() => {
    setContext({ name, url });
    return () => setContext(null);
  }, [name, url]);
  return null;
}

export interface WhatsAppFabProps {
  phone: string;
  template: string;
  position: "left" | "right";
  showOnMobile: boolean;
  showOnDesktop: boolean;
}

const HIDDEN_ON = [/^\/checkout/, /^\/pedido\//];

export function WhatsAppFab({ phone, template, position, showOnMobile, showOnDesktop }: WhatsAppFabProps) {
  const pathname = usePathname();
  const product = useSyncExternalStore(subscribe, () => context, () => null);
  if (!phone || HIDDEN_ON.some((re) => re.test(pathname))) return null;
  if (!showOnMobile && !showOnDesktop) return null;

  const text = product ? buildProductMessage(template, product) : template.trim() || "Hola. Tengo una consulta.";
  return (
    <a
      href={waLink(phone, text)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={product ? `Consultar por WhatsApp sobre ${product.name}` : "Escribinos por WhatsApp"}
      className={cn(
        "fixed bottom-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-[var(--shadow-lg)] transition-colors hover:bg-primary-hover sm:bottom-6",
        position === "left" ? "left-4 sm:left-6" : "right-4 sm:right-6",
        !showOnMobile && "max-lg:hidden",
        !showOnDesktop && "lg:hidden",
      )}
    >
      <MessageCircle className="size-6" aria-hidden strokeWidth={1.75} />
    </a>
  );
}

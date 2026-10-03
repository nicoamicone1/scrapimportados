"use client";

import { ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

/**
 * Panel plegable para lo que no se usa en cada alta (SEO, ficha técnica,
 * precios por cantidad…): divulgación progresiva (BRAND §11). Arranca abierto
 * si ya tiene contenido; `forceOpen` lo abre si hay un error adentro.
 */
export function CollapsibleCard({
  title,
  description,
  summary,
  defaultOpen = false,
  forceOpen = false,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Resumen a la derecha cuando está cerrado ("2 tramos", "Sin cargar"). */
  summary?: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const isOpen = open || forceOpen;
  return (
    <Card>
      <h2 className="text-[15px] leading-6 font-semibold text-adm-fg">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setOpen(!isOpen)}
          className={cn(
            "flex min-h-12 w-full items-start gap-2 px-4 py-3 text-left transition-colors duration-[140ms] ease-eco-out hover:bg-adm-row-hover",
            isOpen ? "rounded-t-adm-lg border-b border-adm-border" : "rounded-adm-lg",
          )}
        >
          <ChevronRight
            className={cn("mt-1 size-4 shrink-0 text-adm-fg-muted transition-transform duration-[240ms] ease-eco-out", isOpen && "rotate-90")}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block">{title}</span>
            {description ? <span className="mt-0.5 block text-[13px] leading-5 font-normal text-adm-fg-muted">{description}</span> : null}
          </span>
          {!isOpen && summary ? <span className="mt-0.5 shrink-0 text-[13px] font-normal text-adm-fg-muted">{summary}</span> : null}
        </button>
      </h2>
      <div id={bodyId} hidden={!isOpen} className="p-4">
        {children}
      </div>
    </Card>
  );
}

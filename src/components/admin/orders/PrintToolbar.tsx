"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { logOrdersPrinted } from "@/app/admin/(panel)/pedidos/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Barra de la vista de remitos (no se imprime): registra el evento
 * `printed` una vez por apertura y dispara `window.print()` solo; el botón
 * queda por si el navegador lo bloquea.
 */
export function PrintToolbar({
  ids,
  count,
  format,
  autoPrint,
}: {
  ids: string[];
  count: number;
  format: "a4" | "80mm";
  autoPrint: boolean;
}) {
  const logged = useRef(false);
  const autoDone = useRef(false);

  // El evento se registra cuando de verdad se abre el diálogo de impresión
  // (auto, botón o Ctrl+P), una vez por apertura de la vista.
  useEffect(() => {
    const onBeforePrint = () => {
      if (logged.current || !ids.length) return;
      logged.current = true;
      void logOrdersPrinted({ ids });
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, [ids]);

  useEffect(() => {
    if (!autoPrint || autoDone.current || !ids.length) return;
    const t = setTimeout(() => {
      autoDone.current = true;
      window.print();
    }, 400);
    return () => clearTimeout(t);
  }, [ids, autoPrint]);

  const href = (f: "a4" | "80mm") => `/admin/pedidos/imprimir?ids=${ids.join(",")}${f === "80mm" ? "&format=80mm" : ""}&auto=0`;
  const tab = (f: "a4" | "80mm", label: string) => (
    <Link
      href={href(f)}
      aria-current={format === f ? "page" : undefined}
      className={cn(
        "inline-flex h-7 items-center rounded-adm px-2.5 text-[13px]",
        format === f ? "bg-adm-surface font-medium text-adm-fg shadow-[0_0_0_1px_var(--adm-border)]" : "text-adm-fg-muted hover:text-adm-fg",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="sticky top-0 z-10 border-b border-adm-border bg-adm-surface print:hidden">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="text-sm">
          <span className="font-medium">
            {count} {count === 1 ? "remito" : "remitos"}
          </span>
          <span className="text-adm-fg-muted"> · Usá “Guardar como PDF” en el diálogo de impresión si lo querés en archivo.</span>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Formato" className="flex items-center gap-0.5 rounded-adm bg-adm-surface-2 p-0.5">
            {tab("a4", "Hoja A4")}
            {tab("80mm", "Ticket 80 mm")}
          </nav>
          <Button variant="primary" icon={<Printer />} onClick={() => window.print()}>
            Imprimir
          </Button>
        </div>
      </div>
    </div>
  );
}

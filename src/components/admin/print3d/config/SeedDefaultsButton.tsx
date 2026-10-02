"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button, type ButtonVariant } from "@/components/ui/Button";

import { seedPrint3dDefaults } from "@/app/admin/(panel)/taller-3d/configuracion/actions";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * "Cargar valores de ejemplo": 3 calidades, PLA/PETG/TPU con colores
 * comunes y una Bambu Lab A1. Idempotente (sólo agrega lo que falta).
 * Lo usa también el Resumen del taller (D2).
 */
export function SeedDefaultsButton({
  variant = "accent",
  label = "Cargar valores de ejemplo",
  className,
}: {
  variant?: ButtonVariant;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const res = await seedPrint3dDefaults();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const r = res.data;
      const parts = [
        r.qualities ? plural(r.qualities, "calidad", "calidades") : null,
        r.materials ? plural(r.materials, "material", "materiales") : null,
        r.colors ? plural(r.colors, "color", "colores") : null,
        r.printers ? plural(r.printers, "impresora", "impresoras") : null,
      ].filter(Boolean);
      toast.success(parts.length ? `Listo: cargamos ${parts.join(", ")}.` : "Ya tenías todo cargado: no agregamos nada.");
      router.refresh();
    });

  return (
    <Button variant={variant} icon={<Sparkles aria-hidden />} onClick={run} loading={pending} loadingText="Cargando…" className={className}>
      {label}
    </Button>
  );
}

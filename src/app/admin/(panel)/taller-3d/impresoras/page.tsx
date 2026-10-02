import { Printer } from "lucide-react";
import type { Metadata } from "next";

import { PrinterBoard } from "@/components/admin/print3d/config/PrinterBoard";
import { PageHeader } from "@/components/ui/display";
import { getPrint3dSettings, listPrinters } from "@/lib/admin/print3d-config";
import { requireAdmin } from "@/lib/auth";
import { formatNumber } from "@/lib/money";
import { hasModule } from "@/lib/modules/registry";

export const metadata: Metadata = { title: "Impresoras · Taller 3D" };

export default async function ImpresorasPage() {
  const ctx = await requireAdmin();
  if (!hasModule(ctx, "print3d")) return null;

  const [printers, settings] = await Promise.all([listPrinters(), getPrint3dSettings()]);
  const active = printers.filter((p) => p.status === "active");
  const maintenance = printers.filter((p) => p.status === "maintenance").length;
  const capacity = active.length * settings.daily_print_hours;

  const description =
    printers.length === 0
      ? "Cargá tus máquinas para que el cotizador sepa qué entra y en cuánto sale."
      : [
          `${active.length} ${active.length === 1 ? "activa" : "activas"} de ${printers.length}`,
          maintenance ? `${maintenance} en mantenimiento` : null,
          active.length ? `${formatNumber(capacity)} h de impresión por día` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <>
      <PageHeader title="Impresoras" description={description} section="store" icon={<Printer />} />
      <PrinterBoard printers={printers} kwhPrice={settings.kwh_price} />
    </>
  );
}

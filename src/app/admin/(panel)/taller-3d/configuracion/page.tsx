import { SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";

import { SeedDefaultsButton } from "@/components/admin/print3d/config/SeedDefaultsButton";
import { WorkshopSettings } from "@/components/admin/print3d/config/WorkshopSettings";
import { PageHeader } from "@/components/ui/display";
import {
  getFilamentData,
  getPrint3dSettings,
  listCalibration,
  listPrinters,
  listQualities,
} from "@/lib/admin/print3d-config";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { hasModule } from "@/lib/modules/registry";

export const metadata: Metadata = { title: "Configuración · Taller 3D" };

export default async function ConfiguracionTallerPage() {
  const ctx = await requireAdmin();
  if (!hasModule(ctx, "print3d")) return null;

  const [settings, qualities, filament, calibration, printers] = await Promise.all([
    getPrint3dSettings(),
    listQualities(),
    getFilamentData(),
    listCalibration(),
    listPrinters(),
  ]);
  const { saved, ...values } = settings;
  const missing = [
    printers.length === 0 ? "impresoras" : null,
    filament.materials.length === 0 ? "materiales" : null,
    qualities.length === 0 ? "calidades" : null,
  ].filter(Boolean);

  // Cambia cuando cambian los datos guardados: el formulario se rearma con lo nuevo.
  const formKey = JSON.stringify([values, qualities.map((q) => [q.id, q.code, q.position])]);

  return (
    <>
      <PageHeader
        title="Configuración"
        description={`Hora de máquina ${formatMoney(values.hour_rate)} · mínimo por pieza ${formatMoney(values.min_piece_price)} · ${qualities.length} ${qualities.length === 1 ? "calidad" : "calidades"}`}
        section="store"
        icon={<SlidersHorizontal />}
      />

      {missing.length ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-adm border border-adm-border bg-adm-accent-soft px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-adm-fg">
              {saved || missing.length < 3 ? `Te faltan ${missing.join(", ")}` : "Arrancá con valores de ejemplo"}
            </p>
            <p className="mt-0.5 max-w-prose text-[13px] text-adm-fg-muted">
              Cargamos 3 calidades (Borrador 0,28 · Estándar 0,20 · Fina 0,12), PLA, PETG y TPU con colores comunes y una Bambu Lab A1. Sólo
              agrega lo que falta; después ajustás todo.
            </p>
          </div>
          <SeedDefaultsButton />
        </div>
      ) : null}

      <WorkshopSettings
        key={formKey}
        settings={values}
        qualities={qualities}
        materials={filament.materials}
        calibration={calibration}
        printers={printers}
      />
    </>
  );
}

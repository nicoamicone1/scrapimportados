import type { Metadata } from "next";

import { ProductSpecsManager } from "@/components/admin/print3d/config/ProductSpecsManager";
import {
  getFilamentData,
  getPrint3dSettings,
  listCalibration,
  listPrinters,
  listProductSpecs,
  listQualities,
} from "@/lib/admin/print3d-config";
import { requireAdmin } from "@/lib/auth";
import { hasModule } from "@/lib/modules/registry";

export const metadata: Metadata = { title: "Productos · Taller 3D" };

export default async function ProductosTallerPage() {
  const ctx = await requireAdmin();
  if (!hasModule(ctx, "print3d")) return null;

  const [specs, filament, qualities, printers, settings, calibration] = await Promise.all([
    listProductSpecs(),
    getFilamentData(),
    listQualities(),
    listPrinters(),
    getPrint3dSettings(),
    listCalibration(),
  ]);

  return (
    <ProductSpecsManager
      specs={specs}
      qualities={qualities}
      calibration={calibration}
      ctx={{
        materials: filament.materials,
        spools: filament.spools,
        printers,
        settings: { kwh_price: settings.kwh_price, labor_hour_cost: settings.labor_hour_cost },
      }}
    />
  );
}

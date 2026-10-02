import type { Metadata } from "next";

import { FilamentShelf } from "@/components/admin/print3d/config/FilamentShelf";
import { getFilamentData } from "@/lib/admin/print3d-config";
import { requireAdmin } from "@/lib/auth";
import { hasModule } from "@/lib/modules/registry";

export const metadata: Metadata = { title: "Filamento · Taller 3D" };

export default async function FilamentoPage() {
  const ctx = await requireAdmin();
  if (!hasModule(ctx, "print3d")) return null;

  const { materials, spools } = await getFilamentData();
  return <FilamentShelf materials={materials} spools={spools} />;
}

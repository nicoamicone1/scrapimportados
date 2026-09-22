import type { Metadata } from "next";

import { ExportPanel } from "@/components/admin/settings/ExportPanel";
import { SettingsHeader } from "@/components/admin/settings/SettingsHeader";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Exportar · Configuración" };

export default async function ExportarPage() {
  const { supabase } = await requireAdmin();
  const [products, variants, orders, customers] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("product_variants").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }),
  ]);

  return (
    <>
      <SettingsHeader
        title="Exportar"
        description="Descargá tus datos en CSV (UTF-8, separado por comas). Se abren en Excel, Google Sheets o Numbers."
      />
      <ExportPanel
        counts={{
          products: products.count ?? 0,
          variants: variants.count ?? 0,
          orders: orders.count ?? 0,
          customers: customers.count ?? 0,
        }}
      />
    </>
  );
}

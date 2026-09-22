import type { Metadata } from "next";

import { SeoForm } from "@/components/admin/settings/SeoForm";
import { getAdminSettings } from "@/lib/admin/settings";
import type { SeoSettingsInput } from "@/lib/schemas/settings";

export const metadata: Metadata = { title: "SEO e integraciones · Configuración" };

export default async function SeoSettingsPage() {
  const s = await getAdminSettings();
  const row = s.integrations;
  const initial: SeoSettingsInput = {
    seo: { title: s.seo.title, description: s.seo.description, og_image_url: s.seo.og_image_url },
    integrations: {
      ga4_id: row.ga4_id,
      gtm_id: row.gtm_id,
      meta_pixel_id: row.meta_pixel_id,
      google_site_verification: row.google_site_verification,
    },
    maintenance: { enabled: s.maintenance.enabled, message: s.maintenance.message },
  };
  return <SeoForm initial={initial} storeName={s.name} tagline={s.tagline ?? ""} />;
}

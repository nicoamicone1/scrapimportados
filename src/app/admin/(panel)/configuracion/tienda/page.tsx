import type { Metadata } from "next";

import { StoreForm } from "@/components/admin/settings/StoreForm";
import { getAdminSettings } from "@/lib/admin/settings";
import type { StoreSettingsInput } from "@/lib/schemas/settings";

export const metadata: Metadata = { title: "Tienda · Configuración" };

export default async function TiendaSettingsPage() {
  const s = await getAdminSettings();
  const initial: StoreSettingsInput = {
    name: s.name,
    tagline: s.tagline ?? "",
    contact_email: s.contact_email ?? "",
    contact_phone: s.contact_phone ?? "",
    whatsapp_phone: s.whatsapp_phone ?? "",
    address: s.address ?? "",
    currency: s.currency,
    locale: s.locale,
    timezone: s.timezone,
    social: {
      instagram: s.social.instagram ?? "",
      facebook: s.social.facebook ?? "",
      tiktok: s.social.tiktok ?? "",
      x: s.social.x ?? "",
      youtube: s.social.youtube ?? "",
    },
  };
  return <StoreForm initial={initial} />;
}

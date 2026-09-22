import type { Metadata } from "next";

import { LegalForm } from "@/components/admin/settings/LegalForm";
import { getAdminSettings } from "@/lib/admin/settings";
import type { LegalSettingsInput } from "@/lib/schemas/settings";

export const metadata: Metadata = { title: "Impuestos y legales · Configuración" };

const COUNTRIES = ["AR", "UY", "CL", "PY", "BO", "PE", "CO", "MX", "ES", "OTHER"] as const;

export default async function LegalesSettingsPage() {
  const s = await getAdminSettings();
  const country = (COUNTRIES as readonly string[]).includes(s.legal.country) ? (s.legal.country as (typeof COUNTRIES)[number]) : "AR";
  const initial: LegalSettingsInput = {
    tax: {
      show_net_price: s.tax.show_net_price,
      default_vat_percent: String(s.tax.default_vat_percent),
      label: s.tax.label,
    },
    legal: {
      country,
      razon_social: s.legal.razon_social,
      cuit: s.legal.cuit,
      consumer_defense_link: s.legal.consumer_defense_link,
      data_fiscal: { image_url: s.legal.data_fiscal.image_url, href: s.legal.data_fiscal.href },
    },
    policies: {
      shipping_md: s.policies.shipping_md ?? "",
      returns_md: s.policies.returns_md ?? "",
      privacy_md: s.policies.privacy_md ?? "",
      terms_md: s.policies.terms_md ?? "",
    },
  };
  return <LegalForm initial={initial} store={{ name: s.name, email: s.contact_email ?? "", address: s.address ?? "" }} />;
}

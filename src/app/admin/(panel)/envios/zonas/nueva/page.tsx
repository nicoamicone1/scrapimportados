import type { Metadata } from "next";

import { ZoneForm } from "@/components/admin/shipping/ZoneForm";
import { getMapCenter, listShippingZones } from "@/lib/admin/shipping";

export const metadata: Metadata = { title: "Nueva zona de envío" };

export default async function NuevaZonaPage() {
  const [zones, center] = await Promise.all([listShippingZones(), getMapCenter()]);
  const referenceZones = zones.flatMap((z) => (z.type === "polygon" && z.geometry ? [{ id: z.id, name: z.name, geometry: z.geometry }] : []));
  return <ZoneForm zone={null} center={center} referenceZones={referenceZones} zonesCount={zones.length} />;
}

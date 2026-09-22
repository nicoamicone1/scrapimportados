import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ZoneForm } from "@/components/admin/shipping/ZoneForm";
import { getMapCenter, getShippingZone, listShippingZones } from "@/lib/admin/shipping";

export const metadata: Metadata = { title: "Zona de envío" };

export default async function EditarZonaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const zone = await getShippingZone(id);
  if (!zone) notFound();
  const [zones, center] = await Promise.all([listShippingZones(), getMapCenter()]);
  const referenceZones = zones.flatMap((z) =>
    z.id !== zone.id && z.type === "polygon" && z.geometry ? [{ id: z.id, name: z.name, geometry: z.geometry }] : [],
  );
  return <ZoneForm key={zone.updatedAt} zone={zone} center={center} referenceZones={referenceZones} zonesCount={zones.length} />;
}

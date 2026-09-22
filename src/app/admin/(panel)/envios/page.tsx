import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { AddressTester } from "@/components/admin/shipping/AddressTester";
import { PickupsPanel } from "@/components/admin/shipping/PickupsPanel";
import { ZonesList } from "@/components/admin/shipping/ZonesList";
import { ButtonLink, PageHeader, TabsNav } from "@/components/ui";
import { getMapCenter, listPickupLocations, listShippingZones } from "@/lib/admin/shipping";

export const metadata: Metadata = { title: "Envíos" };

const TABS = [
  { value: "zonas", label: "Zonas" },
  { value: "retiro", label: "Retiro en local" },
  { value: "probar", label: "Probar dirección" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export default async function EnviosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.value === sp.tab) ? (sp.tab as Tab) : "zonas";

  const [zones, pickups, center] = await Promise.all([
    listShippingZones(),
    listPickupLocations(),
    tab === "zonas" ? null : getMapCenter(),
  ]);

  const activeZones = zones.filter((z) => z.isActive).length;
  const activePickups = pickups.filter((p) => p.isActive).length;
  const description = [
    zones.length === 0 ? "Sin zonas" : `${activeZones} ${activeZones === 1 ? "zona activa" : "zonas activas"} de ${zones.length}`,
    `${activePickups} ${activePickups === 1 ? "punto de retiro" : "puntos de retiro"}`,
  ].join(" · ");

  return (
    <>
      <PageHeader
        title="Envíos"
        description={description}
        actions={
          tab === "zonas" && zones.length > 0 ? (
            <ButtonLink href="/admin/envios/zonas/nueva" variant="primary" icon={<Plus aria-hidden />}>
              Nueva zona
            </ButtonLink>
          ) : null
        }
      >
        <TabsNav
          label="Secciones de envíos"
          items={TABS.map((t) => ({
            href: t.value === "zonas" ? "/admin/envios" : `/admin/envios?tab=${t.value}`,
            label: t.label,
            active: t.value === tab,
            count: t.value === "zonas" ? zones.length : t.value === "retiro" ? pickups.length : undefined,
          }))}
        />
      </PageHeader>

      {tab === "zonas" ? <ZonesList zones={zones} /> : null}
      {tab === "retiro" && center ? <PickupsPanel pickups={pickups} center={center} /> : null}
      {tab === "probar" && center ? <AddressTester zones={zones} center={center} /> : null}
    </>
  );
}

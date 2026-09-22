"use client";

import { FileDown, FileUp } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { Button, Skeleton } from "@/components/ui";
import { formatNumber } from "@/lib/money";
import { countVertices, geometryAreaKm2, geometryToPolygons, type ZoneGeometry } from "@/lib/shipping/geometry";

import { GeoJsonExportDialog, GeoJsonImportDialog } from "./GeoJsonDialogs";
import type { MapCenter } from "./map-shared";
import type { ReferenceZone } from "./ZonePolygonMap";

const ZonePolygonMap = dynamic(() => import("./ZonePolygonMap"), {
  ssr: false,
  loading: () => (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-[460px] w-full" />
    </div>
  ),
});

/** Mapa + estadísticas (área, vértices) + importar/exportar GeoJSON. */
export function PolygonEditor({
  value,
  onChange,
  center,
  referenceZones,
  zoneName,
}: {
  value: ZoneGeometry | null;
  onChange: (geometry: ZoneGeometry | null) => void;
  center: MapCenter;
  referenceZones?: ReferenceZone[];
  zoneName: string;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const polygons = geometryToPolygons(value).length;
  const km2 = geometryAreaKm2(value);

  return (
    <div className="space-y-3">
      <ZonePolygonMap
        value={value}
        onChange={onChange}
        center={center}
        referenceZones={referenceZones}
        fitSignal={fitSignal}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-border pt-3">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          <div className="flex gap-1.5">
            <dt className="text-adm-fg-muted">Polígonos</dt>
            <dd className="tnum font-medium">{polygons}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-adm-fg-muted">Vértices</dt>
            <dd className="tnum font-medium">{countVertices(value)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-adm-fg-muted">Área aproximada</dt>
            <dd className="tnum font-medium">
              {polygons ? `${formatNumber(km2, "es-AR", km2 < 10 ? 2 : 0)} km²` : "—"}
            </dd>
          </div>
        </dl>
        <div className="flex gap-2">
          <Button size="sm" icon={<FileUp aria-hidden />} onClick={() => setImportOpen(true)}>
            Importar GeoJSON
          </Button>
          <Button size="sm" icon={<FileDown aria-hidden />} onClick={() => setExportOpen(true)} disabled={!value}>
            Exportar
          </Button>
        </div>
      </div>

      <GeoJsonImportDialog open={importOpen} onOpenChange={setImportOpen} current={value}
        onImport={(g) => {
          onChange(g);
          setFitSignal((n) => n + 1);
        }}
      />
      <GeoJsonExportDialog open={exportOpen} onOpenChange={setExportOpen} geometry={value} name={zoneName} />
    </div>
  );
}

"use client";

/**
 * Mapa chico con un punto (Leaflet, cargar con next/dynamic ssr:false).
 * - Con `onPointChange`: el marcador se arrastra y un click en el mapa lo mueve.
 * - `overlays`: zonas por polígono para la herramienta "Probar dirección".
 */
import "leaflet/dist/leaflet.css";
import "./shipping-map.css";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polygon, TileLayer, Tooltip, useMapEvents } from "react-leaflet";

import { cn } from "@/lib/cn";
import { geometryBounds, geometryToPolygons, openRing, type LatLng, type ZoneGeometry } from "@/lib/shipping/geometry";

import { MAP_COLORS, OSM_ATTRIBUTION, OSM_TILES, type MapCenter } from "./map-shared";
import { WheelZoomOnFocus } from "./WheelZoomOnFocus";

export interface MapOverlay {
  id: string;
  name: string;
  geometry: ZoneGeometry;
  /** Incluye el punto (se pinta con el acento). */
  highlight?: boolean;
  /** Es la zona que gana. */
  winner?: boolean;
  inactive?: boolean;
}

export interface PointMapProps {
  point: LatLng | null;
  onPointChange?: (point: LatLng) => void;
  center: MapCenter;
  overlays?: MapOverlay[];
  height?: number;
  /** Zoom al centrar en el punto. */
  pointZoom?: number;
  label?: string;
  className?: string;
}

const draggablePin = L.divIcon({ className: "", html: '<div class="shp-pin is-draggable"></div>', iconSize: [22, 22], iconAnchor: [11, 22] });
const staticPin = L.divIcon({ className: "", html: '<div class="shp-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 22] });

const pointKey = (p: LatLng | null) => (p ? `${p.lat.toFixed(6)},${p.lng.toFixed(6)}` : null);

function ClickToPlace({ onPlace }: { onPlace?: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPlace?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function PointMap({
  point,
  onPointChange,
  center,
  overlays = [],
  height = 280,
  pointZoom = 16,
  label = "Mapa",
  className,
}: PointMapProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const editable = Boolean(onPointChange);

  // Centra en el punto cuando cambia desde afuera (geocodificación), no al arrastrar.
  // Dentro de un Drawer/dialog el contenedor cambia de tamaño durante la animación de apertura.
  useEffect(() => {
    if (!map) return;
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(t);
  }, [map]);

  const lastPoint = useRef<string | null>(null);
  useEffect(() => {
    if (!map) return;
    const key = pointKey(point);
    if (key === lastPoint.current) return;
    lastPoint.current = key;
    if (point) {
      map.setView([point.lat, point.lng], Math.max(map.getZoom(), pointZoom), { animate: false });
    } else if (overlays.length) {
      // Sin punto: encuadra las zonas.
      let b: L.LatLngBounds | null = null;
      for (const o of overlays) {
        const ob = geometryBounds(o.geometry);
        if (ob) b = b ? b.extend(ob) : L.latLngBounds(ob);
      }
      if (b) map.fitBounds(b, { padding: [16, 16], maxZoom: 14, animate: false });
    }
  }, [map, point, pointZoom, overlays]);

  return (
    <MapContainer
      ref={setMap}
      center={point ? [point.lat, point.lng] : [center.lat, center.lng]}
      zoom={point ? pointZoom : center.zoom}
      style={{ height }}
      className={cn("shp-map w-full border border-adm-border", editable && "is-picking", className)}
      scrollWheelZoom={false}
      aria-label={label}
    >
      <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />
      <WheelZoomOnFocus />
      {overlays.map((o) =>
        geometryToPolygons(o.geometry).map((rings, i) => (
          <Polygon
            key={`${o.id}-${i}-${o.highlight ? 1 : 0}`}
            positions={rings.map((r) => openRing(r).map(([lng, lat]) => [lat, lng] as [number, number]))}
            pathOptions={
              o.highlight
                ? {
                    color: o.winner ? MAP_COLORS.accent : MAP_COLORS.selected,
                    weight: o.winner ? 3 : 2,
                    fillOpacity: o.winner ? 0.18 : 0.1,
                    dashArray: o.inactive ? "4 4" : undefined,
                  }
                : { color: MAP_COLORS.inactive, weight: 1.5, dashArray: "4 4", fillOpacity: 0.05 }
            }
            interactive
            bubblingMouseEvents
          >
            <Tooltip sticky className="shp-tooltip">
              {o.name}
              {o.inactive ? " (inactiva)" : ""}
            </Tooltip>
          </Polygon>
        )),
      )}
      {point ? (
        <Marker
          position={[point.lat, point.lng]}
          icon={editable ? draggablePin : staticPin}
          draggable={editable}
          keyboard={editable}
          title={editable ? "Arrastrá para ajustar la ubicación" : undefined}
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              const next = { lat: ll.lat, lng: ll.lng };
              // Movido a mano: no re-centrar el mapa.
              lastPoint.current = pointKey(next);
              onPointChange?.(next);
            },
          }}
        />
      ) : null}
      {editable ? (
        <ClickToPlace
          onPlace={(p) => {
            // Elegido en el mapa: tampoco se re-centra.
            lastPoint.current = pointKey(p);
            onPointChange?.(p);
          }}
        />
      ) : null}
    </MapContainer>
  );
}

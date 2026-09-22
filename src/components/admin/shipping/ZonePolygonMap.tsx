"use client";

/**
 * Editor de polígonos sobre Leaflet (se carga con next/dynamic ssr:false
 * desde PolygonEditor). Herramienta de dibujo propia, sin leaflet-draw:
 *
 * - "Dibujar polígono": click agrega vértice; doble click, Enter o click en el
 *   primer punto cierra; click derecho, Backspace o "Deshacer punto" quita el
 *   último; Esc cancela.
 * - Click en un polígono lo selecciona: arrastrá los vértices para editar,
 *   click derecho en un vértice lo borra, click en un punto intermedio agrega
 *   un vértice. "Borrar polígono" elimina el seleccionado.
 * - Varios polígonos por zona → MultiPolygon.
 *
 * Controlado: recibe la geometría GeoJSON y devuelve la nueva en `onChange`.
 */
import "leaflet/dist/leaflet.css";
import "./shipping-map.css";

import L from "leaflet";
import { Check, Maximize2, PenLine, Trash2, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMapEvents } from "react-leaflet";

import { Button, ConfirmDialog, toast } from "@/components/ui";
import {
  closeRing,
  geometryBounds,
  geometryToPolygons,
  openRing,
  polygonsToGeometry,
  type PolygonRings,
  type ZoneGeometry,
} from "@/lib/shipping/geometry";

import { MAP_COLORS, OSM_ATTRIBUTION, OSM_TILES, type MapCenter, type PlaceResult } from "./map-shared";
import { WheelZoomOnFocus } from "./WheelZoomOnFocus";
import { MapSearch } from "./MapSearch";

type LL = [number, number]; // [lat, lng] (orden Leaflet)

interface EditablePolygon {
  /** Anillo exterior abierto, en [lat, lng]. */
  outer: LL[];
  /** Huecos tal cual vienen (GeoJSON cerrado): se conservan pero no se editan. */
  holes: PolygonRings;
}

export interface ReferenceZone {
  id: string;
  name: string;
  geometry: ZoneGeometry;
}

export interface ZonePolygonMapProps {
  value: ZoneGeometry | null;
  onChange: (geometry: ZoneGeometry | null) => void;
  center: MapCenter;
  /** Otras zonas por polígono (grises, de referencia). */
  referenceZones?: ReferenceZone[];
  height?: number;
  /** Cambiá este número para re-encuadrar el mapa en la geometría (ej. después de importar). */
  fitSignal?: number;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function fromGeometry(geometry: ZoneGeometry | null): EditablePolygon[] {
  return geometryToPolygons(geometry).map((rings) => ({
    outer: openRing(rings[0] ?? []).map(([lng, lat]) => [lat, lng] as LL),
    holes: rings.slice(1),
  }));
}

function toGeometry(polys: EditablePolygon[]): ZoneGeometry | null {
  const valid = polys.filter((p) => p.outer.length >= 3);
  return polygonsToGeometry(
    valid.map((p) => [closeRing(p.outer.map(([lat, lng]) => [round6(lng), round6(lat)])), ...p.holes]),
  );
}

function leafletRings(p: EditablePolygon): LL[][] {
  return [p.outer, ...p.holes.map((ring) => openRing(ring).map(([lng, lat]) => [lat, lng] as LL))];
}

const vertexIcon = L.divIcon({ className: "shp-vertex", iconSize: [12, 12], iconAnchor: [6, 6] });
const midpointIcon = L.divIcon({ className: "shp-midpoint", iconSize: [10, 10], iconAnchor: [5, 5] });

/** Eventos del mapa para el modo dibujo. */
function DrawEvents({
  drawing,
  draft,
  onAdd,
  onFinish,
  onUndo,
  onHover,
  onBackgroundClick,
}: {
  drawing: boolean;
  draft: LL[];
  onAdd: (p: LL) => void;
  onFinish: () => void;
  onUndo: () => void;
  onHover: (p: LL | null) => void;
  onBackgroundClick: () => void;
}) {
  const map = useMapEvents({
    click(e) {
      if (!drawing) {
        onBackgroundClick();
        return;
      }
      const pt = map.latLngToContainerPoint(e.latlng);
      const near = (ll: LL, px: number) => map.latLngToContainerPoint(L.latLng(ll[0], ll[1])).distanceTo(pt) < px;
      // Click sobre el primer punto: cierra.
      if (draft.length >= 3 && near(draft[0], 10)) {
        onFinish();
        return;
      }
      // Segundo click de un doble click (mismo lugar): se ignora.
      if (draft.length > 0 && near(draft[draft.length - 1], 6)) return;
      onAdd([e.latlng.lat, e.latlng.lng]);
    },
    dblclick() {
      if (drawing) onFinish();
    },
    contextmenu(e) {
      if (!drawing) return;
      e.originalEvent.preventDefault();
      onUndo();
    },
    mousemove(e) {
      if (drawing) onHover([e.latlng.lat, e.latlng.lng]);
    },
    mouseout() {
      if (drawing) onHover(null);
    },
  });

  useEffect(() => {
    if (drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    // `className` de MapContainer sólo se aplica al crear el mapa: el cursor de dibujo va por acá.
    map.getContainer().classList.toggle("is-drawing", drawing);
  }, [drawing, map]);

  return null;
}

export default function ZonePolygonMap({
  value,
  onChange,
  center,
  referenceZones = [],
  height = 460,
  fitSignal = 0,
}: ZonePolygonMapProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const polys = useMemo(() => fromGeometry(value), [value]);
  const [draft, setDraft] = useState<LL[] | null>(null);
  const [hover, setHover] = useState<LL | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const drawing = draft !== null;
  const sel = selected !== null && selected < polys.length ? selected : null;

  const commit = useCallback((next: EditablePolygon[]) => onChange(toGeometry(next)), [onChange]);

  const startDrawing = () => {
    setSelected(null);
    setDraft([]);
    map?.getContainer().focus();
  };

  const finishDrawing = useCallback(() => {
    if (!draft) return;
    if (draft.length < 3) {
      toast("Un polígono necesita al menos 3 vértices.");
      return;
    }
    const next = [...polys, { outer: draft, holes: [] }];
    commit(next);
    setDraft(null);
    setHover(null);
    setSelected(next.length - 1);
  }, [draft, polys, commit]);

  const cancelDrawing = useCallback(() => {
    setDraft(null);
    setHover(null);
  }, []);

  const undoPoint = useCallback(() => setDraft((d) => (d && d.length ? d.slice(0, -1) : d)), []);

  // Atajos de teclado mientras se dibuja.
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        cancelDrawing();
      } else if (e.key === "Enter") {
        e.preventDefault();
        finishDrawing();
      } else if (e.key === "Backspace" || (e.key === "z" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        undoPoint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, cancelDrawing, finishDrawing, undoPoint]);

  const updateVertex = (pi: number, vi: number, ll: L.LatLng) => {
    const next = polys.map((p, i) =>
      i === pi ? { ...p, outer: p.outer.map((v, j) => (j === vi ? ([ll.lat, ll.lng] as LL) : v)) } : p,
    );
    commit(next);
  };

  const removeVertex = (pi: number, vi: number) => {
    const target = polys[pi];
    if (!target) return;
    if (target.outer.length <= 3) {
      toast("Un polígono necesita al menos 3 vértices. Si querés sacarlo, usá “Borrar polígono”.");
      return;
    }
    commit(polys.map((p, i) => (i === pi ? { ...p, outer: p.outer.filter((_, j) => j !== vi) } : p)));
  };

  const insertVertex = (pi: number, afterIndex: number, ll: LL) => {
    commit(
      polys.map((p, i) =>
        i === pi ? { ...p, outer: [...p.outer.slice(0, afterIndex + 1), ll, ...p.outer.slice(afterIndex + 1)] } : p,
      ),
    );
  };

  const deleteSelected = () => {
    if (sel === null) return;
    commit(polys.filter((_, i) => i !== sel));
    setSelected(null);
  };

  const fitAll = useCallback(() => {
    const b = geometryBounds(value);
    if (map && b) map.fitBounds(b, { padding: [24, 24], maxZoom: 16, animate: false });
  }, [map, value]);

  // Encuadre inicial en los polígonos existentes.
  const fitted = useRef(false);
  useEffect(() => {
    if (!map || fitted.current) return;
    fitted.current = true;
    const b = geometryBounds(value);
    if (b) map.fitBounds(b, { padding: [24, 24], maxZoom: 16, animate: false });
  }, [map, value]);

  // Re-encuadre pedido desde afuera (importar GeoJSON).
  const lastFit = useRef(fitSignal);
  useEffect(() => {
    if (fitSignal === lastFit.current) return;
    lastFit.current = fitSignal;
    fitAll();
  }, [fitSignal, fitAll]);

  const goTo = (place: PlaceResult) => {
    if (!map) return;
    // Sin animación: salto directo (menos movimiento, DESIGN §8.14).
    if (place.bounds) map.fitBounds(place.bounds, { maxZoom: 16, animate: false });
    else map.setView([place.lat, place.lng], 15, { animate: false });
  };

  const hint = drawing
    ? draft && draft.length >= 3
      ? "Seguí marcando vértices. Para cerrar: doble click, Enter o click en el primer punto. Click derecho deshace el último."
      : "Hacé click en el mapa para marcar los vértices del área (mínimo 3). Esc cancela."
    : sel !== null
      ? "Arrastrá los vértices para ajustar. Click derecho en un vértice lo borra; click en un punto intermedio agrega uno."
      : polys.length
        ? "Hacé click en un polígono para editarlo, o dibujá otro para sumar un área (varios polígonos por zona)."
        : "Tocá “Dibujar polígono” y marcá el área de entrega en el mapa.";

  const draftLine: LL[] = draft ? (hover ? [...draft, hover] : draft) : [];

  return (
    <div className="space-y-2">
      <MapSearch onSelect={goTo} />

      <div className="flex flex-wrap items-center gap-2">
        {drawing ? (
          <>
            <Button size="sm" variant="primary" icon={<Check aria-hidden />} onClick={finishDrawing} disabled={(draft?.length ?? 0) < 3}>
              Cerrar polígono
            </Button>
            <Button size="sm" icon={<Undo2 aria-hidden />} onClick={undoPoint} disabled={!draft?.length}>
              Deshacer punto
            </Button>
            <Button size="sm" variant="ghost" icon={<X aria-hidden />} onClick={cancelDrawing}>
              Cancelar
            </Button>
            <span className="tnum text-xs text-adm-fg-muted">{draft?.length ?? 0} vértices</span>
          </>
        ) : (
          <>
            <Button size="sm" variant={polys.length ? "secondary" : "primary"} icon={<PenLine aria-hidden />} onClick={startDrawing}>
              {polys.length ? "Dibujar otro polígono" : "Dibujar polígono"}
            </Button>
            {sel !== null ? (
              <Button size="sm" variant="ghost" icon={<Trash2 aria-hidden />} onClick={deleteSelected} className="text-adm-danger hover:text-adm-danger">
                Borrar polígono
              </Button>
            ) : null}
            {polys.length ? (
              <>
                <Button size="sm" variant="ghost" icon={<Maximize2 aria-hidden />} onClick={fitAll}>
                  Encuadrar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
                  Limpiar
                </Button>
              </>
            ) : null}
          </>
        )}
      </div>

      <MapContainer
        ref={setMap}
        center={[center.lat, center.lng]}
        zoom={center.zoom}
        style={{ height }}
        className="shp-map w-full border border-adm-border"
        scrollWheelZoom={false}
        keyboard
        aria-label="Mapa para dibujar la zona"
      >
        <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />

        {referenceZones.map((z) =>
          geometryToPolygons(z.geometry).map((rings, i) => (
            <Polygon
              key={`ref-${z.id}-${i}`}
              positions={rings.map((r) => openRing(r).map(([lng, lat]) => [lat, lng] as LL))}
              pathOptions={{ color: MAP_COLORS.inactive, weight: 1.5, dashArray: "4 4", fillOpacity: 0.06 }}
              interactive={false}
            >
              <Tooltip sticky className="shp-tooltip">
                {z.name}
              </Tooltip>
            </Polygon>
          )),
        )}

        {polys.map((p, i) => (
          <Polygon
            // Se recrea al cambiar de modo: `interactive` sólo se lee al crear la capa.
            key={`poly-${i}-${drawing ? "d" : "e"}`}
            positions={leafletRings(p)}
            interactive={!drawing}
            bubblingMouseEvents={false}
            pathOptions={{
              color: i === sel ? MAP_COLORS.selected : MAP_COLORS.accent,
              weight: i === sel ? 3 : 2,
              fillColor: i === sel ? MAP_COLORS.selected : MAP_COLORS.accentFill,
              fillOpacity: i === sel ? 0.18 : 0.12,
            }}
            eventHandlers={{ click: () => setSelected(i) }}
          />
        ))}

        {sel !== null && !drawing
          ? polys[sel].outer.map((v, vi) => {
              const next = polys[sel].outer[(vi + 1) % polys[sel].outer.length];
              const mid: LL = [(v[0] + next[0]) / 2, (v[1] + next[1]) / 2];
              return [
                <Marker
                  key={`v-${sel}-${vi}`}
                  position={v}
                  icon={vertexIcon}
                  draggable
                  autoPan
                  title={`Vértice ${vi + 1}`}
                  eventHandlers={{
                    drag: (e) => updateVertex(sel, vi, (e.target as L.Marker).getLatLng()),
                    contextmenu: (e) => {
                      e.originalEvent.preventDefault();
                      removeVertex(sel, vi);
                    },
                  }}
                />,
                <Marker
                  key={`m-${sel}-${vi}`}
                  position={mid}
                  icon={midpointIcon}
                  title="Agregar vértice"
                  eventHandlers={{ click: () => insertVertex(sel, vi, mid) }}
                />,
              ];
            })
          : null}

        {drawing && draftLine.length > 1 ? (
          <Polyline positions={draftLine} interactive={false} pathOptions={{ color: MAP_COLORS.draft, weight: 2, dashArray: "6 4" }} />
        ) : null}
        {drawing && draft && draft.length >= 3 && hover ? (
          <Polyline positions={[hover, draft[0]]} interactive={false} pathOptions={{ color: MAP_COLORS.draft, weight: 1, dashArray: "2 6" }} />
        ) : null}
        {drawing
          ? draft?.map((v, i) => (
              <CircleMarker
                key={`d-${i}`}
                center={v}
                radius={i === 0 ? 6 : 4}
                interactive={false}
                pathOptions={{ color: MAP_COLORS.draft, weight: 2, fillColor: "#fff", fillOpacity: 1 }}
              />
            ))
          : null}

        <WheelZoomOnFocus />
        <DrawEvents
          drawing={drawing}
          draft={draft ?? []}
          onAdd={(p) => setDraft((d) => [...(d ?? []), p])}
          onFinish={finishDrawing}
          onUndo={undoPoint}
          onHover={setHover}
          onBackgroundClick={() => setSelected(null)}
        />
      </MapContainer>

      <p className="text-xs text-adm-fg-muted" aria-live="polite">
        {hint}
      </p>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Limpiar el mapa?"
        description="Se borran todos los polígonos de esta zona. No se guarda hasta que toques Guardar."
        confirmLabel="Limpiar polígonos"
        destructive
        onConfirm={() => {
          commit([]);
          setSelected(null);
        }}
      />
    </div>
  );
}

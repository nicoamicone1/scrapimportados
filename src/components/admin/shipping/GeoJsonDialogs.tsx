"use client";

import { Copy, Download } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, Dialog, Field, Textarea, toast } from "@/components/ui";
import { countVertices, geometryToPolygons, parseGeoJsonText, polygonsToGeometry, type ZoneGeometry } from "@/lib/shipping/geometry";

/** Importar GeoJSON (Polygon, MultiPolygon, Feature o FeatureCollection) con validación en vivo. */
export function GeoJsonImportDialog({
  open,
  onOpenChange,
  current,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: ZoneGeometry | null;
  onImport: (geometry: ZoneGeometry) => void;
}) {
  const [text, setText] = useState("");
  const result = useMemo(() => (text.trim() ? parseGeoJsonText(text) : null), [text]);
  const parsed = result?.ok ? result.geometry : null;
  const polygons = parsed ? geometryToPolygons(parsed).length : 0;

  const apply = (mode: "replace" | "append") => {
    if (!parsed) return;
    const next = mode === "append" && current ? polygonsToGeometry([...geometryToPolygons(current), ...geometryToPolygons(parsed)]) : parsed;
    if (!next) return;
    onImport(next);
    toast.success(`Importaste ${polygons === 1 ? "1 polígono" : `${polygons} polígonos`}.`);
    setText("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Importar GeoJSON"
      description="Pegá un Polygon, MultiPolygon, Feature o FeatureCollection (coordenadas en [longitud, latitud], WGS84). Lo podés exportar de geojson.io, QGIS o Google My Maps convertido."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
          {current ? (
            <Button onClick={() => apply("append")} disabled={!parsed}>
              Agregar a los actuales
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => apply("replace")} disabled={!parsed}>
            {current ? "Reemplazar polígonos" : "Importar"}
          </Button>
        </>
      }
    >
      <Field
        label="GeoJSON"
        error={result && !result.ok ? result.error : null}
        hint={
          parsed
            ? `Válido: ${polygons === 1 ? "1 polígono" : `${polygons} polígonos`}, ${countVertices(parsed)} vértices. Los anillos se cierran solos.`
            : "Se valida mientras pegás."
        }
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          spellCheck={false}
          className="font-mono text-xs"
          placeholder='{"type":"Polygon","coordinates":[[[-58.46,-34.53],[-58.34,-34.60],[-58.46,-34.70],[-58.46,-34.53]]]}'
        />
      </Field>
    </Dialog>
  );
}

/** Exportar la geometría actual como GeoJSON (copiar o descargar). */
export function GeoJsonExportDialog({
  open,
  onOpenChange,
  geometry,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  geometry: ZoneGeometry | null;
  name: string;
}) {
  const text = useMemo(
    () =>
      geometry
        ? JSON.stringify({ type: "Feature", properties: { name: name || "Zona" }, geometry }, null, 2)
        : "",
    [geometry, name],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("GeoJSON copiado.");
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(name || "zona").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Exportar GeoJSON"
      description="Feature con la geometría de la zona. Sirve para respaldo o para abrirla en geojson.io."
      footer={
        <>
          <Button icon={<Download aria-hidden />} onClick={download} disabled={!text}>
            Descargar .geojson
          </Button>
          <Button variant="primary" icon={<Copy aria-hidden />} onClick={copy} disabled={!text}>
            Copiar
          </Button>
        </>
      }
    >
      <Textarea value={text} readOnly rows={14} spellCheck={false} className="font-mono text-xs" aria-label="GeoJSON de la zona" />
    </Dialog>
  );
}

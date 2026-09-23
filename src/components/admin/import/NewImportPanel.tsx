"use client";

import { Download, FileSpreadsheet, Radar, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type DragEvent, type FormEvent } from "react";

import { createImportJob } from "@/app/admin/(panel)/importar/actions";
import { PlanGate } from "@/components/admin/PlanGate";
import { Badge, Button, Card, CardBody, Field, Input, Select, Tabs, toast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";
import { CSV_CREATE_COLUMNS, CSV_UPDATE_COLUMNS } from "@/lib/scraper/columns";
import { applyMarkup } from "@/lib/scraper/text";
import { ADAPTER_LABELS, type UrlAdapterId } from "@/lib/scraper/types";
import { CSV_MAX_BYTES, DEFAULT_IMPORT_OPTIONS, type CsvMode, type ImportOptions } from "@/lib/schemas/import";

import { ImportOptionsFields, type CategoryOption } from "./ImportOptionsFields";

interface DetectResponse {
  ok: true;
  url: string;
  adapter: UrlAdapterId;
  total: number | null;
  categories: number;
  sample: { name: string; price: number | null; compareAt: number | null; image: string | null; variants: number; url: string }[];
}

type ApiError = { ok: false; error: string };

export function NewImportPanel({ categories }: { categories: CategoryOption[] }) {
  return (
    <Card>
      <CardBody className="pt-2">
        <Tabs
          items={[
            {
              value: "url",
              label: "Desde una tienda online",
              content: (
                <PlanGate
                  feature="catalog.import_web"
                  className="mt-3"
                  description="Traé el catálogo de una tienda WooCommerce, Shopify o cualquier sitio con datos estructurados."
                >
                  <UrlImportForm categories={categories} />
                </PlanGate>
              ),
            },
            {
              value: "csv",
              label: "Archivo CSV",
              content: (
                <PlanGate
                  feature="catalog.import_csv"
                  className="mt-3"
                  description="Creá productos o actualizá precios y stock por SKU desde una planilla."
                >
                  <CsvImportForm categories={categories} />
                </PlanGate>
              ),
            },
          ]}
        />
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

function UrlImportForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [adapter, setAdapter] = useState<"auto" | UrlAdapterId>("auto");
  const [options, setOptions] = useState<ImportOptions>({ ...DEFAULT_IMPORT_OPTIONS, limit: 50 });
  const [detected, setDetected] = useState<DetectResponse | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const detect = async () => {
    if (!url.trim()) {
      setDetectError("Pegá la dirección de la tienda.");
      return;
    }
    setDetecting(true);
    setDetectError(null);
    setDetected(null);
    try {
      const res = await fetch("/api/import/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, adapter }),
      });
      const data = (await res.json()) as DetectResponse | ApiError;
      if (!data.ok) setDetectError(data.error);
      else {
        setDetected(data);
        setAdapter(data.adapter);
      }
    } catch {
      setDetectError("No pudimos conectarnos. Probá de nuevo.");
    } finally {
      setDetecting(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const r = await createImportJob({ url, adapter, options });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      router.push(`/admin/importar/${r.data.jobId}`);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-3 md:grid-cols-[1fr_200px_auto] md:items-end">
        <Field
          label="Dirección de la tienda, listado o sitemap"
          hint="Ej.: https://tienda.com.ar · Funciona con WooCommerce, Shopify y sitios con datos estructurados (JSON-LD)."
          error={detectError ?? errors.url}
        >
          <Input
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setDetected(null);
            }}
          />
        </Field>
        <Field label="Tipo de tienda">
          <Select
            value={adapter}
            onChange={(e) => setAdapter(e.target.value as "auto" | UrlAdapterId)}
            options={[
              { value: "auto", label: "Detectar automáticamente" },
              { value: "woocommerce", label: ADAPTER_LABELS.woocommerce },
              { value: "shopify", label: ADAPTER_LABELS.shopify },
              { value: "jsonld", label: ADAPTER_LABELS.jsonld },
            ]}
          />
        </Field>
        <Button onClick={detect} loading={detecting} icon={<Radar aria-hidden />} className="md:mb-[22px]" size="lg">
          Detectar
        </Button>
      </div>

      {detected ? <DetectPreview result={detected} options={options} /> : null}

      <div>
        <h3 className="mb-3 text-[15px] font-semibold text-adm-fg">Opciones</h3>
        <ImportOptionsFields value={options} onChange={setOptions} categories={categories} variant="url" errors={errors} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-adm-border pt-4">
        <p className="mr-auto text-[13px] text-adm-fg-muted">
          La importación corre por partes mientras tenés abierta la página del detalle. Podés pausarla y seguirla después.
        </p>
        <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!url.trim()}>
          Iniciar importación
        </Button>
      </div>
    </form>
  );
}

function DetectPreview({ result, options }: { result: DetectResponse; options: ImportOptions }) {
  return (
    <div className="rounded-adm border border-adm-border bg-adm-surface-2/50 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Badge tone="accent">{ADAPTER_LABELS[result.adapter]}</Badge>
        <span className="text-adm-fg">
          {result.total === null ? "Cantidad de productos: se sabe al recorrer el catálogo" : `${formatNumber(result.total)} productos`}
          {result.categories ? ` · ${formatNumber(result.categories)} categorías` : ""}
        </span>
      </div>
      {result.sample.length ? (
        <ul className="mt-3 divide-y divide-adm-border rounded-adm border border-adm-border bg-adm-surface">
          {result.sample.map((p) => {
            const final = applyMarkup(p.price, options.markup_percent, options.round_to);
            return (
              <li key={p.url || p.name} className="flex items-center gap-3 px-3 py-2">
                {p.image ? (
                  // Imagen remota del origen (sólo vista previa; no pasa por next/image).
                  // eslint-disable-next-line @next/next/no-img-element -- dominio arbitrario del origen
                  <img src={p.image} alt="" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-[4px] border border-adm-border object-cover" loading="lazy" />
                ) : (
                  <span aria-hidden className="size-10 shrink-0 rounded-[4px] border border-adm-border bg-adm-surface-2" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-adm-fg">{p.name}</p>
                  <p className="text-xs text-adm-fg-muted">{p.variants === 1 ? "1 variante" : `${p.variants} variantes`}</p>
                </div>
                <div className="tnum text-right text-[13px]">
                  <div className="text-adm-fg">{formatMoney(final)}</div>
                  {options.markup_percent ? <div className="text-xs text-adm-fg-muted">origen {formatMoney(p.price)}</div> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-adm-fg-muted">No pudimos leer productos de muestra, pero podés intentar la importación igual.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function CsvImportForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<CsvMode>("update");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [options, setOptions] = useState<ImportOptions>({ ...DEFAULT_IMPORT_OPTIONS, review: true });

  const pick = (f: File | null | undefined) => {
    setError(null);
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setError("El archivo tiene que ser .csv. En Excel: Archivo › Guardar como › CSV UTF-8.");
      return;
    }
    if (f.size > CSV_MAX_BYTES) {
      setError("El archivo supera los 8 MB. Dividilo en partes.");
      return;
    }
    setFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Elegí un archivo CSV.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("mode", mode);
      fd.set("options", JSON.stringify(options));
      const res = await fetch("/api/import/csv", { method: "POST", body: fd });
      const data = (await res.json()) as { ok: true; jobId: string } | ApiError;
      if (!data.ok) {
        setError(data.error);
        return;
      }
      router.push(`/admin/importar/${data.jobId}`);
    } catch {
      setError("No pudimos subir el archivo. Probá de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  const columns = mode === "update" ? CSV_UPDATE_COLUMNS : CSV_CREATE_COLUMNS;

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-adm-fg">Qué querés hacer</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              { v: "update", title: "Actualizar por SKU", text: "Precio, precio tachado, costo, stock y estado de variantes que ya existen. Ideal para la lista de precios del proveedor." },
              { v: "create", title: "Crear productos", text: "Una fila por variante, agrupadas por handle. Mismo formato que la exportación de productos." },
            ] as const
          ).map((o) => (
            <label
              key={o.v}
              className={cn(
                "flex cursor-pointer gap-3 rounded-adm border p-3 text-sm",
                mode === o.v ? "border-adm-accent bg-adm-accent-soft/40" : "border-adm-border hover:bg-adm-hover",
              )}
            >
              <input
                type="radio"
                name="csv-mode"
                value={o.v}
                checked={mode === o.v}
                onChange={() => setMode(o.v)}
                className="mt-0.5 accent-[var(--adm-accent)]"
              />
              <span>
                <span className="block font-medium text-adm-fg">{o.title}</span>
                <span className="block text-[13px] text-adm-fg-muted">{o.text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="csv-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-start gap-2 rounded-adm border border-dashed px-5 py-6 text-sm transition-colors",
            dragging ? "border-adm-accent bg-adm-accent-soft/40" : "border-adm-input-border bg-adm-surface-2/40 hover:bg-adm-hover",
            error && "border-adm-danger",
          )}
        >
          <span className="flex items-center gap-2 font-medium text-adm-fg">
            {file ? <FileSpreadsheet className="size-4" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {file ? file.name : "Arrastrá el archivo acá o hacé clic para elegirlo"}
          </span>
          <span className="text-[13px] text-adm-fg-muted">
            {file ? `${formatNumber(Math.ceil(file.size / 1024))} KB · Hacé clic para cambiarlo` : "CSV separado por coma o punto y coma, UTF-8. Hasta 8 MB y 20.000 filas."}
          </span>
          <input
            ref={inputRef}
            id="csv-file"
            type="file"
            accept=".csv,text/csv,.txt"
            className="sr-only"
            aria-describedby="csv-file-help"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        {error ? (
          <p id="csv-file-help" className="mt-1.5 text-xs text-adm-danger">
            {error}
          </p>
        ) : (
          <p id="csv-file-help" className="mt-1.5 text-xs text-adm-fg-muted">
            Antes de aplicar vas a ver una vista previa con los cambios fila por fila.
          </p>
        )}
      </div>

      <div className="rounded-adm border border-adm-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-adm-fg">Columnas {mode === "update" ? "(sólo sku es obligatoria)" : "(name y price son obligatorias)"}</p>
          <a
            href={`/api/import/template?mode=${mode}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-adm-accent underline-offset-2 hover:underline"
          >
            <Download className="size-4" aria-hidden />
            Descargar plantilla
          </a>
        </div>
        <p className="mt-1.5 font-mono text-xs leading-relaxed text-adm-fg-muted">{columns.join(", ")}</p>
        <p className="mt-1.5 text-xs text-adm-fg-muted">
          {mode === "update"
            ? "Celda vacía = no cambia. Precio tachado o costo en 0 = se quita. Estado: draft, active o archived (también borrador, activo, archivado)."
            : "Categorías con “>” para la jerarquía y “|” entre varias (Hogar > Cocina | Ofertas). Tags e imágenes separadas por “|”. Las filas con el mismo handle son variantes del mismo producto."}
        </p>
      </div>

      {mode === "create" ? (
        <div>
          <h3 className="mb-3 text-[15px] font-semibold text-adm-fg">Opciones</h3>
          <ImportOptionsFields value={options} onChange={setOptions} categories={categories} variant="csv-create" />
        </div>
      ) : null}

      <div className="flex justify-end border-t border-adm-border pt-4">
        <Button type="submit" variant="primary" size="lg" loading={uploading} disabled={!file}>
          Subir y ver la vista previa
        </Button>
      </div>
    </form>
  );
}

"use client";

import "./print3d.css";

import { CalendarClock, Crosshair, FilePlus2, Loader2, Trash2, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useStoreBase, useStorePath } from "@/components/store/StoreBase";
import { submitPrint3dQuote } from "@/app/s/[store]/impresion-3d/actions";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { suggestUnit } from "@/lib/print3d";
import type { Geometry, ItemChoice, LengthUnit, PublicConfig } from "@/lib/print3d/types";
import { waLink } from "@/lib/store/whatsapp";
import { createClient } from "@/lib/supabase/client";

import { BoxSketch } from "./BoxSketch";
import { biggestBed, defaultChoice, evaluatePiece, scaleFactor, summarize, type PieceEval } from "./evaluate";
import { PieceEditor, PieceReadout, reasonText } from "./PieceEditor";
import { describeChoice, formatDims, formatGrams, formatOf, formatPrintTime, formatReadyDate, safeFileStem } from "./shared";
import { useModelParser } from "./useModelParser";

const Viewer = dynamic(() => import("@/components/print3d/Viewer"), {
  ssr: false,
  loading: () => <div className="size-full" aria-hidden />,
});

const MAX_PIECES = 20;
const BUCKET = "print3d-files";

type PieceStatus = "reading" | "parsing" | "ready" | "error";

interface Piece {
  key: string;
  file: File;
  name: string;
  size: number;
  format: "stl" | "3mf";
  status: PieceStatus;
  progress: number;
  error: string | null;
  geometry: Geometry | null;
  positions: Float32Array | null;
  unit: LengthUnit;
  scalePct: number;
  suggested: LengthUnit | null;
  choice: ItemChoice;
  thumb: string | null;
  /** Ruta en el bucket si ya se subió (un reintento no la vuelve a subir). */
  uploadedPath: string | null;
}

interface Contact {
  name: string;
  phone: string;
  email: string;
}

type Phase = { kind: "idle" } | { kind: "uploading"; done: number; total: number } | { kind: "saving" };

const mb = (bytes: number) => bytes / (1024 * 1024);
const nfMb = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export interface QuoterProps {
  config: PublicConfig;
  whatsappPhone: string;
  storeName: string;
}

export function Quoter({ config, whatsappPhone }: QuoterProps) {
  const router = useRouter();
  const toPath = useStorePath();
  const { storeId } = useStoreBase();
  const uid = useId();
  const { parse } = useModelParser();
  const fileInput = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const [pieces, setPieces] = useState<Piece[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact>({ name: "", phone: "", email: "" });
  const [notes, setNotes] = useState("");
  const [contactErrors, setContactErrors] = useState<Partial<Record<keyof Contact, string>>>({});
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const maxMb = config.settings.max_file_mb;

  const patch = useCallback((key: string, p: Partial<Piece> | ((piece: Piece) => Partial<Piece>)) => {
    setPieces((list) => list.map((x) => (x.key === key ? { ...x, ...(typeof p === "function" ? p(x) : p) } : x)));
  }, []);

  // --- Archivos -------------------------------------------------------------
  const lastChoice = useRef<ItemChoice | null>(null);

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    setFormError(null);
    const room = MAX_PIECES - pieces.length;
    const accepted = files.slice(0, Math.max(room, 0));
    const skipped = files.length - accepted.length;
    setNotice(skipped > 0 ? `Hasta ${MAX_PIECES} piezas por cotización: ${skipped === 1 ? "quedó afuera 1 archivo" : `quedaron afuera ${skipped} archivos`}.` : null);
    const base = defaultChoice(config, lastChoice.current);
    if (!base) return;

    const fresh: Piece[] = accepted.map((file) => {
      const format = formatOf(file.name);
      const tooBig = mb(file.size) > maxMb;
      const error = !format
        ? "Sólo cotizamos STL o 3MF. Exportalo así desde tu programa de diseño."
        : tooBig
          ? `Pesa ${nfMb.format(mb(file.size))} MB y el máximo es ${maxMb} MB. Si es un 3MF con varias placas, exportá sólo la pieza.`
          : file.size < 84
            ? "El archivo está vacío o incompleto."
            : null;
      return {
        key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        name: file.name,
        size: file.size,
        format: format ?? "stl",
        status: error ? "error" : "reading",
        progress: 0,
        error,
        geometry: null,
        positions: null,
        unit: "mm",
        scalePct: 100,
        suggested: null,
        choice: { ...base },
        thumb: null,
        uploadedPath: null,
      };
    });
    setPieces((list) => [...list, ...fresh]);
    const firstOk = fresh.find((p) => !p.error);
    if (firstOk && (!selected || !pieces.some((p) => p.key === selected && p.status === "ready"))) setSelected(firstOk.key);

    for (const piece of fresh) {
      if (piece.error) continue;
      parse(piece.file, {
        onProgress: (p) => patch(piece.key, { progress: p }),
        onStage: (stage) => patch(piece.key, { status: stage }),
      })
        .then(({ geometry, positions }) => {
          if (!geometry || geometry.triangles < 4 || !(geometry.volume_mm3 > 0)) {
            patch(piece.key, { status: "error", error: "No encontramos una pieza sólida en el archivo. Revisá que tenga volumen (no sólo superficies)." });
            return;
          }
          const suggested = suggestUnit(geometry.bbox);
          patch(piece.key, {
            status: "ready",
            geometry,
            positions,
            // Si la pieza es diminuta en mm, lo más probable es que venga en cm o pulgadas: se sugiere, no se cambia solo.
            suggested,
            progress: 1,
          });
        })
        .catch((err: unknown) => {
          patch(piece.key, { status: "error", error: err instanceof Error ? err.message : "No pudimos leer el archivo." });
        });
    }
  };

  const removePiece = (key: string) => {
    const next = pieces.filter((p) => p.key !== key);
    setPieces(next);
    if (selected === key) setSelected(next.find((p) => p.status === "ready")?.key ?? next[0]?.key ?? null);
  };

  // Aviso al salir con piezas cargadas sin cotizar.
  const dirty = pieces.length > 0 && phase.kind === "idle";
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // --- Cálculo en vivo -------------------------------------------------------
  const evals = useMemo(() => {
    const map = new Map<string, PieceEval | null>();
    for (const p of pieces) {
      map.set(p.key, p.status === "ready" && p.geometry ? evaluatePiece({ geometry: p.geometry, unit: p.unit, scalePct: p.scalePct, choice: p.choice }, config) : null);
    }
    return map;
  }, [pieces, config]);

  const ready = pieces.filter((p) => p.status === "ready" && evals.get(p.key));
  const busy = pieces.filter((p) => p.status === "reading" || p.status === "parsing");
  const failed = pieces.filter((p) => p.status === "error");
  const summary = useMemo(
    () =>
      summarize(
        ready.map((p) => evals.get(p.key)!),
        ready.map((p) => p.choice.qty),
        config,
      ),
    // `ready` se deriva de pieces + evals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [evals, config],
  );
  const needsReview = ready.some((p) => (evals.get(p.key)?.reasons.length ?? 0) > 0);
  const readyDate = formatReadyDate(summary.ready?.date);

  const current = pieces.find((p) => p.key === selected) ?? null;
  const currentEval = current ? (evals.get(current.key) ?? null) : null;
  const currentMaterial = config.materials.find((m) => m.id === current?.choice.material_id);
  const bed = biggestBed(config.printers, currentMaterial?.type);

  const selectPiece = (key: string) => {
    setSelected(key);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewerRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const updateChoice = (key: string, p: Partial<ItemChoice>) => {
    patch(key, (piece) => {
      const choice = { ...piece.choice, ...p };
      lastChoice.current = choice;
      return { choice };
    });
  };

  // --- Enviar ----------------------------------------------------------------
  const validateContact = (): boolean => {
    const e: Partial<Record<keyof Contact, string>> = {};
    if (needsReview) {
      if (contact.name.trim().length < 2) e.name = "Decinos tu nombre.";
      if (!contact.phone.trim() && !contact.email.trim()) e.phone = "Dejanos un WhatsApp o un email para responderte.";
    }
    const digits = contact.phone.replace(/\D/g, "");
    if (contact.phone.trim() && (digits.length < 8 || digits.length > 15)) e.phone = "Revisá el WhatsApp: con código de área (ej. 11 5555 1234).";
    if (contact.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email.trim())) e.email = "Revisá el email: nombre@dominio.com.";
    setContactErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async () => {
    if (phase.kind !== "idle" || !ready.length || busy.length) return;
    setFormError(null);
    if (!validateContact()) {
      summaryRef.current?.scrollIntoView({ block: "center" });
      return;
    }
    if (!storeId) {
      setFormError("No pudimos identificar la tienda. Recargá la página.");
      return;
    }
    const supabase = createClient();
    const paths = new Map<string, string>();
    const toUpload = ready.filter((p) => !p.uploadedPath);
    setPhase({ kind: "uploading", done: 0, total: toUpload.length });
    let done = 0;
    for (const piece of ready) {
      if (piece.uploadedPath) {
        paths.set(piece.key, piece.uploadedPath);
        continue;
      }
      const path = `${storeId}/q/${crypto.randomUUID()}/${safeFileStem(piece.name)}.${piece.format}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, piece.file, {
        upsert: false,
        contentType: "application/octet-stream",
        cacheControl: "3600",
      });
      if (error) {
        setPhase({ kind: "idle" });
        setFormError(`No pudimos subir «${piece.name}». Revisá la conexión y probá de nuevo.`);
        return;
      }
      paths.set(piece.key, path);
      patch(piece.key, { uploadedPath: path });
      done++;
      setPhase({ kind: "uploading", done, total: toUpload.length });
    }

    setPhase({ kind: "saving" });
    const res = await submitPrint3dQuote({
      items: ready.map((p) => {
        const ev = evals.get(p.key)!;
        return {
          file_path: paths.get(p.key)!,
          file_name: p.name,
          file_size: p.size,
          format: p.format,
          geometry: ev.geometry,
          material_id: p.choice.material_id,
          color_id: p.choice.color_id,
          quality_id: p.choice.quality_id,
          infill_pct: p.choice.infill_pct,
          supports: p.choice.supports,
          qty: p.choice.qty,
        };
      }),
      contact: { name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.trim() },
      notes: notes.trim(),
      estimated_ready_date: summary.ready?.date ?? null,
      needs_review: needsReview,
    });
    if (!res.ok) {
      setPhase({ kind: "idle" });
      setFormError(res.error);
      const fe = res.fieldErrors ?? {};
      setContactErrors({
        name: fe["contact.name"]?.[0],
        phone: fe["contact.phone"]?.[0],
        email: fe["contact.email"]?.[0],
      });
      return;
    }
    router.push(toPath(`/impresion-3d/c/${res.data.token}`));
  };

  const quotaHit = formError?.includes("máximo de cotizaciones");
  const submitting = phase.kind !== "idle";
  const ctaLabel =
    phase.kind === "uploading"
      ? `Subiendo ${Math.min(phase.done + 1, phase.total)} de ${phase.total}…`
      : phase.kind === "saving"
        ? "Guardando la cotización…"
        : needsReview
          ? "Pedir revisión"
          : "Continuar";

  // --- Vistas ----------------------------------------------------------------
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };
  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragOver) setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop,
  };

  const fileInputEl = (
    <input
      ref={fileInput}
      id={`${uid}-files`}
      type="file"
      multiple
      accept=".stl,.3mf,model/stl,model/3mf"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        addFiles(Array.from(e.target.files ?? []));
        e.target.value = "";
      }}
    />
  );

  if (!pieces.length) {
    return (
      <div className="p3d">
        {fileInputEl}
        <div
          {...dropHandlers}
          data-over={dragOver ? "1" : undefined}
          className="p3d-drop p3d-bed flex min-h-[280px] flex-col items-start justify-end gap-4 rounded-lg p-5 sm:min-h-[340px] sm:p-8"
        >
          <div className="max-w-md rounded-md bg-bg p-4 sm:p-5">
            <p className="font-heading text-xl sm:text-2xl">Soltá tus STL o 3MF acá</p>
            <p className="mt-1.5 text-sm text-fg-muted">
              Hasta {MAX_PIECES} archivos, de hasta {maxMb} MB cada uno. Los leemos en tu navegador: ves el precio y la fecha antes de mandar nada.
            </p>
            <button type="button" className="btn btn-solid mt-4 w-full sm:w-auto" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" aria-hidden />
              Elegir archivos
            </button>
          </div>
        </div>
        <MaterialsStrip config={config} />
      </div>
    );
  }

  return (
    <div className="p3d grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
      {fileInputEl}
      <div className="min-w-0 space-y-6">
        {/* Visor + editor de la pieza elegida */}
        <section ref={viewerRef} aria-label="Pieza elegida" className="scroll-mt-[calc(var(--header-h)+12px)]">
          <div className="p3d-viewer relative aspect-[4/3] overflow-hidden rounded-lg border border-border sm:aspect-[16/10]">
            {current?.status === "ready" && current.positions ? (
              <Viewer
                className="absolute inset-0"
                positions={current.positions}
                scale={scaleFactor(current.unit, current.scalePct)}
                color={currentEval?.color.hex ?? "#999999"}
                bed={bed}
                resetSignal={resetSignal}
                label={`Vista 3D de ${current.name}`}
                onSnapshot={(url) => patch(current.key, { thumb: url })}
                fallback={
                  <div className="grid size-full place-items-center p-8 text-fg-muted">
                    <BoxSketch bbox={currentEval?.geometry.bbox ?? null} hex={currentEval?.color.hex ?? "#999"} className="h-2/3" />
                  </div>
                }
              />
            ) : (
              <div className="grid size-full place-items-center p-6 text-center text-sm text-fg-muted">
                {current?.status === "error" ? (
                  <p className="max-w-sm text-danger">{current.error}</p>
                ) : (
                  <div className="w-48">
                    <p>{current?.status === "parsing" ? "Analizando la malla…" : "Leyendo el archivo…"}</p>
                    <div className="p3d-progress mt-2">
                      <span style={{ width: `${Math.round((current?.status === "parsing" ? 1 : (current?.progress ?? 0)) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {current?.status === "ready" && currentEval ? (
              <>
                <p className="pointer-events-none absolute top-3 left-3 max-w-[70%] rounded-sm bg-bg/85 px-2 py-1 text-xs">
                  <span className="block truncate font-medium text-fg">{current.name}</span>
                  <span className="tnum text-fg-muted">{formatDims(currentEval.geometry.bbox)}</span>
                </p>
                <button
                  type="button"
                  className="absolute right-3 bottom-3 inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-xs text-fg"
                  onClick={() => setResetSignal((n) => n + 1)}
                >
                  <Crosshair className="size-3.5" aria-hidden />
                  Centrar
                </button>
                <p className="pointer-events-none absolute bottom-3 left-3 hidden text-xs sm:block">Arrastrá para girar · rueda para acercar</p>
              </>
            ) : null}
          </div>

          {current?.status === "ready" ? (
            <div className="mt-4 space-y-4">
              <PieceReadout evaluation={currentEval} qty={current.choice.qty} />
              {currentEval?.reasons.length ? (
                <ul className="space-y-1.5 rounded-md border border-border-strong p-3 text-sm" role="status">
                  <li className="font-medium">Esta pieza la revisa el taller antes de pasarte el precio final:</li>
                  {currentEval.reasons.map((r) => (
                    <li key={r} className="flex gap-2 text-fg-muted">
                      <span className="status-dot mt-1.5 shrink-0 text-accent" aria-hidden />
                      {reasonText(r, { bed, maxHours: config.settings.max_auto_hours })}
                    </li>
                  ))}
                </ul>
              ) : null}
              <PieceEditor
                name={current.name}
                config={config}
                choice={current.choice}
                unit={current.unit}
                scalePct={current.scalePct}
                suggestedUnit={current.unit === "mm" && current.scalePct === 100 ? current.suggested : null}
                evaluation={currentEval}
                biggestBed={bed}
                onChoice={(p) => updateChoice(current.key, p)}
                onUnit={(unit) => patch(current.key, { unit })}
                onScale={(scalePct) => patch(current.key, { scalePct })}
              />
            </div>
          ) : null}
        </section>

        {/* Lista de piezas */}
        <section aria-labelledby={`${uid}-list`}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 id={`${uid}-list`} className="text-base font-semibold">
              Piezas <span className="tnum font-normal text-fg-muted">({pieces.length})</span>
            </h2>
            {busy.length ? (
              <p className="tnum text-xs text-fg-muted" role="status">
                Analizando {pieces.length - busy.length - failed.length + 1} de {pieces.length - failed.length}…
              </p>
            ) : null}
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {pieces.map((p) => {
              const ev = evals.get(p.key) ?? null;
              const active = p.key === selected;
              return (
                <li key={p.key} className={cn("flex items-center gap-3 py-2.5", active && "bg-surface")}>
                  <button
                    type="button"
                    onClick={() => selectPiece(p.key)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-1 text-left"
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-sm border border-border bg-bg text-fg-muted">
                      {p.thumb ? (
                        // Miniatura sacada del visor (data URL local): no pasa por next/image.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumb} alt="" className="size-full object-contain" />
                      ) : p.status === "ready" && ev ? (
                        <BoxSketch bbox={ev.geometry.bbox} hex={ev.color.hex} className="size-10" />
                      ) : p.status === "error" ? (
                        <span className="text-xs text-danger">Error</span>
                      ) : (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      {p.status === "ready" && ev ? (
                        <span className="tnum block truncate text-xs text-fg-muted">
                          {formatDims(ev.geometry.bbox)} · {ev.material.name} {ev.color.name} · ×{p.choice.qty}
                        </span>
                      ) : p.status === "error" ? (
                        <span className="block text-xs text-danger">{p.error}</span>
                      ) : (
                        <span className="block text-xs text-fg-muted">{p.status === "parsing" ? "Analizando la malla…" : `Leyendo… ${Math.round(p.progress * 100)} %`}</span>
                      )}
                      {ev?.reasons.length ? <span className="block text-xs text-accent">La revisa el taller</span> : null}
                    </span>
                    {ev ? <span className="tnum shrink-0 text-sm">{formatMoney(ev.estimate.total)}</span> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => removePiece(p.key)}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-fg-muted hover:text-fg"
                    aria-label={`Sacar ${p.name}`}
                    disabled={submitting}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {pieces.length < MAX_PIECES ? (
            <div
              {...dropHandlers}
              data-over={dragOver ? "1" : undefined}
              className="p3d-drop mt-3 flex min-h-14 items-center justify-between gap-3 rounded-md px-4 py-2"
            >
              <span className="text-sm text-fg-muted">Soltá más archivos o</span>
              <button type="button" className="btn btn-secondary !min-h-10" onClick={() => fileInput.current?.click()} disabled={submitting}>
                <FilePlus2 className="size-4" aria-hidden />
                Sumar piezas
              </button>
            </div>
          ) : null}
          {notice ? <p className="mt-2 text-sm text-fg-muted">{notice}</p> : null}
        </section>
      </div>

      {/* Resumen */}
      <aside aria-label="Resumen de la cotización" className="lg:block">
        <div ref={summaryRef} id={`${uid}-resumen`} className="space-y-4 rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-[calc(var(--header-h)+24px)]">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">Tu cotización</p>
            {ready.length ? (
              <p className="tnum text-xs text-fg-muted">
                {summary.pieces} {summary.pieces === 1 ? "pieza" : "piezas"} · {formatGrams(summary.grams)} · {formatPrintTime(summary.minutes)}
              </p>
            ) : null}
          </div>
          {ready.length ? (
            <>
              <ul className="space-y-1.5 text-sm">
                {ready.map((p) => {
                  const ev = evals.get(p.key)!;
                  return (
                    <li key={p.key} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate">
                          {p.choice.qty > 1 ? <span className="tnum">{p.choice.qty} × </span> : null}
                          {p.name}
                        </span>
                        <span className="block truncate text-xs text-fg-muted">
                          {describeChoice({
                            materialName: ev.material.name,
                            colorName: ev.color.name,
                            qualityName: ev.quality.name,
                            infillPct: p.choice.infill_pct,
                            supports: p.choice.supports,
                          })}
                        </span>
                      </span>
                      <span className="tnum shrink-0">{formatMoney(ev.estimate.total)}</span>
                    </li>
                  );
                })}
              </ul>
              <dl className="tnum space-y-1.5 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Subtotal</dt>
                  <dd>{formatMoney(summary.totals.subtotal)}</dd>
                </div>
                {summary.totals.setup_fee > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Preparación del pedido</dt>
                    <dd>{formatMoney(summary.totals.setup_fee)}</dd>
                  </div>
                ) : null}
                {summary.totals.min_adjustment > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-fg-muted">Ajuste a pedido mínimo ({formatMoney(config.settings.min_order_price)})</dt>
                    <dd>{formatMoney(summary.totals.min_adjustment)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-border pt-2.5 text-base font-semibold">
                  <dt>{needsReview ? "Total estimado" : "Total"}</dt>
                  <dd>{formatMoney(summary.totals.total)}</dd>
                </div>
              </dl>
              <p className="flex gap-2 text-sm">
                <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {readyDate ? (
                    <>
                      Lo tenés listo aprox. el <strong className="font-semibold">{readyDate}</strong>
                    </>
                  ) : (
                    "Te confirmamos la fecha cuando revisemos las piezas."
                  )}
                  <span className="block text-xs text-fg-muted">Según la cola de impresión de hoy. Sin contar el envío.</span>
                </span>
              </p>
            </>
          ) : (
            <p className="text-sm text-fg-muted">{busy.length ? "Estamos leyendo tus archivos…" : "Sumá una pieza que se pueda leer para ver el precio."}</p>
          )}

          {needsReview ? (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm">
                Hay piezas que tiene que mirar el taller. Dejanos cómo contactarte y te pasamos el precio final.
              </p>
              <ContactField id={`${uid}-name`} label="Nombre" error={contactErrors.name}>
                {(p) => <input {...p} className="input" autoComplete="name" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} />}
              </ContactField>
              <ContactField id={`${uid}-phone`} label="WhatsApp" error={contactErrors.phone} help="Con código de área, ej. 11 5555 1234.">
                {(p) => (
                  <input {...p} type="tel" inputMode="tel" autoComplete="tel" className="input" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
                )}
              </ContactField>
              <ContactField id={`${uid}-email`} label="Email (opcional si dejás WhatsApp)" error={contactErrors.email}>
                {(p) => (
                  <input {...p} type="email" inputMode="email" autoComplete="email" className="input" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
                )}
              </ContactField>
            </div>
          ) : null}

          <details className="group border-t border-border pt-3 text-sm" open={Boolean(notes)}>
            <summary className="cursor-pointer text-fg-muted marker:content-none">
              <span className="link">¿Algo que tengamos que saber?</span> (opcional)
            </summary>
            <label htmlFor={`${uid}-notes`} className="sr-only">
              Notas para el taller
            </label>
            <textarea
              id={`${uid}-notes`}
              className="input mt-2"
              rows={3}
              maxLength={1000}
              placeholder="Para qué es la pieza, orientación, tolerancias, si va pintada…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </details>

          {formError ? (
            <div className="rounded-md border border-danger p-3 text-sm text-danger" role="alert">
              <p>{formError}</p>
              {quotaHit && whatsappPhone ? (
                <a className="link mt-1 inline-block text-fg" href={waLink(whatsappPhone, "Hola. Quiero cotizar una impresión 3D.")} target="_blank" rel="noopener noreferrer">
                  Escribir por WhatsApp
                </a>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className="btn btn-solid btn-block"
            onClick={submit}
            disabled={submitting || !ready.length || busy.length > 0}
            aria-busy={submitting || undefined}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {ctaLabel}
          </button>
          <p className="text-xs text-fg-muted">
            {busy.length
              ? "Esperá a que terminemos de leer los archivos."
              : failed.length
                ? `${failed.length === 1 ? "El archivo con error no entra" : "Los archivos con error no entran"} en la cotización.`
                : needsReview
                  ? "Guardamos tus archivos y te respondemos por WhatsApp o mail."
                  : `Guardamos la cotización por ${config.settings.quote_valid_days} días. En el paso siguiente elegís envío y pago.`}
          </p>
        </div>
      </aside>

      {/* Barra fija en el celular: total + seguir */}
      {ready.length ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="tnum min-w-0">
              <p className="text-xs text-fg-muted">{needsReview ? "Total estimado" : "Total"}</p>
              <p className="font-semibold">{formatMoney(summary.totals.total)}</p>
            </div>
            <button
              type="button"
              className="btn btn-solid"
              disabled={submitting || busy.length > 0}
              onClick={() => {
                if (needsReview) summaryRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
                else void submit();
              }}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {ctaLabel}
            </button>
          </div>
        </div>
      ) : null}
      {ready.length ? <div className="h-16 lg:hidden" aria-hidden /> : null}
    </div>
  );
}

function ContactField({
  id,
  label,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  help?: string;
  children: (p: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="field-help">
          {help}
        </p>
      ) : null}
    </div>
  );
}

/** Materiales y colores disponibles (antes de subir nada: dato concreto, no relleno). */
function MaterialsStrip({ config }: { config: PublicConfig }) {
  const materials = config.materials.filter((m) => m.colors.length);
  if (!materials.length) return null;
  const qualities = config.qualities.map((q) => q.name).join(" · ");
  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="eyebrow">Imprimimos en</p>
        <ul className="mt-2 space-y-2">
          {materials.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <span className="w-28 shrink-0 font-medium">{m.name}</span>
              <span className="flex flex-wrap gap-1.5">
                {m.colors.slice(0, 12).map((c) => (
                  <span
                    key={c.id}
                    title={c.available_grams > 0 ? c.name : `${c.name} · sin stock`}
                    className={cn("p3d-swatch relative size-5 rounded-sm border border-border-strong", c.available_grams <= 0 && "p3d-swatch-out")}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
                {m.colors.length > 12 ? <span className="text-xs text-fg-muted">+{m.colors.length - 12}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="text-sm">
        <p className="eyebrow">Cómo cotizamos</p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-fg-muted marker:text-fg">
          <li>Subís el STL o 3MF (se lee en tu navegador).</li>
          <li>Elegís material, color, calidad ({qualities || "capa"}) y relleno.</li>
          <li>Ves gramos, horas, precio y fecha al instante.</li>
        </ol>
      </div>
    </div>
  );
}

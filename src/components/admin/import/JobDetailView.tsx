"use client";

import { Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  discardImportJob,
  importSelectedItems,
  pauseImportJob,
  resumeImportJob,
  resyncImportJob,
} from "@/app/admin/(panel)/importar/actions";
import { Button, Card, CardBody, CardHeader, ConfirmDialog, PageHeader, Stat, StatStrip, toast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import { jobTitle, PHASES, type JobPhase } from "@/lib/scraper/job";
import type { JobDetail } from "@/lib/scraper/queries";
import { ADAPTER_LABELS, type AdapterId } from "@/lib/scraper/types";

import { JobStatusBadge } from "./JobStatusBadge";
import { JobItemsTable } from "./JobItemsTable";

const POLL_MS = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RunResponse =
  | { ok: true; done: boolean; waiting?: boolean; busy?: boolean; error?: string | null }
  | { ok: false; error: string };

function isActive(job: JobDetail) {
  return job.status === "queued" || (job.status === "running" && job.phase !== "review");
}

/** Detalle de un job: corre los pasos en loop, muestra progreso, log e ítems. */
export function JobDetailView({ initialJob }: { initialJob: JobDetail }) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [runner, setRunner] = useState<"idle" | "running" | "busy">("idle");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [acting, setActing] = useState(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/import/${initialJob.id}`, { cache: "no-store" });
      const data = (await res.json()) as { ok: true; job: JobDetail } | { ok: false; error: string };
      if (data.ok && mountedRef.current) setJob(data.job);
    } catch {
      // Se reintenta en el próximo ciclo.
    }
  }, [initialJob.id]);

  const runLoop = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunner("running");
    try {
      while (mountedRef.current) {
        let data: RunResponse;
        try {
          const res = await fetch(`/api/import/${initialJob.id}/run`, { method: "POST" });
          data = (await res.json()) as RunResponse;
        } catch {
          // Corte de red o timeout de la función: el cursor quedó guardado, se reintenta.
          await sleep(3000);
          continue;
        }
        if (!data.ok) {
          toast.error(data.error);
          break;
        }
        if (data.busy) {
          setRunner("busy");
          await sleep(3000);
          continue;
        }
        setRunner("running");
        await refresh();
        if (data.done || data.waiting) {
          if (data.error) toast.error(data.error);
          break;
        }
      }
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setRunner("idle");
      await refresh();
      router.refresh();
    }
  }, [initialJob.id, refresh, router]);

  // Arranque automático (una vez) y limpieza.
  const startActive = useRef(isActive(initialJob));
  useEffect(() => {
    mountedRef.current = true;
    if (startActive.current) {
      startActive.current = false;
      void runLoop();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [runLoop]);

  // Polling del estado mientras corre (otra pestaña puede ser la que avanza).
  const active = isActive(job);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [active, refresh]);

  // Autoscroll del log (salvo que el usuario haya subido a leer).
  useEffect(() => {
    const el = logRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [job.log.length]);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) => {
    setActing(true);
    try {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "No se pudo.");
      else if (success) toast.success(success);
      await refresh();
      return r.ok;
    } finally {
      setActing(false);
    }
  };

  const pause = () => act(() => pauseImportJob(job.id), "Importación pausada.");
  const resume = async () => {
    if (await act(() => resumeImportJob(job.id))) void runLoop();
  };
  const resync = async () => {
    setActing(true);
    try {
      const r = await resyncImportJob(job.id);
      if (!r.ok) toast.error(r.error);
      else router.push(`/admin/importar/${r.data.jobId}`);
    } finally {
      setActing(false);
    }
  };
  const onImportSelected = async ({ itemIds, all }: { itemIds: string[]; all: boolean }) => {
    const r = await importSelectedItems({ jobId: job.id, itemIds, all });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`Importando ${formatNumber(r.data.selected)} ítems…`);
    await refresh();
    void runLoop();
  };

  const reviewing = job.status === "running" && job.phase === "review";
  const discarded = job.status === "cancelled" && Boolean(job.finished_at);
  const s = job.stats;
  const processed = s.created + s.updated + s.skipped + s.errors;
  const title = jobTitle(job);
  const refreshKey = `${job.phase}|${job.status}|${processed}|${s.found}|${s.images}`;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Importar", href: "/admin/importar" }, { label: title }]}
        title={title}
        description={
          <>
            {ADAPTER_LABELS[job.adapter as AdapterId] ?? job.adapter}
            {job.csv ? ` · ${job.csv.mode === "update" ? "Actualizar por SKU" : "Crear productos"} · ${formatNumber(job.csv.rows)} filas` : ""}
            {" · "}
            <span title={formatDateTime(job.created_at)}>{formatRelative(job.created_at)}</span>
            {job.created_by_email ? ` · ${job.created_by_email}` : ""}
          </>
        }
        actions={
          <>
            {job.status === "running" || job.status === "queued" ? (
              reviewing ? (
                <Button icon={<Trash2 aria-hidden />} onClick={() => setConfirmDiscard(true)} disabled={acting}>
                  Descartar
                </Button>
              ) : (
                <Button icon={<Pause aria-hidden />} onClick={pause} loading={acting}>
                  Pausar
                </Button>
              )
            ) : null}
            {(job.status === "cancelled" && !discarded) || job.status === "failed" ? (
              <>
                <Button icon={<Trash2 aria-hidden />} onClick={() => setConfirmDiscard(true)} disabled={acting}>
                  Descartar
                </Button>
                <Button variant="primary" icon={<Play aria-hidden />} onClick={resume} loading={acting}>
                  Reanudar
                </Button>
              </>
            ) : null}
            {job.status === "done" && job.adapter !== "csv" ? (
              <Button variant="primary" icon={<RefreshCw aria-hidden />} onClick={resync} loading={acting}>
                Volver a sincronizar
              </Button>
            ) : null}
          </>
        }
      />

      <div className="space-y-5">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <JobStatusBadge status={job.status} phase={job.phase} finishedAt={job.finished_at} />
              <p className="text-sm text-adm-fg">
                <PhaseMessage job={job} runner={runner} />
              </p>
              {job.started_at ? (
                <p className="ml-auto text-[13px] text-adm-fg-muted tnum">
                  {job.finished_at ? `Duración ${duration(job.started_at, job.finished_at)}` : `En curso hace ${duration(job.started_at, new Date().toISOString())}`}
                </p>
              ) : null}
            </div>
            <PhaseSteps phase={job.phase} status={job.status} />
            <ProgressBar job={job} />
            {job.status === "failed" && job.error ? (
              <p role="alert" className="rounded-adm border border-adm-danger/30 bg-adm-danger-soft px-3 py-2 text-[13px] text-adm-danger">
                {job.error} Podés reanudarla: sigue desde donde quedó.
              </p>
            ) : null}
            {reviewing ? (
              <p className="rounded-adm border border-adm-border bg-adm-surface-2 px-3 py-2 text-[13px] text-adm-fg">
                Revisá la lista y elegí qué importar. Los cambios se aplican recién cuando confirmás.
                {job.options.markup_percent ? ` Los precios ya incluyen el recargo de ${formatNumber(job.options.markup_percent)} %.` : ""}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <StatStrip>
          <Stat label={job.adapter === "csv" ? "Filas" : "Encontrados"} value={formatNumber(s.found)} delta={job.total && job.adapter !== "csv" ? `de ${formatNumber(job.total)} en la fuente` : undefined} />
          <Stat label="Creados" value={formatNumber(s.created)} />
          <Stat label="Actualizados" value={formatNumber(s.updated)} />
          <Stat label="Omitidos" value={formatNumber(s.skipped)} />
          <Stat label="Con error" value={formatNumber(s.errors)} alert={s.errors > 0} />
          {job.adapter !== "csv" || job.csv?.mode === "create" ? <Stat label="Imágenes" value={formatNumber(s.images)} /> : null}
        </StatStrip>

        <Card>
          <CardHeader title="Registro" description="Últimas 200 líneas." />
          <div
            ref={logRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
            className="adm-scroll max-h-64 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed"
            role="log"
            aria-live="polite"
            tabIndex={0}
          >
            {job.log.length ? (
              job.log.map((l, i) => (
                <div key={`${l.t}-${i}`} className={cn("flex gap-3", l.level === "error" ? "text-adm-danger" : l.level === "warn" ? "text-adm-warning" : "text-adm-fg")}>
                  <time suppressHydrationWarning className="shrink-0 text-adm-fg-muted tnum" dateTime={l.t}>
                    {formatDateTime(l.t).slice(-5)}
                  </time>
                  <span className="break-words">{l.msg}</span>
                </div>
              ))
            ) : (
              <p className="text-adm-fg-muted">Sin registros todavía.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={reviewing ? "Elegí qué importar" : "Productos"}
            description={
              job.options.markup_percent && job.adapter !== "csv"
                ? `Precio final = origen + ${formatNumber(job.options.markup_percent)} %${job.options.round_to ? `, redondeado (${job.options.round_to === 990 ? "termina en 990" : `múltiplo de ${formatNumber(job.options.round_to)}`})` : ""}.`
                : undefined
            }
          />
          <CardBody>
            <JobItemsTable key={reviewing ? "review" : "list"} jobId={job.id} refreshKey={refreshKey} reviewing={reviewing} onImportSelected={onImportSelected} />
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Descartar esta importación"
        description="Los productos que ya se aplicaron quedan como están; lo pendiente no se importa. No se puede reanudar."
        confirmLabel="Descartar importación"
        destructive
        onConfirm={async () => {
          await act(() => discardImportJob(job.id), "Importación descartada.");
        }}
      />
    </>
  );
}

function duration(from: string, to: string): string {
  const secs = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  if (secs < 60) return `${secs} s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m} min ${secs % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function PhaseMessage({ job, runner }: { job: JobDetail; runner: "idle" | "running" | "busy" }) {
  if (job.status === "done") return <>Importación terminada.</>;
  if (job.status === "failed") return <>La importación se detuvo por un error.</>;
  if (job.status === "cancelled") return <>{job.finished_at ? "Importación descartada." : "Importación pausada. Reanudala cuando quieras."}</>;
  if (job.phase === "review") return <>Esperando tu revisión.</>;
  if (runner === "busy") return <>La importación está avanzando en otra pestaña.</>;
  const labels: Record<JobPhase, string> = {
    discover: "Detectando el catálogo…",
    fetch: "Leyendo productos de la fuente…",
    review: "",
    apply: "Creando y actualizando productos…",
    images: "Descargando y optimizando imágenes…",
    done: "Terminando…",
  };
  return <>{runner === "idle" && job.status === "running" ? "Retomando…" : labels[job.phase]}</>;
}

function PhaseSteps({ phase, status }: { phase: JobPhase; status: string }) {
  const idx = PHASES.findIndex((p) => p.id === phase);
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 text-[13px]" aria-label="Fases">
      {PHASES.map((p, i) => {
        const doneStep = i < idx || (status === "done" && p.id === "done");
        const current = i === idx && status !== "done";
        return (
          <li key={p.id} className="flex items-center gap-1" aria-current={current ? "step" : undefined}>
            {i > 0 ? <span aria-hidden className="mx-1 h-px w-4 bg-adm-border" /> : null}
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-adm-sm px-2",
                current ? "bg-adm-accent text-adm-accent-fg" : doneStep ? "bg-adm-accent-soft text-adm-accent" : "bg-adm-surface-2 text-adm-fg-muted",
              )}
            >
              {p.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ProgressBar({ job }: { job: JobDetail }) {
  const s = job.stats;
  let pct: number | null = null;
  let label = "";
  if (job.status === "done") {
    pct = 100;
    label = "Completo";
  } else if (job.phase === "fetch") {
    const target = job.total !== null ? Math.min(job.total, job.options.limit) : null;
    pct = target ? (job.fetched / target) * 100 : null;
    label = `${formatNumber(job.fetched)}${target ? ` de ${formatNumber(target)}` : ""} leídos`;
  } else if (job.phase === "apply" || job.phase === "review") {
    const processed = s.created + s.updated + s.skipped + s.errors;
    pct = s.found ? (processed / s.found) * 100 : null;
    label = `${formatNumber(processed)} de ${formatNumber(s.found)} procesados`;
  } else if (job.phase === "images") {
    label = `${formatNumber(s.images)} imágenes subidas`;
  } else if (job.phase === "discover") {
    label = "Preparando…";
  }
  const value = pct === null ? null : Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div
        role="progressbar"
        aria-label="Progreso"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        aria-valuetext={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-adm-surface-2"
      >
        <div
          className={cn("h-full rounded-full bg-adm-accent transition-[width] duration-200", value === null && "w-1/3 animate-pulse")}
          style={value === null ? undefined : { width: `${value}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-adm-fg-muted tnum">{label}</p>
    </div>
  );
}

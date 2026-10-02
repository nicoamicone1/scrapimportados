"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Inbox, Sparkles, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { moveJob } from "@/app/admin/(panel)/taller-3d/cola/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatHoursShort, formatMinutes, remainingMinutes } from "@/lib/admin/print3d-production-utils";

import { JobCard, SortableJobCard, type JobAction } from "./JobCard";
import { JobDialogs, type JobDialogState } from "./JobDialogs";
import { SuggestDialog } from "./SuggestDialog";
import { lookFor, type BoardData, type BoardPrinter, type Job } from "./types";
import { useNow } from "./useNow";

/*
 * Tablero de la cola (TALLER-3D §6): una columna por impresora + "Sin
 * asignar". Arrastre por la manija (mouse, touch con espera y teclado) para
 * asignar y reordenar; sólo se mueven trabajos en cola. El estado local es
 * optimista y se reemplaza cuando el server manda datos nuevos.
 */

const UNASSIGNED = "col:unassigned";
const colId = (printerId: string) => `col:${printerId}`;
const printerOf = (col: string) => (col === UNASSIGNED ? null : col.slice(4));

type Columns = Record<string, string[]>;

const STATUS_RANK: Record<string, number> = { printing: 0, post: 1, queued: 2 };

function buildColumns(jobs: Job[], printers: BoardPrinter[]): Columns {
  const cols: Columns = { [UNASSIGNED]: [] };
  for (const p of printers) cols[colId(p.id)] = [];
  const sorted = [...jobs].sort(
    (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.position - b.position || a.created_at.localeCompare(b.created_at),
  );
  for (const j of sorted) {
    const key = j.printer_id && cols[colId(j.printer_id)] ? colId(j.printer_id) : UNASSIGNED;
    cols[key].push(j.id);
  }
  return cols;
}

type StatusFilter = "all" | "queued" | "printing" | "post";

export function ProductionBoard({ data }: { data: BoardData }) {
  const router = useRouter();
  const now = useNow(data.nowIso);
  // Inactivas fuera del tablero; en mantenimiento se ven (se les puede cargar cola).
  const printers = useMemo(() => data.printers.filter((p) => p.status !== "inactive"), [data.printers]);
  const jobsById = useMemo(() => new Map(data.jobs.map((j) => [j.id, j])), [data.jobs]);

  const [columns, setColumns] = useState<Columns>(() => buildColumns(data.jobs, printers));
  const [prevJobs, setPrevJobs] = useState(data.jobs);
  if (prevJobs !== data.jobs) {
    setPrevJobs(data.jobs);
    setColumns(buildColumns(data.jobs, printers));
  }

  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Columns | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [material, setMaterial] = useState("");
  const [dialog, setDialog] = useState<JobDialogState | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const filtering = status !== "all" || material !== "";
  const visible = (j: Job) => (status === "all" || j.status === status) && (!material || lookFor(j, data.catalog).materialType === material);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumn = (id: UniqueIdentifier): string | null => {
    const key = String(id);
    if (key in columns) return key;
    return Object.keys(columns).find((c) => columns[c].includes(key)) ?? null;
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setSnapshot(columns);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findColumn(active.id);
    const to = findColumn(over.id);
    if (!from || !to || from === to) return;
    setColumns((prev) => {
      const id = String(active.id);
      const target = prev[to].filter((x) => x !== id);
      const overIndex = target.indexOf(String(over.id));
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, id);
      return { ...prev, [from]: prev[from].filter((x) => x !== id), [to]: target };
    });
  };

  const reset = () => {
    setActiveId(null);
    setSnapshot(null);
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    const before = snapshot;
    reset();
    if (!over || !before) {
      if (before) setColumns(before);
      return;
    }
    const col = findColumn(id);
    if (!col) return;
    let next = columns;
    const overCol = findColumn(over.id);
    if (overCol === col && String(over.id) !== id && !(String(over.id) in columns)) {
      const list = columns[col];
      next = { ...columns, [col]: arrayMove(list, list.indexOf(id), list.indexOf(String(over.id))) };
      setColumns(next);
    }
    const fromCol = Object.keys(before).find((c) => before[c].includes(id));
    const unchanged = fromCol === col && before[col].indexOf(id) === next[col].indexOf(id);
    if (unchanged) return;

    const res = await moveJob({ jobId: id, printerId: printerOf(col), orderedIds: next[col] });
    if (!res.ok) {
      setColumns(before);
      toast.error(res.error);
      return;
    }
    if (fromCol !== col) {
      const p = printers.find((x) => colId(x.id) === col);
      toast.success(p ? `Va a ${p.name}.` : "Quedó sin asignar.");
    }
    router.refresh();
  };

  const onAction = (action: JobAction, job: Job) => setDialog({ action, job });

  const unassignedCount = columns[UNASSIGNED].length;
  const activePrinters = printers.filter((p) => p.status === "active");
  const materialTypes = [...new Set(data.jobs.map((j) => lookFor(j, data.catalog).materialType).filter(Boolean))] as string[];
  const dialogPrinter = dialog?.job.printer_id ? data.printers.find((p) => p.id === dialog.job.printer_id) : undefined;
  const activeJob = activeId ? jobsById.get(activeId) : undefined;

  const startBlock = (printer: BoardPrinter | undefined, busy: boolean): string | null => {
    if (!printer) return "Asignalo a una impresora para empezar.";
    if (printer.status !== "active") return `${printer.name} está en mantenimiento.`;
    if (busy) return `${printer.name} ya está imprimiendo otro trabajo.`;
    return null;
  };

  const renderColumn = (key: string, printer: BoardPrinter | null) => {
    const ids = columns[key] ?? [];
    const jobs = ids.map((id) => jobsById.get(id)).filter((j): j is Job => Boolean(j));
    const shown = jobs.filter(visible);
    const backlog = jobs.reduce((s, j) => s + remainingMinutes(j, now), 0);
    const busy = jobs.some((j) => j.status === "printing");
    const printing = jobs.find((j) => j.status === "printing");
    return (
      <BoardColumn
        key={key}
        id={key}
        printer={printer}
        count={jobs.length}
        backlogMinutes={backlog}
        dailyPrintHours={data.dailyPrintHours}
        printingTitle={printing?.title ?? null}
        onSuggest={!printer && unassignedCount > 0 && activePrinters.length > 0 ? () => setSuggestOpen(true) : undefined}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {shown.map((j) => {
            const block = j.status === "queued" ? startBlock(printer ?? undefined, busy) : null;
            return (
              <SortableJobCard
                key={j.id}
                job={j}
                look={lookFor(j, data.catalog)}
                today={data.today}
                now={now}
                printerColor={printer?.color}
                canStart={!block}
                startBlockedReason={block}
                onAction={onAction}
                dragDisabled={filtering}
              />
            );
          })}
        </SortableContext>
        {!jobs.length ? (
          <p className="rounded-adm border border-dashed border-adm-border px-3 py-6 text-center text-xs text-adm-fg-muted">
            {printer ? (printer.status === "active" ? "Libre. Arrastrá un trabajo acá." : "En mantenimiento.") : "Todo asignado."}
          </p>
        ) : jobs.length && !shown.length ? (
          <p className="px-1 py-3 text-xs text-adm-fg-muted">Nada con estos filtros.</p>
        ) : null}
      </BoardColumn>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          size="sm"
          aria-label="Estado"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="w-40"
          options={[
            { value: "all", label: "Todos los estados" },
            { value: "queued", label: "En cola" },
            { value: "printing", label: "Imprimiendo" },
            { value: "post", label: "Post-proceso" },
          ]}
        />
        <Select
          size="sm"
          aria-label="Material"
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          className="w-40"
          options={[{ value: "", label: "Todos los materiales" }, ...materialTypes.map((m) => ({ value: m, label: m }))]}
        />
        {filtering ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => { setStatus("all"); setMaterial(""); }}>
              Limpiar filtros
            </Button>
            <span className="text-xs text-adm-fg-muted">Con filtros no se puede arrastrar.</span>
          </>
        ) : null}
        <Button
          size="sm"
          variant={unassignedCount ? "primary" : "secondary"}
          icon={<Sparkles />}
          className="ml-auto"
          onClick={() => setSuggestOpen(true)}
          disabled={!unassignedCount || !activePrinters.length}
          title={!activePrinters.length ? "No hay impresoras activas." : !unassignedCount ? "No hay trabajos sin impresora." : undefined}
        >
          Sugerir asignación
        </Button>
      </div>

      <DndContext
        id="print3d-board"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          if (snapshot) setColumns(snapshot);
          reset();
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable: "Para mover un trabajo, apretá espacio, usá las flechas para cambiar de lugar o de impresora y espacio otra vez para soltarlo. Escape cancela.",
          },
        }}
      >
        <div className="adm-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:snap-none sm:px-0">
          {renderColumn(UNASSIGNED, null)}
          {printers.map((p) => renderColumn(colId(p.id), p))}
        </div>
        <DragOverlay>
          {activeJob ? (
            <JobCard
              job={activeJob}
              look={lookFor(activeJob, data.catalog)}
              today={data.today}
              now={now}
              canStart={false}
              onAction={() => undefined}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {!printers.length ? (
        <p className="mt-2 text-[13px] text-adm-fg-muted">
          No hay impresoras cargadas: los trabajos quedan en &quot;Sin asignar&quot; hasta que cargues alguna en Impresoras.
        </p>
      ) : null}

      <JobDialogs
        state={dialog}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null);
          router.refresh();
        }}
        look={dialog ? lookFor(dialog.job, data.catalog) : null}
        spools={data.spools}
        printerName={dialogPrinter?.name ?? null}
        now={now}
      />
      <SuggestDialog open={suggestOpen} onOpenChange={setSuggestOpen} data={data} now={now} onDone={() => router.refresh()} />
    </div>
  );
}

function BoardColumn({
  id,
  printer,
  count,
  backlogMinutes,
  dailyPrintHours,
  printingTitle,
  onSuggest,
  children,
}: {
  id: string;
  printer: BoardPrinter | null;
  count: number;
  backlogMinutes: number;
  dailyPrintHours: number;
  printingTitle: string | null;
  onSuggest?: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const days = backlogMinutes / 60 / Math.max(1, dailyPrintHours);
  return (
    <section
      aria-label={printer ? `Impresora ${printer.name}` : "Sin asignar"}
      className={cn(
        "flex w-[86vw] max-w-[340px] shrink-0 snap-start flex-col rounded-adm border border-adm-border bg-adm-surface-2/70 sm:w-[300px]",
        isOver && "border-adm-accent-2 bg-adm-accent-2-soft/40",
      )}
    >
      <header
        className="rounded-t-adm border-t-4 bg-adm-surface px-3 pt-2.5 pb-2"
        style={{ borderTopColor: printer ? printer.color : "var(--adm-border)" }}
      >
        <div className="flex items-center gap-2">
          {printer ? null : <Inbox className="size-4 text-adm-fg-muted" aria-hidden />}
          <h2 className="min-w-0 truncate text-[15px] font-semibold text-adm-fg">{printer ? printer.name : "Sin asignar"}</h2>
          {printer?.status === "maintenance" ? (
            <Badge tone="amber" className="shrink-0">
              <Wrench className="size-3" aria-hidden />
              Mantenimiento
            </Badge>
          ) : null}
          <span className="tnum ml-auto shrink-0 text-xs text-adm-fg-muted">{count}</span>
        </div>
        <p className="tnum mt-0.5 truncate text-xs text-adm-fg-muted">
          {printer ? (
            backlogMinutes > 0 ? (
              <>
                <span className="font-medium text-adm-fg">{formatHoursShort(backlogMinutes)}</span> cargadas ·{" "}
                {days < 1 ? "se libera hoy" : `${days.toLocaleString("es-AR", { maximumFractionDigits: 1 })} días`}
              </>
            ) : (
              "Sin cola"
            )
          ) : count ? (
            `${formatMinutes(backlogMinutes)} sin impresora`
          ) : (
            "Todo tiene impresora"
          )}
        </p>
        {printer && printingTitle ? <p className="mt-1 truncate text-xs text-adm-fg-muted">Imprimiendo: {printingTitle}</p> : null}
        {onSuggest ? (
          <Button size="sm" variant="link" className="mt-1 text-xs" onClick={onSuggest}>
            Repartir entre las impresoras
          </Button>
        ) : null}
      </header>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 p-2">
        {children}
      </div>
    </section>
  );
}

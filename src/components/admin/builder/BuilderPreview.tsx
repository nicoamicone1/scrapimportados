"use client";

import { Loader2 } from "lucide-react";
import { memo, startTransition, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { previewBlocks } from "@/app/admin/(panel)/paginas/actions";
import { BLOCK_META } from "@/lib/blocks/defaults";
import type { Block } from "@/lib/blocks/schema";
import { cn } from "@/lib/cn";
import type { Theme } from "@/lib/theme";

import { PreviewFrame } from "../appearance/PreviewFrame";
import type { PreviewDevice } from "../appearance/preview-css";

import type { BlockPreviewNode } from "./render-preview";

/*
 * Preview del builder: los bloques se renderizan en el SERVER con los
 * componentes reales de la tienda (action `previewBlocks`, debounce 250 ms)
 * y acá se envuelven para poder seleccionarlos con un click.
 *
 * Para que editar no "recargue" el editor:
 * - Caché por contenido (`renderKey`): sólo viajan al server los bloques que
 *   cambiaron; volver a un valor anterior o cambiar de dispositivo y volver
 *   es instantáneo.
 * - Mientras llega el render nuevo se sigue mostrando el anterior del bloque.
 * - Los nodos nuevos entran en una transición y cada bloque tiene su
 *   `<Suspense>`: si un nodo suspende (chunk de una isla client que todavía no
 *   cargó, stream sin terminar) no sube hasta el `loading.tsx` de la ruta,
 *   que reemplazaba TODO el editor por el esqueleto.
 */

/** Todo lo que cambia el HTML de un bloque en el server. */
function renderKey(block: Block, prev: Block | undefined, first: boolean, device: PreviewDevice): string {
  return JSON.stringify([
    device,
    first, // h1 e imágenes prioritarias
    prev ? [prev.type, prev.style.background, prev.style.container] : null, // regla divisoria, título pegado
    { ...block, style: { ...block.style, hidden: undefined } }, // "oculto" sólo se atenúa acá
  ]);
}

interface Wanted {
  id: string;
  key: string;
}

interface PreviewState {
  /** Render por `renderKey` (`null` = el bloque no muestra nada en la tienda). */
  nodes: Map<string, ReactNode | null>;
  /** Error de validación por `renderKey`. */
  invalid: Map<string, string>;
  /** Último `renderKey` resuelto de cada bloque (se muestra mientras llega el nuevo). */
  latest: Map<string, string>;
}

const MAX_CACHED = 300;

function wantedFor(blocks: Block[], device: PreviewDevice): Wanted[] {
  return blocks.map((b, i) => ({ id: b.id, key: renderKey(b, blocks[i - 1], i === 0, device) }));
}

function initialState(blocks: Block[], initialNodes: BlockPreviewNode[]): PreviewState {
  const byId = new Map(initialNodes.map((n) => [n.id, n.node]));
  const state: PreviewState = { nodes: new Map(), invalid: new Map(), latest: new Map() };
  for (const w of wantedFor(blocks, "desktop")) {
    if (!byId.has(w.id)) continue;
    state.nodes.set(w.key, byId.get(w.id) ?? null);
    state.latest.set(w.id, w.key);
  }
  return state;
}

function merge(state: PreviewState, request: Wanted[], nodes: BlockPreviewNode[], invalid: { id: string; message: string }[]): PreviewState {
  const keyOf = new Map(request.map((w) => [w.id, w.key]));
  const next: PreviewState = { nodes: new Map(state.nodes), invalid: new Map(state.invalid), latest: new Map(state.latest) };
  for (const n of nodes) {
    const key = keyOf.get(n.id);
    if (!key) continue;
    next.nodes.set(key, n.node);
    next.latest.set(n.id, key);
  }
  for (const i of invalid) {
    const key = keyOf.get(i.id);
    if (key) next.invalid.set(key, i.message);
  }
  // Poda: quedan sólo los renders que hoy se usan.
  if (next.nodes.size > MAX_CACHED) {
    const used = new Set([...request.map((w) => w.key), ...next.latest.values()]);
    for (const key of next.nodes.keys()) if (!used.has(key)) next.nodes.delete(key);
    for (const key of next.invalid.keys()) if (!used.has(key)) next.invalid.delete(key);
  }
  return next;
}

const EMPTY_REASON: Partial<Record<Block["type"], string>> = {
  product_slider: "No hay productos para esta fuente: en la tienda no se muestra.",
  product_grid: "No hay productos para esta fuente: en la tienda no se muestra.",
  category_list: "No hay categorías con productos para mostrar.",
  testimonials: "Sin reseñas: en la tienda no se muestra. Cargá sólo reseñas reales.",
  features: "Agregá al menos un beneficio.",
  faq: "Agregá al menos una pregunta con respuesta.",
  banner_grid: "Agregá al menos un banner con imagen o título.",
  heading: "Escribí el título.",
  countdown: "La cuenta terminó y no tiene texto de cierre: en la tienda no se muestra.",
  video: "Pegá un link de YouTube, Vimeo o un .mp4.",
  rich_text: "El texto está vacío.",
};

export function BuilderPreview({
  blocks,
  theme,
  device,
  selectedId,
  onSelect,
  initialNodes,
}: {
  blocks: Block[];
  theme: Theme;
  device: PreviewDevice;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  initialNodes: BlockPreviewNode[];
}) {
  const [state, setState] = useState<PreviewState>(() => initialState(blocks, initialNodes));
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(new Set<string>());
  const wanted = useMemo(() => wantedFor(blocks, device), [blocks, device]);

  useEffect(() => {
    const missing = wanted.filter((w) => !state.nodes.has(w.key) && !state.invalid.has(w.key) && !inflight.current.has(w.key));
    if (!missing.length) return;
    const timer = window.setTimeout(async () => {
      for (const w of missing) inflight.current.add(w.key);
      setPending((n) => n + 1);
      const r = await previewBlocks(
        blocks,
        device,
        missing.map((w) => w.id),
      ).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Error de red" }));
      for (const w of missing) inflight.current.delete(w.key);
      setPending((n) => n - 1);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // Transición: si algún nodo suspende, se sigue viendo el render anterior.
      startTransition(() => {
        setError(null);
        // Los renders se guardan por contenido: una respuesta vieja sigue siendo válida para sus claves.
        setState((s) => merge(s, wanted, r.data.nodes, r.data.invalid));
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [wanted, blocks, device, state]);

  // Al seleccionar desde la lista, llevar el bloque a la vista.
  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector<HTMLElement>(`[data-pv-id="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const wrap = target.closest<HTMLElement>("[data-pv-id]");
    // Flechas del carrusel, preguntas frecuentes y play de video siguen funcionando.
    const passthrough = target.closest(".blk-arrow, summary, .blk-video button");
    if (!passthrough) {
      e.preventDefault();
      e.stopPropagation();
    }
    onSelect(wrap?.dataset.pvId ?? null);
  };

  return (
    <div className="relative">
      <div className="pointer-events-none sticky top-0 z-20 flex h-0 justify-end">
        {pending > 0 ? (
          <span className="mt-2 mr-2 inline-flex h-6 items-center gap-1.5 rounded-adm bg-adm-surface px-2 text-xs text-adm-fg-muted shadow-[var(--adm-shadow)]">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Actualizando
          </span>
        ) : null}
      </div>
      {error ? <p className="mb-2 text-xs text-adm-danger">No se pudo actualizar la vista previa: {error}</p> : null}
      <PreviewFrame theme={theme} device={device} onClickCapture={onClickCapture} label="Vista previa de la página">
        {blocks.length === 0 ? (
          <div className="px-6 py-16 text-center" style={{ fontFamily: "var(--font-admin)" }}>
            <p className="text-base font-semibold text-adm-fg">La página está vacía</p>
            <p className="mt-1 text-[13px] text-adm-fg-muted">Agregá bloques desde la columna de la izquierda.</p>
          </div>
        ) : null}
        {blocks.map((block, i) => {
          const { key } = wanted[i];
          // Render actual; si todavía no llegó, el último que tuvo el bloque.
          const shownKey = state.nodes.has(key) || state.invalid.has(key) ? key : state.latest.get(block.id);
          return (
            <PreviewBlock
              key={block.id}
              id={block.id}
              type={block.type}
              known={shownKey !== undefined && state.nodes.has(shownKey)}
              node={shownKey === undefined ? null : (state.nodes.get(shownKey) ?? null)}
              bad={state.invalid.get(key)}
              selected={block.id === selectedId}
              hidden={Boolean(block.style.hidden)}
              mobileHidden={device === "mobile" && Boolean(block.style.hideOnMobile)}
            />
          );
        })}
      </PreviewFrame>
    </div>
  );
}

/** Memo: tipear en un bloque no vuelve a reconciliar el resto del preview. */
const PreviewBlock = memo(function PreviewBlock({
  id,
  type,
  known,
  node,
  bad,
  selected,
  hidden,
  mobileHidden,
}: {
  id: string;
  type: Block["type"];
  known: boolean;
  node: ReactNode | null;
  bad: string | undefined;
  selected: boolean;
  hidden: boolean;
  mobileHidden: boolean;
}) {
  const label = BLOCK_META[type].label;
  const loading = <Placeholder label={label} text="Cargando…" />;
  return (
    <div data-pv-id={id} className={cn("group/pv relative cursor-pointer", hidden && "opacity-40")}>
      {bad ? (
        <Placeholder label={label} text={`Hay un dato inválido: ${bad}`} tone="danger" />
      ) : mobileHidden ? (
        <Placeholder label={label} text="Oculto en celulares." />
      ) : !known ? (
        loading
      ) : node === null ? (
        <Placeholder label={label} text={EMPTY_REASON[type] ?? "No hay nada para mostrar."} />
      ) : (
        <Suspense fallback={loading}>{node}</Suspense>
      )}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-10 transition-shadow",
          selected ? "shadow-[inset_0_0_0_2px_var(--adm-accent)]" : "group-hover/pv:shadow-[inset_0_0_0_1px_var(--adm-accent)]",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 left-0 z-10 rounded-br-[4px] bg-adm-accent px-1.5 py-0.5 text-[11px] font-medium text-adm-accent-fg",
          selected ? "opacity-100" : "opacity-0 group-hover/pv:opacity-100",
        )}
        style={{ fontFamily: "var(--font-admin)", letterSpacing: 0, textTransform: "none" }}
      >
        {label}
        {hidden ? " · oculto" : ""}
      </span>
    </div>
  );
});

function Placeholder({ label, text, tone }: { label: string; text: string; tone?: "danger" }) {
  return (
    <div className="px-4 py-3" style={{ fontFamily: "var(--font-admin)" }}>
      <div
        className={cn(
          "rounded-[6px] border border-dashed px-4 py-5 text-[13px]",
          tone === "danger" ? "border-adm-danger text-adm-danger" : "border-adm-input-border text-adm-fg-muted",
        )}
        style={{ background: "var(--adm-surface)" }}
      >
        <span className="font-medium text-adm-fg">{label}.</span> {text}
      </div>
    </div>
  );
}

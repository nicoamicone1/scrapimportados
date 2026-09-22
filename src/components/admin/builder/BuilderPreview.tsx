"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

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
 */

type NodeMap = Record<string, ReactNode | null>;

function toMap(nodes: BlockPreviewNode[]): NodeMap {
  return Object.fromEntries(nodes.map((n) => [n.id, n.node]));
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
  const [nodes, setNodes] = useState<NodeMap>(() => toMap(initialNodes));
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const firstRun = useRef(true);
  const key = JSON.stringify(blocks);

  useEffect(() => {
    // El primer render ya vino del server.
    if (firstRun.current && device === "desktop") {
      firstRun.current = false;
      return;
    }
    firstRun.current = false;
    const current = ++seq.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const r = await previewBlocks(JSON.parse(key) as unknown[], device);
      if (current !== seq.current) return;
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setNodes(toMap(r.data.nodes));
      setInvalid(Object.fromEntries(r.data.invalid.map((i) => [i.id, i.message])));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [key, device]);

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
        {loading ? (
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
        {blocks.map((block) => {
          const node = nodes[block.id];
          const known = block.id in nodes;
          const selected = block.id === selectedId;
          const hidden = Boolean(block.style.hidden);
          const mobileHidden = device === "mobile" && block.style.hideOnMobile;
          const bad = invalid[block.id];
          const label = BLOCK_META[block.type].label;
          return (
            <div key={block.id} data-pv-id={block.id} className={cn("group/pv relative cursor-pointer", hidden && "opacity-40")}>
              {bad ? (
                <Placeholder label={label} text={`Hay un dato inválido: ${bad}`} tone="danger" />
              ) : mobileHidden ? (
                <Placeholder label={label} text="Oculto en celulares." />
              ) : !known ? (
                <Placeholder label={label} text="Cargando…" />
              ) : node === null ? (
                <Placeholder label={label} text={EMPTY_REASON[block.type] ?? "No hay nada para mostrar."} />
              ) : (
                node
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
        })}
      </PreviewFrame>
    </div>
  );
}

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

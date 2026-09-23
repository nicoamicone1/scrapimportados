"use client";

import "@/components/blocks/blocks.css";
import "@/app/s/[store]/store.css";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { CartProvider } from "@/lib/cart";
import { cn } from "@/lib/cn";
import type { Theme } from "@/lib/theme";

import { PREVIEW_WIDTH, previewCss, storeRootAttrs, themeFontsHref, type PreviewDevice } from "./preview-css";

/**
 * Marco del preview del storefront dentro del admin, SIN iframe: aplica el
 * tema a `#preview-root` (variables scoped), carga las fuentes y simula el
 * ancho del dispositivo (390 / 1280 px) escalando con `zoom` para que entre
 * en el panel. Los bloques usan container queries, así que responden al
 * ancho simulado y no al de la ventana.
 */
export function PreviewFrame({
  theme,
  device,
  children,
  className,
  onClickCapture,
  label = "Vista previa de la tienda",
}: {
  theme: Theme;
  device: PreviewDevice;
  children: ReactNode;
  className?: string;
  onClickCapture?: (e: React.MouseEvent<HTMLDivElement>) => void;
  label?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const width = PREVIEW_WIDTH[device];

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoom = available ? Math.min(1, (available - 2) / width) : 1;
  const fontsHref = themeFontsHref(theme);

  return (
    <div ref={outer} className={cn("min-w-0", className)}>
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      <style dangerouslySetInnerHTML={{ __html: previewCss(theme, "#preview-root", device) }} />
      <div
        className="mx-auto overflow-hidden rounded-adm border border-adm-border shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
        style={{ width: width * zoom + 2 }}
      >
        <div style={{ width, zoom }}>
          <div
            id="preview-root"
            role="region"
            aria-label={label}
            className="store-root relative"
            data-device={device}
            onClickCapture={onClickCapture}
            {...storeRootAttrs(theme)}
          >
            <CartProvider>{children}</CartProvider>
          </div>
        </div>
      </div>
    </div>
  );
}

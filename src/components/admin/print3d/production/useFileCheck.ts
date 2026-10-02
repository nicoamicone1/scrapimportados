"use client";

import { useEffect, useRef, useState } from "react";

import { compareGeometry, type GeometryComparison } from "@/lib/admin/print3d-production-utils";
import type { Geometry, ParseResponse } from "@/lib/print3d/types";

/*
 * Verificación automática de una cotización: baja cada archivo con su URL
 * firmada, lo analiza con el motor en un Web Worker (no congela el panel) y
 * compara con la geometría que declaró el navegador del cliente.
 */

export type FileCheck =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; file: Geometry; positions: Float32Array; comparison: GeometryComparison | null };

export interface CheckTarget {
  id: string;
  url: string | null;
  fileName: string;
  declared: Geometry | null;
}

export function useFileChecks(targets: readonly CheckTarget[]): Record<string, FileCheck> {
  const [checks, setChecks] = useState<Record<string, FileCheck>>(() =>
    Object.fromEntries(targets.map((t) => [t.id, t.url ? { status: "loading" } : { status: "error", error: "El archivo no está en el depósito." }])),
  );

  // Ya verificados: un refresh del server (URLs firmadas nuevas) no vuelve a bajar los archivos.
  const done = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    let worker: Worker | null = null;
    const set = (id: string, c: FileCheck) => {
      if (cancelled) return;
      done.current.add(id);
      setChecks((prev) => ({ ...prev, [id]: c }));
    };

    const parse = (buf: ArrayBuffer, fileName: string, id: string) =>
      new Promise<{ geometry: Geometry; positions: Float32Array }>((resolve, reject) => {
        worker ??= new Worker(new URL("../../../../lib/print3d/worker.ts", import.meta.url), { type: "module" });
        const w = worker;
        const onMessage = (e: MessageEvent<ParseResponse>) => {
          if (e.data.id !== id) return;
          w.removeEventListener("message", onMessage);
          if (e.data.ok) resolve({ geometry: e.data.geometry, positions: e.data.positions });
          else reject(new Error(e.data.error));
        };
        w.addEventListener("message", onMessage);
        w.onerror = (ev) => {
          ev.preventDefault();
          reject(new Error("No pudimos analizar el archivo en este navegador."));
        };
        w.postMessage({ id, buf, fileName }, [buf]);
      });

    (async () => {
      // De a uno: un STL de 2 M de triángulos ya ocupa bastante memoria.
      for (const t of targets) {
        if (cancelled) return;
        if (!t.url || done.current.has(t.id)) continue;
        try {
          const res = await fetch(t.url);
          if (!res.ok) throw new Error(res.status === 404 ? "El archivo ya no está en el depósito." : "No se pudo bajar el archivo.");
          const buf = await res.arrayBuffer();
          const { geometry, positions } = await parse(buf, t.fileName, t.id);
          set(t.id, { status: "ready", file: geometry, positions, comparison: t.declared ? compareGeometry(t.declared, geometry) : null });
        } catch (err) {
          set(t.id, { status: "error", error: err instanceof Error && err.message ? err.message : "No se pudo verificar el archivo." });
        }
      }
    })();

    return () => {
      cancelled = true;
      worker?.terminate();
    };
    // `targets` tiene que venir memoizado; los ya verificados no se repiten.
  }, [targets]);

  return checks;
}

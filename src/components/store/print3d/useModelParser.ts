"use client";

import { useCallback, useEffect, useRef } from "react";

import type { Geometry } from "@/lib/print3d/types";

/*
 * Parseo de STL/3MF en un Web Worker (no congela la UI). Contrato del worker
 * en `src/lib/print3d/types.ts`:
 *   postMessage({ id, buf, fileName }) →
 *     { id, ok: true, geometry, positions } | { id, ok: false, error }
 * Un solo worker por cotizador; los archivos se mandan de a uno (la memoria
 * de un 3MF grande se libera antes de leer el siguiente).
 */

export interface ParsedModel {
  geometry: Geometry;
  positions: Float32Array;
}

type WorkerReply = { id: number; ok: true; geometry: Geometry; positions: Float32Array } | { id: number; ok: false; error: string };

interface Pending {
  resolve: (m: ParsedModel) => void;
  reject: (e: Error) => void;
}

const READ_ERROR = "No pudimos leer el archivo. Probá exportarlo de nuevo desde tu programa de diseño.";

/** Lee un File con progreso (0–1). */
function readWithProgress(file: File, onProgress: (p: number) => void): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    reader.onerror = () => reject(new Error(READ_ERROR));
    reader.onabort = () => reject(new Error(READ_ERROR));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error(READ_ERROR));
    };
    reader.readAsArrayBuffer(file);
  });
}

export function useModelParser() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, Pending>());
  const seq = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const failAll = useCallback((message: string) => {
    for (const p of pending.current.values()) p.reject(new Error(message));
    pending.current.clear();
  }, []);

  const getWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("../../../lib/print3d/worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      const reply = e.data;
      const p = pending.current.get(reply.id);
      if (!p) return;
      pending.current.delete(reply.id);
      if (reply.ok) p.resolve({ geometry: reply.geometry, positions: reply.positions });
      else p.reject(new Error(reply.error || READ_ERROR));
    };
    worker.onerror = (e) => {
      e.preventDefault();
      failAll(READ_ERROR);
      // Un worker caído (p. ej. sin memoria) no se reusa.
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
    workerRef.current = worker;
    return worker;
  }, [failAll]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      failAll("Se canceló la lectura.");
    },
    [failAll],
  );

  /**
   * Encola un archivo: lo lee (progreso de lectura) y lo analiza en el worker.
   * `onStage` avisa cuándo pasa de leer a analizar.
   */
  const parse = useCallback(
    (file: File, hooks: { onProgress?: (p: number) => void; onStage?: (stage: "reading" | "parsing") => void } = {}): Promise<ParsedModel> => {
      const run = async (): Promise<ParsedModel> => {
        hooks.onStage?.("reading");
        const buf = await readWithProgress(file, (p) => hooks.onProgress?.(p));
        hooks.onStage?.("parsing");
        const id = ++seq.current;
        return new Promise<ParsedModel>((resolve, reject) => {
          pending.current.set(id, { resolve, reject });
          try {
            getWorker().postMessage({ id, buf, fileName: file.name }, [buf]);
          } catch {
            pending.current.delete(id);
            reject(new Error(READ_ERROR));
          }
        });
      };
      const next = queue.current.then(run, run);
      // La cola sigue aunque un archivo falle.
      queue.current = next.catch(() => undefined);
      return next;
    },
    [getWorker],
  );

  return { parse };
}

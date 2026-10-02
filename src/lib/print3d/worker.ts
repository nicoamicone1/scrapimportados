/*
 * Taller 3D — Web Worker de parseo. Lee el STL/3MF, lo analiza y devuelve la
 * geometría + los vértices (transferidos, sin copiar) para el visor.
 * Uso: `new Worker(new URL("@/lib/print3d/worker.ts", import.meta.url))`.
 * No toca el DOM; no se reexporta desde index.ts.
 */
import { analyzeMesh, parseModel } from "./mesh";
import type { ParseRequest, ParseResponse } from "./types";

/** Lo mínimo del scope del worker (el tsconfig usa la lib "dom"). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<ParseRequest>) => void) | null;
  postMessage(message: ParseResponse, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, buf, fileName } = event.data;
  try {
    const mesh = parseModel(buf, fileName);
    const geometry = analyzeMesh(mesh);
    scope.postMessage({ id, ok: true, geometry, positions: mesh.positions }, [mesh.positions.buffer]);
  } catch (err) {
    const error = err instanceof Error && err.message ? err.message : "No pudimos leer el archivo.";
    scope.postMessage({ id, ok: false, error }, []);
  }
};

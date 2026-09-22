"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/actions";

/** Copia inmutable de `obj` con `path` ("a.b.0.c") reemplazado por `value`. */
export function setIn<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const walk = (node: unknown, i: number): unknown => {
    const key = keys[i];
    const isIndex = /^\d+$/.test(key);
    const base: Record<string, unknown> | unknown[] = Array.isArray(node)
      ? [...node]
      : node && typeof node === "object"
        ? { ...(node as Record<string, unknown>) }
        : isIndex
          ? []
          : {};
    const current = (base as Record<string, unknown>)[key];
    (base as Record<string, unknown>)[key] = i === keys.length - 1 ? value : walk(current, i + 1);
    return base;
  };
  return walk(obj, 0) as T;
}

export interface SettingsForm<T> {
  values: T;
  setValues: (next: T | ((prev: T) => T)) => void;
  /** Cambia un campo por path con puntos. */
  set: (path: string, value: unknown) => void;
  /** Primer error del campo (paths de zod con puntos). */
  error: (path: string) => string | undefined;
  errors: Record<string, string[]>;
  dirty: boolean;
  saving: boolean;
  save: () => void;
  discard: () => void;
}

/**
 * Estado de un formulario de Configuración: valores, dirty, errores por
 * campo (de `ActionResult.fieldErrors`), guardado con toast, aviso al salir
 * con cambios sin guardar y Ctrl/⌘ S para guardar.
 */
export function useSettingsForm<T>(
  initial: T,
  action: (values: T) => Promise<ActionResult<unknown>>,
  options: { successMessage?: string; onSaved?: (values: T) => void } = {},
): SettingsForm<T> {
  const router = useRouter();
  const [baseline, setBaseline] = useState(initial);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(baseline), [values, baseline]);

  const set = useCallback((path: string, value: unknown) => {
    setValues((prev) => setIn(prev, path, value));
    setErrors((prev) => {
      if (!prev[path]) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const { successMessage = "Cambios guardados.", onSaved } = options;

  const save = useCallback(() => {
    startTransition(async () => {
      const res = await action(values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      setBaseline(values);
      toast.success(successMessage);
      onSaved?.(values);
      router.refresh();
    });
  }, [action, values, successMessage, onSaved, router]);

  const discard = useCallback(() => {
    setValues(baseline);
    setErrors({});
  }, [baseline]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) save();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKey);
    };
  }, [dirty, saving, save]);

  const error = useCallback((path: string) => errors[path]?.[0], [errors]);

  return { values, setValues, set, error, errors, dirty, saving, save, discard };
}

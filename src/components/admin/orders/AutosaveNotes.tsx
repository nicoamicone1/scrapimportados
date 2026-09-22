"use client";

import { useEffect, useRef, useState } from "react";

import { Textarea } from "@/components/ui/Input";
import type { ActionResult } from "@/lib/actions";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const LABELS: Record<SaveState, string> = {
  idle: "",
  dirty: "Sin guardar",
  saving: "Guardando…",
  saved: "Guardado",
  error: "No se pudo guardar",
};

/**
 * Notas con autoguardado (1 s después de dejar de escribir y al salir del
 * campo). Sirve para las notas internas del pedido y del cliente.
 */
export function AutosaveNotes({
  id,
  label,
  initial,
  placeholder,
  save,
  rows = 4,
}: {
  id: string;
  label: string;
  initial: string;
  placeholder?: string;
  save: (value: string) => Promise<ActionResult>;
  rows?: number;
}) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const lastSaved = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = async (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (text === lastSaved.current) {
      setState((s) => (s === "dirty" ? "saved" : s));
      return;
    }
    setState("saving");
    const res = await save(text);
    if (res.ok) {
      lastSaved.current = text;
      setState("saved");
    } else setState("error");
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Aviso al salir con cambios sin guardar.
  useEffect(() => {
    if (state !== "dirty" && state !== "saving") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-adm-fg">
          {label}
        </label>
        <span
          aria-live="polite"
          className={state === "error" ? "text-xs text-adm-danger" : "text-xs text-adm-fg-muted"}
        >
          {LABELS[state]}
        </span>
      </div>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        maxLength={5000}
        onChange={(e) => {
          const text = e.target.value;
          setValue(text);
          setState("dirty");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void flush(text), 1000);
        }}
        onBlur={() => void flush(value)}
      />
    </div>
  );
}

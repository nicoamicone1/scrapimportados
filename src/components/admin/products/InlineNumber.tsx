"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/cn";
import { parseMoney } from "@/lib/money";

/**
 * Número editable en la celda: click → input; Enter o salir del campo guarda,
 * Esc cancela. Muestra spinner y un check al guardar. Con `chip` se dibuja
 * como botón de 44 px con etiqueta (celular).
 */
export function InlineNumber({
  label,
  value,
  display,
  money,
  chip,
  onSave,
}: {
  label: string;
  value: number;
  display: string;
  money?: boolean;
  chip?: string;
  onSave: (value: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(t);
  }, [state]);

  const start = () => {
    cancelled.current = false;
    setText(money ? String(value).replace(".", ",") : String(value));
    setEditing(true);
  };

  const commit = async () => {
    if (cancelled.current) return;
    const parsed = money ? parseMoney(text) : Number.parseInt(text, 10);
    setEditing(false);
    if (!Number.isFinite(parsed) || text.trim() === "") {
      toast.error(money ? "Ingresá un precio válido." : "Ingresá un número entero.");
      return;
    }
    if (parsed === value) return;
    setState("saving");
    const okSave = await onSave(parsed);
    setState(okSave ? "saved" : "error");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelled.current = true;
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label={label}
        inputMode={money ? "decimal" : "numeric"}
        enterKeyHint="done"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void commit()}
        className={cn(
          "tnum rounded-adm border border-adm-accent bg-adm-surface text-right outline-none",
          chip ? "h-11 w-full px-3 text-base" : "h-7 w-24 px-2 text-[13px] pointer-coarse:h-11 pointer-coarse:text-base",
        )}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={start}
      title="Tocá para editar"
      aria-label={`${label}: ${display}. Editar`}
      className={cn(
        "tnum inline-flex items-center gap-1 rounded-adm hover:bg-adm-surface-2 hover:ring-1 hover:ring-adm-input-border",
        chip
          ? "h-11 w-full justify-between border border-adm-input-border px-3 text-sm"
          : "-mr-1.5 h-7 px-1.5 pointer-coarse:h-11 pointer-coarse:px-2.5",
        state === "error" && "text-adm-danger",
      )}
    >
      {chip ? <span className="text-xs text-adm-fg-muted">{chip}</span> : null}
      <span className="inline-flex items-center gap-1">
        {state === "saving" ? <Loader2 className="size-3.5 animate-spin text-adm-fg-muted" aria-hidden /> : null}
        {state === "saved" ? <Check className="size-3.5 text-adm-success" aria-hidden /> : null}
        {display}
      </span>
    </button>
  );
}

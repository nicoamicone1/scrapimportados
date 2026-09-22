"use client";

import { X } from "lucide-react";
import { useId, useState, type ClipboardEvent, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";

/**
 * Chips de texto: Enter o coma agrega, Backspace con el input vacío quita el
 * último, pegar "S, M, L" agrega los tres. Sin duplicados (ignora mayúsculas).
 */
export function ChipsInput({
  value,
  onChange,
  placeholder,
  suggestions,
  max = 100,
  invalid,
  id,
  "aria-describedby": describedBy,
  "aria-label": ariaLabel,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
  invalid?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
  className?: string;
}) {
  const [text, setText] = useState("");
  const listId = useId();

  const add = (raw: string[]) => {
    const next = [...value];
    const seen = new Set(value.map((v) => v.toLowerCase()));
    for (const r of raw) {
      const v = r.trim();
      if (!v || seen.has(v.toLowerCase()) || next.length >= max) continue;
      seen.add(v.toLowerCase());
      next.push(v);
    }
    if (next.length !== value.length) onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add([text]);
      setText("");
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (/[,\n\t]/.test(pasted)) {
      e.preventDefault();
      add(pasted.split(/[,\n\t]/));
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-adm border border-adm-input-border bg-adm-surface px-1.5 py-1 focus-within:shadow-[var(--adm-focus)]",
        invalid && "border-adm-danger",
        className,
      )}
    >
      {value.map((v) => (
        <span key={v} className="inline-flex h-6 items-center gap-1 rounded-adm-sm bg-adm-surface-2 pr-0.5 pl-2 text-[13px]">
          {v}
          <button
            type="button"
            aria-label={`Quitar ${v}`}
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="inline-flex size-5 items-center justify-center rounded-[3px] text-adm-fg-muted hover:bg-adm-border hover:text-adm-fg"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        list={suggestions?.length ? listId : undefined}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          if (text.trim()) {
            add([text]);
            setText("");
          }
        }}
        placeholder={value.length ? "" : placeholder}
        disabled={value.length >= max}
        className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-adm-fg-muted/70 focus-visible:shadow-none"
      />
      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions
            .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
            .slice(0, 50)
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      ) : null}
    </div>
  );
}

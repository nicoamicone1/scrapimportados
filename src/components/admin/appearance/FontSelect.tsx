"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { closestWeight, FONT_CATEGORY_LABELS, FONTS, fontStack, getFont, type FontCategory } from "@/lib/theme";

/*
 * Selector de fuente con vista previa real: cada opción se dibuja con su
 * propia fuente. Las fuentes se piden a Google Fonts recién al abrir la
 * lista y sólo con los caracteres de la frase de muestra (`&text=`), así
 * pesan unos pocos KB.
 */

export const FONT_SAMPLE = "Camperas de gabardina — $ 89.000";

const loaded = new Set<string>();

function ensureFonts(ids: string[], text: string) {
  const missing = ids.filter((id) => !loaded.has(`${id}|${text}`));
  if (!missing.length || typeof document === "undefined") return;
  const families = missing.map((id) => {
    const f = getFont(id);
    return `family=${f.family.replace(/ /g, "+")}:wght@${closestWeight(id, f.headingOnly ? 500 : 400)}`;
  });
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families.join("&")}&text=${encodeURIComponent(text)}&display=swap`;
  document.head.appendChild(link);
  for (const id of missing) loaded.add(`${id}|${text}`);
}

export function FontSelect({
  label,
  value,
  onChange,
  role,
  hint,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  /** `body` excluye las fuentes sólo para títulos. */
  role: "heading" | "body";
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const options = FONTS.filter((f) => role === "heading" || !("headingOnly" in f && f.headingOnly));
  const current = getFont(value);

  useEffect(() => {
    ensureFonts([value], `${current.family}${FONT_SAMPLE}`);
  }, [value, current.family]);

  useEffect(() => {
    if (!open) return;
    ensureFonts(
      options.map((f) => f.id),
      `${FONT_SAMPLE}${options.map((f) => f.family).join("")}`,
    );
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }));
    return () => document.removeEventListener("pointerdown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo al abrir
  }, [open]);

  const openList = () => {
    setActive(Math.max(0, options.findIndex((f) => f.id === value)));
    setOpen(true);
  };

  const pick = (fontId: string) => {
    onChange(fontId);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(options[active].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);


  return (
    <div ref={wrapRef} className="relative flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[13px] font-medium text-adm-fg">
        {label}
      </span>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-adm border border-adm-input-border bg-adm-surface px-2.5 text-left hover:border-[#bdb7ab]"
      >
        <span className="min-w-0">
          <span className="block truncate text-[17px] leading-tight text-adm-fg" style={{ fontFamily: fontStack(current.id) }}>
            {current.family}
          </span>
          <span className="block truncate text-[11px] text-adm-fg-muted">{current.hint}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-adm-fg-muted" aria-hidden />
      </button>
      {hint ? <p className="text-xs text-adm-fg-muted">{hint}</p> : null}
      {open ? (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="adm-scroll absolute top-full right-0 left-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-adm border border-adm-border bg-adm-surface py-1 shadow-[var(--adm-shadow)]"
        >
          {options.map((f, i) => {
            const header: string | null = i === 0 || options[i - 1].category !== f.category ? FONT_CATEGORY_LABELS[f.category as FontCategory] : null;
            const selected = f.id === value;
            return (
              <li key={f.id} role="presentation">
                {header ? <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-adm-fg-muted uppercase">{header}</p> : null}
                <div
                  id={`${id}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(f.id)}
                  className={cn("flex cursor-pointer items-center gap-2 px-3 py-2", i === active && "bg-adm-hover")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[18px] leading-tight text-adm-fg" style={{ fontFamily: fontStack(f.id) }}>
                      {FONT_SAMPLE}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-adm-fg-muted">
                      {f.family} · {f.hint}
                    </span>
                  </span>
                  {selected ? <Check className="size-4 shrink-0 text-adm-accent" aria-hidden /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

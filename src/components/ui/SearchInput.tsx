"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/cn";

export interface SearchInputProps {
  placeholder?: string;
  className?: string;
  /**
   * Modo URL (default): sincroniza con `?<param>=` (debounce 300 ms) y
   * resetea `?page`. Las listas del admin filtran en el server con eso.
   */
  param?: string;
  /** Modo controlado (sin URL): si se pasa `onChange`, no toca la URL. */
  value?: string;
  onChange?: (value: string) => void;
  autoFocus?: boolean;
  "aria-label"?: string;
}

export function SearchInput({
  placeholder = "Buscar…",
  className,
  param = "q",
  value,
  onChange,
  autoFocus,
  ...aria
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlValue = searchParams.get(param) ?? "";
  const [text, setText] = useState(value ?? urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlled = onChange !== undefined;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const pushUrl = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim()) params.set(param, next.trim());
    else params.delete(param);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const update = (next: string) => {
    setText(next);
    if (controlled) {
      onChange(next);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pushUrl(next), 300);
  };

  const shown = controlled ? (value ?? text) : text;

  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-adm-fg-muted",
          pending && "animate-pulse",
        )}
      />
      <input
        type="search"
        value={shown}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !controlled) {
            if (timer.current) clearTimeout(timer.current);
            pushUrl(shown);
          }
        }}
        placeholder={placeholder}
        aria-label={aria["aria-label"] ?? placeholder}
        autoFocus={autoFocus}
        className="h-8 w-full rounded-adm border border-adm-input-border bg-adm-surface pr-8 pl-8 text-sm text-adm-fg placeholder:text-adm-fg-muted/70 [&::-webkit-search-cancel-button]:hidden"
      />
      {shown ? (
        <button
          type="button"
          onClick={() => update("")}
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-[4px] text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

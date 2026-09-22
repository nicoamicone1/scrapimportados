"use client";

import { useId, useRef, useState } from "react";

import { Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { markdownToHtml } from "@/lib/store/markdown";

/**
 * Textarea con chips de variables: un click inserta `{variable}` donde está
 * el cursor. Pensado para plantillas de WhatsApp.
 */
export function TemplateTextarea({
  id,
  value,
  onChange,
  variables,
  rows = 6,
  invalid,
  "aria-describedby": describedBy,
  maxLength,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  variables: readonly { key: string; label: string }[];
  rows?: number;
  invalid?: boolean;
  "aria-describedby"?: string;
  maxLength?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (key: string) => {
    const el = ref.current;
    const token = `{${key}}`;
    if (!el) {
      onChange(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="space-y-2">
      <Textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        invalid={invalid}
        aria-describedby={describedBy}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-[13px]"
      />
      <div className="flex flex-wrap gap-1.5" aria-label="Variables disponibles">
        {variables.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => insert(v.key)}
            title={v.label}
            className="inline-flex h-6 items-center rounded-adm-sm border border-adm-border bg-adm-surface-2 px-1.5 font-mono text-xs text-adm-fg hover:border-adm-input-border"
          >
            {`{${v.key}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Textarea de markdown con pestañas "Escribir / Vista previa". La previa usa
 * el mismo `markdownToHtml` que el storefront (saneado).
 */
export function MarkdownField({
  id,
  value,
  onChange,
  rows = 5,
  invalid,
  "aria-describedby": describedBy,
  placeholder,
  maxLength,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  invalid?: boolean;
  "aria-describedby"?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const autoId = useId();
  const baseId = id ?? autoId;
  const html = tab === "preview" ? markdownToHtml(value) : "";

  return (
    <div className={cn("overflow-hidden rounded-adm border border-adm-input-border", invalid && "border-adm-danger", className)}>
      <div role="tablist" aria-label="Modo" className="flex h-8 items-center gap-4 border-b border-adm-border bg-adm-surface-2 px-2.5">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={`${baseId}-${t}`}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px h-8 border-b-2 text-[13px]",
              tab === t ? "border-adm-accent font-medium text-adm-fg" : "border-transparent text-adm-fg-muted hover:text-adm-fg",
            )}
          >
            {t === "write" ? "Escribir" : "Vista previa"}
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-adm-fg-muted sm:inline">**negrita** · # título · - lista · [link](https://…)</span>
      </div>
      {tab === "write" ? (
        <textarea
          id={baseId}
          rows={rows}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className="block min-h-[96px] w-full resize-y bg-adm-surface px-2.5 py-2 text-sm leading-relaxed text-adm-fg outline-none placeholder:text-adm-fg-muted/70 focus-visible:shadow-[inset_0_0_0_2px_var(--adm-accent)]"
        />
      ) : (
        <div
          id={`${baseId}-preview`}
          role="tabpanel"
          className="adm-scroll max-h-[480px] [&_a]:text-adm-accent [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-adm-border [&_blockquote]:pl-3 [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_h4]:font-semibold [&_hr]:my-3 [&_hr]:border-adm-border [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 min-h-[96px] overflow-y-auto bg-adm-surface px-4 py-3 text-sm"
          // HTML generado por markdownToHtml y saneado con sanitizeHtml (allowlist).
          dangerouslySetInnerHTML={{ __html: html || '<p class="text-adm-fg-muted">Nada para mostrar todavía.</p>' }}
        />
      )}
    </div>
  );
}

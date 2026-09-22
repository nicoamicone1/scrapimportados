"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Barra sticky inferior "Cambios sin guardar · Descartar · Guardar"
 * (DESIGN.md §7.6). Sólo aparece cuando hay cambios.
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  errorCount = 0,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  errorCount?: number;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-adm-border bg-adm-surface/95 px-4 py-3 backdrop-blur-[2px] md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn("text-sm", errorCount ? "text-adm-danger" : "text-adm-fg")} role="status">
          {errorCount ? `Revisá ${errorCount === 1 ? "el campo marcado" : `los ${errorCount} campos marcados`}.` : "Cambios sin guardar"}
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={onDiscard} disabled={saving}>
            Descartar
          </Button>
          <Button variant="primary" onClick={onSave} loading={saving}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Botón "Guardar" del encabezado (deshabilitado si no hay cambios). */
export function HeaderSave({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  return (
    <Button variant="primary" onClick={onSave} disabled={!dirty} loading={saving} aria-keyshortcuts="Control+S">
      Guardar
    </Button>
  );
}

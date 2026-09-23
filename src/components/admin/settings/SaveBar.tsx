"use client";

import { Button } from "@/components/ui/Button";
import { SaveBar as UiSaveBar } from "@/components/ui/SaveBar";

/**
 * Barra sticky inferior "Cambios sin guardar · Descartar · Guardar"
 * (DESIGN.md §7.6). Sólo aparece cuando hay cambios. Usa la `SaveBar` de ui.
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
  return (
    <UiSaveBar
      visible={dirty}
      saving={saving}
      onSave={onSave}
      onDiscard={onDiscard}
      error={errorCount > 0}
      message={
        errorCount ? `Revisá ${errorCount === 1 ? "el campo marcado" : `los ${errorCount} campos marcados`}.` : "Cambios sin guardar"
      }
    />
  );
}

/** Botón "Guardar" del encabezado (deshabilitado si no hay cambios). */
export function HeaderSave({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  return (
    <Button variant="primary" onClick={onSave} disabled={!dirty} loading={saving} loadingText="Guardando…" aria-keyshortcuts="Control+S">
      Guardar
    </Button>
  );
}

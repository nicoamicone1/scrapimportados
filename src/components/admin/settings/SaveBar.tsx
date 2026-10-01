"use client";

import { SaveBar as UiSaveBar } from "@/components/ui/SaveBar";

/**
 * Barra sticky inferior "Cambios sin guardar · Descartar · Guardar"
 * (DESIGN.md §7.6). Sólo aparece cuando hay cambios; es el único "Guardar" de la
 * pantalla (Ctrl/⌘ S también guarda, ver `useSettingsForm`). Usa la `SaveBar` de ui.
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

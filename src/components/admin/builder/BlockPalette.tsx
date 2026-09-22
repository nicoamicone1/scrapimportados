"use client";

import { Dialog } from "@/components/ui/Dialog";
import { BLOCK_GROUP_LABELS, BLOCK_META, PALETTE_ORDER, type BlockGroup } from "@/lib/blocks/defaults";
import type { BlockType } from "@/lib/blocks/schema";

import { BlockThumb } from "./BlockThumb";

/** Paleta "Agregar bloque": miniaturas esquemáticas agrupadas. */
export function BlockPalette({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (type: BlockType) => void }) {
  const groups = (Object.keys(BLOCK_GROUP_LABELS) as BlockGroup[]).map((g) => ({
    group: g,
    types: PALETTE_ORDER.filter((t) => BLOCK_META[t].group === g),
  }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Agregar bloque" description="Se agrega debajo del bloque seleccionado." size="xl">
      <div className="space-y-5 pb-1">
        {groups.map(({ group, types }) => (
          <section key={group}>
            <h3 className="mb-2 text-[11px] font-medium tracking-wide text-adm-fg-muted uppercase">{BLOCK_GROUP_LABELS[group]}</h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {types.map((type) => (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(type);
                      onOpenChange(false);
                    }}
                    className="group flex h-full w-full flex-col gap-2 rounded-adm border border-adm-border p-2 text-left transition-colors hover:border-adm-accent hover:bg-adm-hover"
                  >
                    <span className="block text-adm-fg-muted transition-colors group-hover:text-adm-accent">
                      <BlockThumb type={type} />
                    </span>
                    <span className="px-0.5">
                      <span className="block text-[13px] font-medium text-adm-fg">{BLOCK_META[type].label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-adm-fg-muted">{BLOCK_META[type].description}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

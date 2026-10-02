"use client";

import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Spool, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Switch } from "@/components/ui/Switch";
import type { AdminColor, AdminMaterial, AdminSpool } from "@/lib/admin/print3d-config";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";

import { deleteColor, deleteMaterial, setMaterialActive } from "@/app/admin/(panel)/taller-3d/filamento/actions";

import { AddSpoolsDialog, type AddSpoolsTarget } from "./AddSpoolsDialog";
import { MaterialDrawer, type MaterialDrawerTarget } from "./MaterialDrawer";
import { spoolFill } from "./math";
import { LOW_STOCK_GRAMS, SPOOL_STATUS_LABELS } from "./presets";
import { SeedDefaultsButton } from "./SeedDefaultsButton";
import { SpoolDialog, type SpoolTarget } from "./SpoolDialog";
import { SpoolGlyph } from "./SpoolGlyph";
import { Swatch } from "./Swatch";

function kg(grams: number) {
  return grams >= 1000 ? `${formatNumber(grams / 1000, "es-AR", 1)} kg` : `${formatNumber(Math.round(grams))} g`;
}

interface PendingColorDelete {
  id: string;
  name: string;
  resolve: (deleted: boolean) => void;
}

/**
 * Estante de bobinas (TALLER-3D §5): materiales → colores → bobinas con la
 * barra de gramos restantes. Alerta de stock bajo por color (< 250 g).
 */
export function FilamentShelf({ materials, spools }: { materials: AdminMaterial[]; spools: AdminSpool[] }) {
  const [materialTarget, setMaterialTarget] = useState<MaterialDrawerTarget | null>(null);
  const [addTarget, setAddTarget] = useState<AddSpoolsTarget | null>(null);
  const [spoolTarget, setSpoolTarget] = useState<SpoolTarget | null>(null);
  const [materialToDelete, setMaterialToDelete] = useState<AdminMaterial | null>(null);
  const [colorToDelete, setColorToDelete] = useState<PendingColorDelete | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);

  const spoolsByColor = useMemo(() => {
    const map = new Map<string, AdminSpool[]>();
    for (const s of spools) {
      const list = map.get(s.color_id) ?? [];
      list.push(s);
      map.set(s.color_id, list);
    }
    // Primero las abiertas (se usan antes), después cerradas, al final vacías.
    const rank = { open: 0, sealed: 1, empty: 2 } as const;
    for (const list of map.values()) list.sort((a, b) => rank[a.status] - rank[b.status] || a.remaining_grams - b.remaining_grams);
    return map;
  }, [spools]);

  const activeMaterials = materials.filter((m) => m.is_active);
  const lowColors = activeMaterials.flatMap((m) =>
    m.colors.filter((c) => c.is_active && c.grams < LOW_STOCK_GRAMS).map((c) => ({ material: m, color: c })),
  );
  const totalGrams = materials.reduce((sum, m) => sum + m.colors.reduce((s, c) => s + c.grams, 0), 0);
  const colorCount = materials.reduce((sum, m) => sum + m.colors.length, 0);
  const emptyCount = spools.filter((s) => s.status === "empty").length;
  const hasColors = colorCount > 0;

  const description =
    materials.length === 0
      ? "Materiales, colores y bobinas: el cotizador muestra sólo lo que tenés."
      : [
          `${materials.length} ${materials.length === 1 ? "material" : "materiales"}`,
          `${colorCount} ${colorCount === 1 ? "color" : "colores"}`,
          `${kg(totalGrams)} en el estante`,
          lowColors.length ? `${lowColors.length} con stock bajo` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const askDeleteColor = (c: { id: string; name: string }) =>
    new Promise<boolean>((resolve) => setColorToDelete({ ...c, resolve }));

  const confirmDeleteColor = async () => {
    if (!colorToDelete) return;
    const res = await deleteColor(colorToDelete.id);
    if (!res.ok) {
      toast.error(res.error);
      colorToDelete.resolve(false);
      return;
    }
    toast.success(`Borraste el ${colorToDelete.name}`);
    colorToDelete.resolve(true);
  };

  const removeMaterial = async () => {
    if (!materialToDelete) return;
    const res = await deleteMaterial(materialToDelete.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Borraste ${materialToDelete.name}`);
    setMaterialTarget(null);
  };

  const toggleArchived = async (m: AdminMaterial) => {
    const res = await setMaterialActive(m.id, !m.is_active);
    if (!res.ok) toast.error(res.error);
    else toast.success(m.is_active ? `${m.name} archivado: ya no se ofrece en la tienda` : `${m.name} vuelve al cotizador`);
  };

  return (
    <>
      <PageHeader
        title="Filamento"
        description={description}
        section="store"
        icon={<Spool />}
        actions={
          materials.length ? (
            <>
              <Button icon={<Plus aria-hidden />} onClick={() => setMaterialTarget({ mode: "new" })}>
                Nuevo material
              </Button>
              <Button variant="primary" icon={<Spool aria-hidden />} onClick={() => setAddTarget({})} disabled={!hasColors}>
                Agregar bobinas
              </Button>
            </>
          ) : null
        }
      />

      {materials.length === 0 ? (
        <EmptyState
          icon={<Spool />}
          title="El estante está vacío"
          description="Creá tus materiales (PLA, PETG, TPU…) con sus colores y después cargá las bobinas que compraste. Así el cotizador sólo ofrece colores con stock y sabés cuánto te cuesta cada gramo."
          actions={
            <>
              <Button variant="primary" icon={<Plus aria-hidden />} onClick={() => setMaterialTarget({ mode: "new" })}>
                Nuevo material
              </Button>
              <SeedDefaultsButton variant="secondary" />
            </>
          }
        />
      ) : (
        <div className="space-y-4">
          {lowColors.length ? (
            <div role="status" className="rounded-adm border border-[#E9D3A6] bg-[#FBF4E6] px-4 py-3">
              <p className="flex items-center gap-2 text-[13px] font-medium text-[#7A4A00]">
                <TriangleAlert className="size-4" aria-hidden />
                Stock bajo: {lowColors.length === 1 ? "un color tiene" : `${lowColors.length} colores tienen`} menos de {LOW_STOCK_GRAMS} g
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {lowColors.map(({ material, color }) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setAddTarget({ colorId: color.id })}
                    className="tnum inline-flex h-8 items-center gap-1.5 rounded-adm border border-[#E9D3A6] bg-adm-surface px-2 text-xs text-adm-fg hover:border-[#C9A867]"
                    title="Agregar bobinas de este color"
                  >
                    <Swatch hex={color.hex} size={12} />
                    {material.name} {color.name}
                    <span className="text-adm-fg-muted">{formatNumber(Math.round(color.grams))} g</span>
                    <Plus className="size-3 text-adm-fg-muted" aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {emptyCount > 0 ? (
            <div className="flex justify-end">
              <Switch
                label={`Mostrar bobinas vacías (${emptyCount})`}
                checked={showEmpty}
                onCheckedChange={setShowEmpty}
                className="gap-3"
              />
            </div>
          ) : null}

          {materials.map((m) => (
            <MaterialShelf
              key={m.id}
              material={m}
              spoolsByColor={spoolsByColor}
              showEmpty={showEmpty}
              onEdit={() => setMaterialTarget({ mode: "edit", material: m })}
              onToggleArchived={() => void toggleArchived(m)}
              onDelete={() => setMaterialToDelete(m)}
              onAddSpools={(colorId) => setAddTarget({ colorId })}
              onOpenSpool={(spool, color) => setSpoolTarget({ spool, color, materialName: m.name })}
            />
          ))}
        </div>
      )}

      <MaterialDrawer
        target={materialTarget}
        onOpenChange={(o) => !o && setMaterialTarget(null)}
        onDeleteColor={askDeleteColor}
        onDeleteMaterial={(m) => setMaterialToDelete(m)}
      />
      <AddSpoolsDialog target={addTarget} materials={materials} onOpenChange={(o) => !o && setAddTarget(null)} />
      <SpoolDialog target={spoolTarget} onOpenChange={(o) => !o && setSpoolTarget(null)} />

      <ConfirmDialog
        open={Boolean(materialToDelete)}
        onOpenChange={(o) => !o && setMaterialToDelete(null)}
        title={materialToDelete ? `¿Borrar ${materialToDelete.name}?` : ""}
        description="Se borran también sus colores. Si ya se usó en cotizaciones o trabajos no se puede: archivalo y deja de ofrecerse."
        confirmLabel="Borrar material"
        destructive
        onConfirm={removeMaterial}
      />
      <ConfirmDialog
        open={Boolean(colorToDelete)}
        onOpenChange={(o) => {
          if (!o) {
            colorToDelete?.resolve(false);
            setColorToDelete(null);
          }
        }}
        title={colorToDelete ? `¿Borrar el color ${colorToDelete.name}?` : ""}
        description="Si tiene bobinas o ya se usó, no se puede: apagalo y deja de ofrecerse."
        confirmLabel="Borrar color"
        destructive
        onConfirm={confirmDeleteColor}
      />
    </>
  );
}

function MaterialShelf({
  material: m,
  spoolsByColor,
  showEmpty,
  onEdit,
  onToggleArchived,
  onDelete,
  onAddSpools,
  onOpenSpool,
}: {
  material: AdminMaterial;
  spoolsByColor: Map<string, AdminSpool[]>;
  showEmpty: boolean;
  onEdit: () => void;
  onToggleArchived: () => void;
  onDelete: () => void;
  onAddSpools: (colorId: string) => void;
  onOpenSpool: (spool: AdminSpool, color: AdminColor) => void;
}) {
  const grams = m.colors.reduce((s, c) => s + c.grams, 0);
  return (
    <section
      aria-labelledby={`mat-${m.id}`}
      className={cn("overflow-hidden rounded-adm border border-adm-border bg-adm-surface shadow-adm-card", !m.is_active && "opacity-75")}
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-adm-border bg-adm-table-head px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="rounded-adm-sm bg-adm-sidebar-bg px-1.5 py-0.5 font-mono text-[11px] font-medium text-adm-sidebar-fg">{m.type}</span>
          <h2 id={`mat-${m.id}`} className="truncate text-[15px] font-semibold text-adm-fg">
            <button type="button" onClick={onEdit} className="hover:underline">
              {m.name}
            </button>
          </h2>
          {m.brand ? <span className="truncate text-[13px] text-adm-fg-muted">{m.brand}</span> : null}
          {!m.is_active ? <Badge tone="neutral">Archivado</Badge> : null}
        </div>
        <dl className="tnum ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          <div className="flex gap-1">
            <dt className="text-adm-fg-muted">Venta</dt>
            <dd className="font-medium text-adm-fg">{formatMoney(m.price_per_gram)}/g</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-adm-fg-muted">Costo</dt>
            <dd className="font-medium text-adm-fg">{m.avg_cost_per_gram !== null ? `${formatMoney(m.avg_cost_per_gram * 1000)}/kg` : "—"}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-adm-fg-muted">Hay</dt>
            <dd className="font-medium text-adm-fg">{kg(grams)}</dd>
          </div>
        </dl>
        <DropdownMenu
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${m.name}`} className="-mr-1.5">
              <MoreHorizontal aria-hidden />
            </Button>
          }
        >
          <DropdownItem onSelect={onEdit} icon={<Pencil aria-hidden />}>
            Editar material y colores
          </DropdownItem>
          <DropdownItem onSelect={onToggleArchived} icon={m.is_active ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}>
            {m.is_active ? "Archivar" : "Reactivar"}
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem onSelect={onDelete} icon={<Trash2 aria-hidden />} danger>
            Borrar
          </DropdownItem>
        </DropdownMenu>
      </header>

      {m.colors.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-adm-fg-muted">
          Sin colores.{" "}
          <Button variant="link" onClick={onEdit}>
            Agregá el primero
          </Button>
        </p>
      ) : (
        <ul className="divide-y divide-adm-border">
          {m.colors.map((c) => {
            const list = (spoolsByColor.get(c.id) ?? []).filter((s) => showEmpty || s.status !== "empty");
            const low = c.is_active && m.is_active && c.grams < LOW_STOCK_GRAMS;
            return (
              <li key={c.id} className="grid gap-3 px-4 py-3 md:grid-cols-[200px_minmax(0,1fr)] md:items-center">
                <div className="flex items-center gap-2.5">
                  <Swatch hex={c.hex} size={22} muted={!c.is_active} />
                  <div className="min-w-0">
                    <p className={cn("truncate text-sm font-medium", c.is_active ? "text-adm-fg" : "text-adm-fg-muted")}>{c.name}</p>
                    <p className="tnum text-xs text-adm-fg-muted">
                      {kg(c.grams)}
                      {!c.is_active ? " · apagado" : null}
                    </p>
                  </div>
                  {low ? (
                    <Badge tone={c.grams <= 0 ? "red" : "amber"} className="ml-auto md:ml-1">
                      {c.grams <= 0 ? "Sin stock" : "Stock bajo"}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {list.map((s) => (
                    <SpoolTile key={s.id} spool={s} color={c} onOpen={() => onOpenSpool(s, c)} />
                  ))}
                  <button
                    type="button"
                    onClick={() => onAddSpools(c.id)}
                    aria-label={`Agregar bobinas de ${m.name} ${c.name}`}
                    className="flex h-[104px] w-[72px] flex-col items-center justify-center gap-1 rounded-adm border border-dashed border-adm-input-border text-xs text-adm-fg-muted transition-colors hover:border-adm-input-border-hover hover:bg-adm-hover hover:text-adm-fg"
                  >
                    <Plus className="size-4" aria-hidden />
                    Bobina
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SpoolTile({ spool: s, color, onOpen }: { spool: AdminSpool; color: AdminColor; onOpen: () => void }) {
  const fill = spoolFill(s.remaining_grams, s.net_grams);
  const costKg = s.cost > 0 && s.net_grams > 0 ? (s.cost / s.net_grams) * 1000 : null;
  const label = `${color.name}: quedan ${formatNumber(Math.round(s.remaining_grams))} de ${formatNumber(s.net_grams)} g, ${SPOOL_STATUS_LABELS[s.status].toLowerCase()}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={[s.brand, costKg !== null ? `${formatMoney(costKg)}/kg` : null, s.notes].filter(Boolean).join(" · ") || undefined}
      className={cn(
        "flex h-[104px] w-[104px] flex-col items-center rounded-adm border border-adm-border bg-adm-surface px-2 pt-2 pb-1.5 text-left transition-colors hover:border-adm-input-border-hover hover:bg-adm-hover",
        s.status === "empty" && "opacity-60",
      )}
    >
      <SpoolGlyph hex={color.hex} fill={fill} className="size-11" />
      <span className="tnum mt-1 text-[13px] leading-4 font-semibold text-adm-fg">
        {formatNumber(Math.round(s.remaining_grams))}
        <span className="font-normal text-adm-fg-muted"> g</span>
      </span>
      <span aria-hidden className="mt-1 h-1 w-full overflow-hidden rounded-full bg-adm-surface-2">
        <span
          className={cn("block h-full rounded-full", fill < 0.2 ? "bg-adm-warning" : "bg-adm-fg/70")}
          style={{ width: `${fill * 100}%` }}
        />
      </span>
      <span className="mt-1 text-[11px] leading-3 text-adm-fg-muted">
        {SPOOL_STATUS_LABELS[s.status]}
        {costKg !== null ? <span className="tnum"> · {formatMoney(Math.round(costKg / 1000))}/g</span> : null}
      </span>
    </button>
  );
}

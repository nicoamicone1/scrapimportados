"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteShippingZone,
  duplicateShippingZone,
  loadShippingExample,
  reorderShippingZones,
  setShippingZoneActive,
} from "@/app/admin/(panel)/envios/actions";
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  EmptyState,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  toast,
} from "@/components/ui";
import { withPendingToast } from "@/components/ui/feedback";
import type { AdminShippingZone } from "@/lib/admin/shipping";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";
import { geometryAreaKm2, geometryToPolygons } from "@/lib/shipping/geometry";
import { provinceName } from "@/lib/shipping/provinces";

import { ZoneTypeBadge } from "./ScopeInputs";

/** Sólo movimiento vertical al arrastrar filas. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Resumen del alcance según el tipo ("CABA, Córdoba", "12 prefijos", "2 polígonos · 203 km²"). */
function scopeSummary(z: AdminShippingZone): string {
  switch (z.type) {
    case "polygon": {
      const n = geometryToPolygons(z.geometry).length;
      if (!n) return "Sin dibujar";
      const km2 = geometryAreaKm2(z.geometry);
      return `${n === 1 ? "1 polígono" : `${n} polígonos`} · ${formatNumber(km2, "es-AR", km2 < 10 ? 1 : 0)} km²`;
    }
    case "provinces":
      if (z.provinces.length === 24) return "Todas las provincias";
      if (z.provinces.length <= 2) return z.provinces.map(provinceName).join(", ");
      return `${z.provinces.length} provincias`;
    case "postal_prefixes":
      if (z.postalPrefixes.length <= 3) return z.postalPrefixes.join(", ");
      return `${z.postalPrefixes.length} prefijos`;
    case "everywhere":
      return "Cualquier dirección";
    default:
      return "";
  }
}

function SortableRow({
  zone,
  index,
  shadowedBy,
  busy,
  onToggle,
  onDuplicate,
  onDelete,
}: {
  zone: AdminShippingZone;
  index: number;
  /** Nombre de la zona "Todo el país" activa que queda arriba (esta no se usa nunca). */
  shadowedBy: string | null;
  busy: boolean;
  onToggle: (active: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: zone.id,
  });

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/row hover:bg-adm-hover",
        isDragging && "relative z-10 bg-adm-surface shadow-[var(--adm-shadow)]",
        !zone.isActive && "text-adm-fg-muted",
      )}
    >
      <TD className="w-10 pr-0">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Mover ${zone.name} (prioridad ${index + 1})`}
          className="inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </TD>
      <TD numeric muted className="w-8 pl-1 text-left">
        {index + 1}
      </TD>
      <TD className="min-w-48">
        <Link href={`/admin/envios/zonas/${zone.id}`} className="font-medium text-adm-fg hover:underline">
          {zone.name}
        </Link>
        {shadowedBy ? (
          <div className="text-xs text-adm-warning">No se usa: queda debajo de “{shadowedBy}”, que incluye todo el país.</div>
        ) : zone.type === "polygon" && !zone.geometry ? (
          <div className="text-xs text-adm-warning">Falta dibujar el área.</div>
        ) : null}
      </TD>
      <TD>
        <ZoneTypeBadge type={zone.type} />
      </TD>
      <TD muted className="max-w-56 truncate" title={scopeSummary(zone)}>
        {scopeSummary(zone)}
      </TD>
      <TD numeric>{zone.cost === 0 ? "Gratis" : formatMoney(zone.cost)}</TD>
      <TD numeric muted>
        {zone.freeOver === null ? "—" : formatMoney(zone.freeOver)}
      </TD>
      <TD muted className="whitespace-nowrap">
        {zone.etaText || "—"}
      </TD>
      <TD>
        <Switch
          checked={zone.isActive}
          onCheckedChange={onToggle}
          disabled={busy}
          aria-label={zone.isActive ? `Desactivar ${zone.name}` : `Activar ${zone.name}`}
        />
      </TD>
      <TD className="w-10 text-right">
        <DropdownMenu
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${zone.name}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          }
        >
          <DropdownItem href={`/admin/envios/zonas/${zone.id}`} icon={<Pencil aria-hidden />}>
            Editar
          </DropdownItem>
          <DropdownItem onSelect={onDuplicate} icon={<Copy aria-hidden />}>
            Duplicar
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem onSelect={onDelete} icon={<Trash2 aria-hidden />} danger>
            Borrar
          </DropdownItem>
        </DropdownMenu>
      </TD>
    </tr>
  );
}

export function ZonesList({ zones: initialZones }: { zones: AdminShippingZone[] }) {
  const router = useRouter();
  const [zones, setZones] = useState(initialZones);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminShippingZone | null>(null);
  const [loadingExample, startExample] = useTransition();

  // Cuando el server manda datos nuevos (router.refresh), se reemplaza el estado local.
  const [prevInitial, setPrevInitial] = useState(initialZones);
  if (prevInitial !== initialZones) {
    setPrevInitial(initialZones);
    setZones(initialZones);
  }

  const nameOf = (id: string | number) => zones.find((z) => z.id === id)?.name ?? "la zona";
  const posOf = (id: string | number) => zones.findIndex((z) => z.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Moviendo “${nameOf(active.id)}”, prioridad ${posOf(active.id)} de ${zones.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `“${nameOf(active.id)}” pasa a la prioridad ${posOf(over.id)}.` : `“${nameOf(active.id)}” fuera de la lista.`,
    onDragEnd: ({ active, over }) =>
      over ? `“${nameOf(active.id)}” quedó en la prioridad ${posOf(over.id)}.` : `“${nameOf(active.id)}” volvió a su lugar.`,
    onDragCancel: ({ active }) => `Cancelado. “${nameOf(active.id)}” volvió a su lugar.`,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = zones.findIndex((z) => z.id === active.id);
    const to = zones.findIndex((z) => z.id === over.id);
    const previous = zones;
    const next = arrayMove(zones, from, to).map((z, i) => ({ ...z, position: i }));
    setZones(next);
    const res = await reorderShippingZones(next.map((z) => z.id));
    if (!res.ok) {
      setZones(previous);
      toast.error(res.error);
      return;
    }
    toast.success("Orden guardado.");
    router.refresh();
  };

  const toggle = async (zone: AdminShippingZone, active: boolean) => {
    setBusyId(zone.id);
    setZones((zs) => zs.map((z) => (z.id === zone.id ? { ...z, isActive: active } : z)));
    const res = await setShippingZoneActive(zone.id, active);
    setBusyId(null);
    if (!res.ok) {
      setZones((zs) => zs.map((z) => (z.id === zone.id ? { ...z, isActive: !active } : z)));
      toast.error(res.error);
      return;
    }
    toast.success(active ? `“${zone.name}” activa.` : `“${zone.name}” desactivada.`);
    router.refresh();
  };

  const duplicate = async (zone: AdminShippingZone) => {
    const res = await duplicateShippingZone(zone.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Zona duplicada. La copia quedó inactiva y al final.");
    router.refresh();
  };

  const remove = async () => {
    if (!toDelete) return;
    const res = await deleteShippingZone(toDelete.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setZones((zs) => zs.filter((z) => z.id !== toDelete.id));
    toast.success("Zona borrada.");
    router.refresh();
  };

  const loadExample = () =>
    startExample(async () => {
      const res = await loadShippingExample();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Cargamos 3 zonas de ejemplo. Revisalas y ajustá costos y áreas.");
      router.refresh();
    });

  if (zones.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay zonas de envío"
        description="Sin zonas, el checkout sólo ofrece retiro en el local o acordar por WhatsApp. Creá tu primera zona o cargá un ejemplo (CABA por polígono, GBA por provincia y resto del país) para ajustarlo."
        actions={
          <>
            <ButtonLink href="/admin/envios/zonas/nueva" variant="primary">
              Nueva zona
            </ButtonLink>
            <Button onClick={loadExample} loading={loadingExample}>
              Cargar ejemplo
            </Button>
          </>
        }
      />
    );
  }

  // Zonas que quedan debajo de una "Todo el país" activa nunca se usan.
  const firstEverywhere = zones.findIndex((z) => z.isActive && z.type === "everywhere");
  const shadow = zones.map((_, i) => (firstEverywhere !== -1 && i > firstEverywhere ? zones[firstEverywhere].name : null));

  const table = (
    <Table>
      <THead>
        <tr>
          <TH className="w-10">
            <span className="sr-only">Mover</span>
          </TH>
          <TH className="w-8 pl-1">#</TH>
          <TH>Nombre</TH>
          <TH>Tipo</TH>
          <TH>Alcance</TH>
          <TH numeric>Costo</TH>
          <TH numeric>Gratis desde</TH>
          <TH>Demora</TH>
          <TH>Activa</TH>
          <TH className="w-10">
            <span className="sr-only">Acciones</span>
          </TH>
        </tr>
      </THead>
      <TBody>
        {zones.map((z, i) => (
          <SortableRow
            key={z.id}
            zone={z}
            index={i}
            shadowedBy={shadow[i]}
            busy={busyId === z.id}
            onToggle={(active) => void toggle(z, active)}
            onDuplicate={() => void withPendingToast("Duplicando zona…", () => duplicate(z))}
            onDelete={() => setToDelete(z)}
          />
        ))}
      </TBody>
    </Table>
  );

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-adm-fg-muted">
        Las zonas se evalúan de arriba hacia abajo: gana la primera que incluye la dirección del cliente. Arrastrá las filas
        desde el asa para cambiar la prioridad (con teclado: foco en el asa, Espacio y flechas). Dejá “Todo el país” última.
      </p>

      {/* `id` fijo: evita el mismatch de hidratación de los ids de accesibilidad de dnd-kit. */}
      <DndContext
        id="shipping-zones"
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[verticalOnly]}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: "Para mover la zona, presioná Espacio. Usá las flechas para cambiar la prioridad y Espacio para soltar. Esc cancela.",
          },
        }}
        onDragEnd={(e) => void onDragEnd(e)}
      >
        <SortableContext items={zones.map((z) => z.id)} strategy={verticalListSortingStrategy}>
          {table}
        </SortableContext>
      </DndContext>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`¿Borrar la zona “${toDelete?.name ?? ""}”?`}
        description="Deja de ofrecerse en el checkout. Los pedidos que ya la usaron conservan el nombre y el costo. Si sólo querés pausarla, desactivala."
        confirmLabel="Borrar zona"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}

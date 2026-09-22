"use client";

import { LocateFixed, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deletePickupLocation, savePickupLocation, setPickupLocationActive } from "@/app/admin/(panel)/envios/actions";
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  toast,
} from "@/components/ui";
import type { AdminPickupLocation } from "@/lib/admin/shipping";
import { pickupLocationSchema } from "@/lib/schemas/shipping";
import type { LatLng } from "@/lib/shipping/geometry";

import { fetchPlaces, type MapCenter } from "./map-shared";

const PointMap = dynamic(() => import("./PointMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[240px] w-full" />,
});

interface PickupFormState {
  name: string;
  address: string;
  hours: string;
  instructions: string;
  isActive: boolean;
  point: LatLng | null;
}

function toState(p: AdminPickupLocation | null): PickupFormState {
  return {
    name: p?.name ?? "",
    address: p?.address ?? "",
    hours: p?.hoursText ?? "",
    instructions: p?.instructionsMd ?? "",
    isActive: p?.isActive ?? true,
    point: p && p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng } : null,
  };
}

function PickupDrawer({
  open,
  onOpenChange,
  pickup,
  center,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickup: AdminPickupLocation | null;
  center: MapCenter;
  onSaved: (p: AdminPickupLocation) => void;
}) {
  const [state, setState] = useState<PickupFormState>(() => toState(pickup));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof PickupFormState>(k: K, v: PickupFormState[K]) => setState((s) => ({ ...s, [k]: v }));
  const err = (k: string) => errors[k]?.[0] ?? null;

  const locate = async () => {
    if (state.address.trim().length < 5) {
      setLocateMsg("Escribí la dirección completa primero.");
      return;
    }
    setLocating(true);
    setLocateMsg(null);
    try {
      const [first] = await fetchPlaces(state.address);
      if (first) {
        set("point", { lat: first.lat, lng: first.lng });
        setLocateMsg(`Ubicado: ${first.displayName}. Si no es exacto, arrastrá el pin.`);
      } else {
        setLocateMsg("No encontramos esa dirección. Marcala con un click en el mapa.");
      }
    } catch (e) {
      setLocateMsg(e instanceof Error ? e.message : "No pudimos ubicar la dirección.");
    } finally {
      setLocating(false);
    }
  };

  const save = () => {
    const input = {
      name: state.name,
      address: state.address,
      hours_text: state.hours,
      instructions_md: state.instructions,
      is_active: state.isActive,
      lat: state.point?.lat ?? null,
      lng: state.point?.lng ?? null,
    };
    const local = pickupLocationSchema.safeParse(input);
    if (!local.success) {
      const fe: Record<string, string[]> = {};
      for (const issue of local.error.issues) (fe[issue.path.join(".") || "_"] ??= []).push(issue.message);
      setErrors(fe);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await savePickupLocation(pickup?.id ?? null, input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      const saved = res.data.pickup;
      if (saved.lat === null) toast.warning("Guardado, pero no pudimos ubicar la dirección. Marcala en el mapa.");
      else if (res.data.geocoded) toast.success("Guardado. Ubicamos la dirección en el mapa.");
      else toast.success("Punto de retiro guardado.");
      onSaved(saved);
      onOpenChange(false);
    });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      width="w-[520px]"
      title={pickup ? "Editar punto de retiro" : "Nuevo punto de retiro"}
      description="El cliente lo elige en el checkout y retira sin costo de envío."
      dismissable={!pending}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={pending}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        className="space-y-4 p-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nombre" required error={err("name")}>
          <Input value={state.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Local Palermo" />
        </Field>

        <Field
          label="Dirección"
          required
          error={err("address")}
          hint="Calle, altura, barrio y ciudad. Al guardar la ubicamos en el mapa si no marcaste el punto."
        >
          <Input
            value={state.address}
            onChange={(e) => set("address", e.target.value)}
            maxLength={200}
            autoComplete="street-address"
            placeholder="Av. Santa Fe 3253, Palermo, CABA"
          />
        </Field>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-adm-fg">Ubicación</span>
            <Button size="sm" icon={<LocateFixed aria-hidden />} onClick={() => void locate()} loading={locating}>
              Ubicar dirección
            </Button>
          </div>
          <PointMap
            point={state.point}
            onPointChange={(p) => {
              set("point", p);
              setLocateMsg("Ubicación ajustada a mano.");
            }}
            center={center}
            height={240}
            label="Mapa del punto de retiro"
          />
          <p className="text-xs text-adm-fg-muted" aria-live="polite">
            {locateMsg ??
              (state.point
                ? "Arrastrá el pin o hacé click en el mapa para ajustar."
                : "Todavía sin ubicar. Tocá “Ubicar dirección” o hacé click en el mapa.")}
          </p>
        </div>

        <Field label="Horarios" error={err("hours_text")} hint="Texto libre, lo ve el cliente.">
          <Input value={state.hours} onChange={(e) => set("hours", e.target.value)} maxLength={200} placeholder="Lunes a viernes de 10 a 19 h" />
        </Field>

        <Field label="Instrucciones para retirar" error={err("instructions_md")} hint="Markdown simple: **negrita**, listas con guion. Se muestra en el pedido.">
          <Textarea
            value={state.instructions}
            onChange={(e) => set("instructions", e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Traé el número de pedido y tu DNI."
          />
        </Field>

        <Switch
          checked={state.isActive}
          onCheckedChange={(v) => set("isActive", v)}
          label="Activo"
          description="Si está inactivo no aparece en el checkout."
        />
        {/* Enter en un input envía el form. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Drawer>
  );
}

export function PickupsPanel({ pickups: initial, center }: { pickups: AdminPickupLocation[]; center: MapCenter }) {
  const router = useRouter();
  const [pickups, setPickups] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setPickups(initial);
  }
  const [editing, setEditing] = useState<{ pickup: AdminPickupLocation | null; key: number } | null>(null);
  const [toDelete, setToDelete] = useState<AdminPickupLocation | null>(null);

  const openNew = () => setEditing({ pickup: null, key: Date.now() });

  const onSaved = (p: AdminPickupLocation) => {
    setPickups((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]));
    router.refresh();
  };

  const toggle = async (p: AdminPickupLocation, active: boolean) => {
    setPickups((list) => list.map((x) => (x.id === p.id ? { ...x, isActive: active } : x)));
    const res = await setPickupLocationActive(p.id, active);
    if (!res.ok) {
      setPickups((list) => list.map((x) => (x.id === p.id ? { ...x, isActive: !active } : x)));
      toast.error(res.error);
      return;
    }
    toast.success(active ? `“${p.name}” activo.` : `“${p.name}” desactivado.`);
    router.refresh();
  };

  const remove = async () => {
    if (!toDelete) return;
    const res = await deletePickupLocation(toDelete.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPickups((list) => list.filter((x) => x.id !== toDelete.id));
    toast.success("Punto de retiro borrado.");
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-adm-fg-muted">
          Lugares donde el cliente puede retirar su pedido sin pagar envío. Los activos aparecen en el checkout.
        </p>
        {pickups.length ? (
          <Button variant="primary" icon={<Plus aria-hidden />} onClick={openNew}>
            Nuevo punto de retiro
          </Button>
        ) : null}
      </div>

      {pickups.length === 0 ? (
        <EmptyState
          title="Todavía no hay puntos de retiro"
          description="Si tenés local, depósito o showroom, cargalo acá y el cliente va a poder elegir retirar sin costo."
          actions={
            <Button variant="primary" icon={<Plus aria-hidden />} onClick={openNew}>
              Nuevo punto de retiro
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Nombre</TH>
              <TH>Dirección</TH>
              <TH>Horarios</TH>
              <TH>Mapa</TH>
              <TH>Activo</TH>
              <TH className="w-10">
                <span className="sr-only">Acciones</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {pickups.map((p) => (
              <TR key={p.id} className={p.isActive ? undefined : "text-adm-fg-muted"}>
                <TD>
                  <button type="button" className="text-left font-medium hover:underline" onClick={() => setEditing({ pickup: p, key: Date.now() })}>
                    {p.name}
                  </button>
                </TD>
                <TD muted className="max-w-72 truncate" title={p.address ?? undefined}>
                  {p.address || "—"}
                </TD>
                <TD muted className="max-w-64 truncate" title={p.hoursText ?? undefined}>
                  {p.hoursText || "—"}
                </TD>
                <TD>
                  {p.lat !== null && p.lng !== null ? (
                    <Badge tone="green">Ubicado</Badge>
                  ) : (
                    <Badge tone="amber">Sin ubicar</Badge>
                  )}
                </TD>
                <TD>
                  <Switch
                    checked={p.isActive}
                    onCheckedChange={(v) => void toggle(p, v)}
                    aria-label={p.isActive ? `Desactivar ${p.name}` : `Activar ${p.name}`}
                  />
                </TD>
                <TD className="text-right">
                  <DropdownMenu
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${p.name}`}>
                        <MoreHorizontal aria-hidden />
                      </Button>
                    }
                  >
                    <DropdownItem icon={<Pencil aria-hidden />} onSelect={() => setEditing({ pickup: p, key: Date.now() })}>
                      Editar
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem icon={<Trash2 aria-hidden />} danger onSelect={() => setToDelete(p)}>
                      Borrar
                    </DropdownItem>
                  </DropdownMenu>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {editing ? (
        <PickupDrawer
          key={editing.key}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          pickup={editing.pickup}
          center={center}
          onSaved={onSaved}
        />
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`¿Borrar “${toDelete?.name ?? ""}”?`}
        description="Deja de aparecer en el checkout. Los pedidos que ya lo eligieron no cambian. Si es temporal, mejor desactivalo."
        confirmLabel="Borrar punto de retiro"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}

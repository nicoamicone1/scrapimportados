"use client";

import { Globe2, Hash, Map as MapIcon, MapPinned, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";

import { deleteShippingZone, saveShippingZone } from "@/app/admin/(panel)/envios/actions";
import { Button, Card, CardBody, CardHeader, ConfirmDialog, Field, Input, PageHeader, SaveBar, Switch, Textarea, toast } from "@/components/ui";
import type { AdminShippingZone } from "@/lib/admin/shipping";
import { cn } from "@/lib/cn";
import { shippingZoneSchema, type ShippingZoneInput } from "@/lib/schemas/shipping";
import type { ZoneGeometry } from "@/lib/shipping/geometry";
import { parsePostalPrefixes } from "@/lib/shipping/provinces";
import { ZONE_TYPE_LABELS, type ShippingZoneType } from "@/lib/shipping/resolve";

import type { MapCenter } from "./map-shared";
import { PolygonEditor } from "./PolygonEditor";
import { PostalPrefixesInput, ProvincePicker } from "./ScopeInputs";
import type { ReferenceZone } from "./ZonePolygonMap";

const TYPE_OPTIONS: { value: ShippingZoneType; icon: ReactNode; description: string }[] = [
  { value: "polygon", icon: <MapIcon aria-hidden />, description: "Dibujás el área de entrega en el mapa. Ideal para repartos propios." },
  { value: "provinces", icon: <MapPinned aria-hidden />, description: "Una o varias provincias enteras." },
  { value: "postal_prefixes", icon: <Hash aria-hidden />, description: "Códigos postales o prefijos: 1900, 19, B1878." },
  { value: "everywhere", icon: <Globe2 aria-hidden />, description: "Cualquier dirección de Argentina. Comodín: ponela última." },
];

interface FormState {
  name: string;
  type: ShippingZoneType;
  cost: string;
  freeOver: string;
  eta: string;
  notes: string;
  isActive: boolean;
  geometry: ZoneGeometry | null;
  provinces: string[];
  prefixText: string;
}

function initialState(zone: AdminShippingZone | null): FormState {
  return {
    name: zone?.name ?? "",
    type: zone?.type ?? "polygon",
    cost: zone ? String(zone.cost) : "",
    freeOver: zone?.freeOver !== null && zone?.freeOver !== undefined ? String(zone.freeOver) : "",
    eta: zone?.etaText ?? "",
    notes: zone?.notes ?? "",
    isActive: zone?.isActive ?? true,
    geometry: zone?.geometry ?? null,
    provinces: zone?.provinces ?? [],
    prefixText: (zone?.postalPrefixes ?? []).join(", "),
  };
}

function toInput(s: FormState): ShippingZoneInput {
  return {
    name: s.name,
    type: s.type,
    cost: s.cost,
    free_over: s.freeOver,
    eta_text: s.eta,
    notes: s.notes,
    is_active: s.isActive,
    geometry: s.type === "polygon" ? s.geometry : null,
    provinces: s.provinces,
    postal_prefixes: parsePostalPrefixes(s.prefixText),
  };
}

export function ZoneForm({
  zone,
  center,
  referenceZones,
  zonesCount,
}: {
  zone: AdminShippingZone | null;
  center: MapCenter;
  /** Otras zonas por polígono para ver de referencia en el mapa. */
  referenceZones: ReferenceZone[];
  /** Cantidad total de zonas (para el aviso de "Todo el país"). */
  zonesCount: number;
}) {
  const router = useRouter();
  const initial = useMemo(() => initialState(zone), [zone]);
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = JSON.stringify(state) !== JSON.stringify(initial);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setState((s) => ({ ...s, [key]: value }));
  const err = (key: string) => errors[key]?.[0] ?? null;

  const submit = () => {
    const input = toInput(state);
    const local = shippingZoneSchema.safeParse(input);
    if (!local.success) {
      const fe: Record<string, string[]> = {};
      for (const issue of local.error.issues) (fe[issue.path.join(".") || "_"] ??= []).push(issue.message);
      setErrors(fe);
      toast.error("Revisá los campos marcados.");
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await saveShippingZone(zone?.id ?? null, input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      if (zone) {
        toast.success("Zona guardada.");
        router.refresh();
      } else {
        toast.success("Zona creada. Quedó última en la lista: reordenala si hace falta.");
        router.push("/admin/envios");
      }
    });
  };

  const remove = async () => {
    if (!zone) return;
    const res = await deleteShippingZone(zone.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Zona borrada.");
    router.push("/admin/envios");
  };

  const title = zone ? zone.name : "Nueva zona";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
      className="max-w-5xl"
    >
      <PageHeader
        title={title}
        description={zone ? `${ZONE_TYPE_LABELS[zone.type]} · ${zone.isActive ? "activa" : "inactiva"}` : "Definí dónde entregás, cuánto cuesta y en cuánto tiempo."}
        breadcrumb={[{ label: "Envíos", href: "/admin/envios" }, { label: zone ? zone.name : "Nueva zona" }]}
        actions={
          zone ? (
            <Button variant="ghost" icon={<Trash2 aria-hidden />} onClick={() => setConfirmDelete(true)} className="text-adm-danger hover:text-adm-danger">
              Borrar zona
            </Button>
          ) : null
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Zona" description="El nombre lo ve el cliente en el checkout (ej. “CABA”, “Zona norte”)." />
          <CardBody className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <Field label="Nombre" required error={err("name")}>
              <Input value={state.name} onChange={(e) => set("name", e.target.value)} maxLength={80} autoComplete="off" placeholder="CABA" />
            </Field>
            <Switch
              checked={state.isActive}
              onCheckedChange={(v) => set("isActive", v)}
              label="Activa"
              description="Si está inactiva no se ofrece en el checkout."
              className="md:w-64 md:pb-1"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Costo y demora" />
          <CardBody className="grid gap-4 md:grid-cols-3">
            <Field label="Costo del envío" required error={err("cost")} hint="0 si el envío es gratis siempre.">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={state.cost}
                onChange={(e) => set("cost", e.target.value)}
                leading="$"
                placeholder="3500"
              />
            </Field>
            <Field label="Envío gratis desde" error={err("free_over")} hint="Opcional. Subtotal a partir del cual el envío es gratis.">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={state.freeOver}
                onChange={(e) => set("freeOver", e.target.value)}
                leading="$"
                placeholder="Sin envío gratis"
              />
            </Field>
            <Field label="Demora" error={err("eta_text")} hint="Texto libre, lo ve el cliente.">
              <Input value={state.eta} onChange={(e) => set("eta", e.target.value)} maxLength={60} placeholder="24 a 48 hs" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Alcance"
            description="Qué direcciones incluye esta zona. Las zonas se evalúan de arriba hacia abajo en la lista y gana la primera que incluye la dirección."
          />
          <CardBody className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-adm-fg">Tipo de zona</legend>
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {TYPE_OPTIONS.map((opt) => {
                  const active = state.type === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex cursor-pointer gap-2.5 rounded-adm border p-3 transition-colors has-[:focus-visible]:shadow-[var(--adm-focus)]",
                        active ? "border-adm-accent bg-adm-accent-soft" : "border-adm-border bg-adm-surface hover:bg-adm-hover",
                      )}
                    >
                      <input
                        type="radio"
                        name="zone-type"
                        value={opt.value}
                        checked={active}
                        onChange={() => set("type", opt.value)}
                        className="sr-only"
                      />
                      <span className={cn("mt-0.5 [&_svg]:size-4", active ? "text-adm-accent" : "text-adm-fg-muted")}>{opt.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-adm-fg">{ZONE_TYPE_LABELS[opt.value]}</span>
                        <span className="mt-0.5 block text-xs text-adm-fg-muted">{opt.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {state.type === "polygon" ? (
              <div>
                {err("geometry") ? <p className="mb-2 text-xs text-adm-danger">{err("geometry")}</p> : null}
                <PolygonEditor
                  value={state.geometry}
                  onChange={(g) => set("geometry", g)}
                  center={center}
                  referenceZones={referenceZones}
                  zoneName={state.name}
                />
              </div>
            ) : null}

            {state.type === "provinces" ? (
              <ProvincePicker value={state.provinces} onChange={(v) => set("provinces", v)} error={err("provinces")} />
            ) : null}

            {state.type === "postal_prefixes" ? (
              <PostalPrefixesInput text={state.prefixText} onTextChange={(v) => set("prefixText", v)} error={err("postal_prefixes")} />
            ) : null}

            {state.type === "everywhere" ? (
              <div className="rounded-adm border border-adm-border bg-adm-surface-2 px-4 py-3 text-[13px] text-adm-fg">
                <p className="font-medium">Incluye cualquier dirección del país.</p>
                <p className="mt-1 text-adm-fg-muted">
                  Dejala última en la lista de zonas: como gana la primera que incluye la dirección, todo lo que quede debajo de
                  esta zona no se usa nunca.
                  {!zone && zonesCount > 0 ? " Las zonas nuevas se agregan al final, así que ya queda en su lugar." : null}
                </p>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Notas internas" description="Sólo las ve tu equipo." />
          <CardBody>
            <Field label="Notas" error={err("notes")}>
              <Textarea
                value={state.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Ej. el reparto sale martes y jueves; la moto no cruza la General Paz."
              />
            </Field>
          </CardBody>
        </Card>
      </div>

      <SaveBar
        message={zone ? (dirty ? "Cambios sin guardar" : "Sin cambios") : "Zona nueva"}
        onDiscard={zone ? () => setState(initial) : undefined}
        discardDisabled={!dirty}
        discardHref={zone ? undefined : "/admin/envios"}
        discardLabel={zone ? "Descartar" : "Cancelar"}
        saving={pending}
        saveLabel={zone ? "Guardar" : "Crear zona"}
        savingLabel={zone ? "Guardando…" : "Creando…"}
        saveDisabled={zone ? !dirty : false}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Borrar la zona “${zone?.name ?? ""}”?`}
        description="Deja de ofrecerse en el checkout. Los pedidos que ya la usaron conservan el nombre y el costo. Si sólo querés pausarla, desactivala."
        confirmLabel="Borrar zona"
        destructive
        onConfirm={remove}
      />
    </form>
  );
}

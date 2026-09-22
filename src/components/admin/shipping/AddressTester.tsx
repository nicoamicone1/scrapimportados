"use client";

import { Check, Minus } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { geocodeTestAddress, reverseGeocodePoint } from "@/app/admin/(panel)/envios/actions";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Select,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  toast,
  type BadgeTone,
} from "@/components/ui";
import type { AdminShippingZone } from "@/lib/admin/shipping";
import { formatMoney } from "@/lib/money";
import { testAddressSchema } from "@/lib/schemas/shipping";
import type { GeocodeConfidence, GeocodeResult } from "@/lib/shipping/geocode";
import type { LatLng } from "@/lib/shipping/geometry";
import { normalizeProvince, PROVINCE_OPTIONS, provinceName } from "@/lib/shipping/provinces";
import { amountForFreeShipping, evaluateZones, resolveZone, type ShippingAddressInput } from "@/lib/shipping/resolve";

import type { MapCenter } from "./map-shared";
import type { MapOverlay } from "./PointMap";
import { ZoneTypeBadge } from "./ScopeInputs";

const PointMap = dynamic(() => import("./PointMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full" />,
});

const CONFIDENCE: Record<GeocodeConfidence, { label: string; tone: BadgeTone; help: string }> = {
  high: { label: "Ubicación exacta", tone: "green", help: "Encontramos la altura." },
  medium: { label: "Ubicación aproximada", tone: "amber", help: "Encontramos la calle pero no la altura exacta." },
  low: { label: "Poco precisa", tone: "red", help: "Sólo ubicamos el barrio o la ciudad, o la provincia no coincide." },
};

interface Tested {
  source: "address" | "point";
  address: ShippingAddressInput;
  point: LatLng | null;
  geocode: GeocodeResult | null;
}

export function AddressTester({ zones, center }: { zones: AdminShippingZone[]; center: MapCenter }) {
  const [form, setForm] = useState({ street: "", number: "", city: "", province: "", postal_code: "", subtotal: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [tested, setTested] = useState<Tested | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const subtotal = form.subtotal.trim() === "" ? undefined : Number(form.subtotal);
  const validSubtotal = subtotal !== undefined && Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : undefined;

  const evaluation = useMemo(
    () => (tested ? evaluateZones({ zones, address: tested.address, point: tested.point }) : []),
    [tested, zones],
  );
  const resolution = useMemo(
    () => (tested ? resolveZone({ zones, address: tested.address, point: tested.point, subtotal: validSubtotal }) : null),
    [tested, zones, validSubtotal],
  );

  const overlays: MapOverlay[] = useMemo(
    () =>
      zones
        .filter((z) => z.type === "polygon" && z.geometry)
        .map((z) => {
          const ev = evaluation.find((e) => e.zone.id === z.id);
          return {
            id: z.id,
            name: z.name,
            geometry: z.geometry!,
            highlight: ev?.includes ?? false,
            winner: ev?.winner ?? false,
            inactive: !z.isActive,
          };
        }),
    [zones, evaluation],
  );

  const test = () => {
    const input = { street: form.street, number: form.number, city: form.city, province: form.province, postal_code: form.postal_code };
    const parsed = testAddressSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) (fe[issue.path.join(".") || "_"] ??= []).push(issue.message);
      setErrors(fe);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await geocodeTestAddress(input);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const geo = res.data;
      setTested({
        source: "address",
        address: input,
        point: geo ? { lat: geo.lat, lng: geo.lng } : null,
        geocode: geo,
      });
    });
  };

  const testPoint = (point: LatLng) => {
    setTested((t) => ({ source: "point", address: t?.source === "point" ? t.address : {}, point, geocode: null }));
    startTransition(async () => {
      const res = await reverseGeocodePoint(point.lat, point.lng);
      const geo = res.ok ? res.data : null;
      setTested({
        source: "point",
        address: { province: geo?.province ?? null, postal_code: geo?.postalCode ?? null, city: geo?.city ?? null },
        point,
        geocode: geo,
      });
    });
  };

  const provinceHint = (() => {
    const code = tested?.address.province ? normalizeProvince(tested.address.province) : null;
    return code ? provinceName(code) : null;
  })();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Dirección de prueba"
            description="Simulá lo que pasa en el checkout: la geocodificamos con OpenStreetMap y evaluamos tus zonas en orden."
          />
          <CardBody>
            <form
              className="grid gap-3 sm:grid-cols-6"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                test();
              }}
            >
              <Field label="Calle" error={errors.street?.[0]} className="sm:col-span-4">
                <Input value={form.street} onChange={(e) => set("street", e.target.value)} autoComplete="address-line1" placeholder="Av. Corrientes" />
              </Field>
              <Field label="Número" className="sm:col-span-2">
                <Input value={form.number} onChange={(e) => set("number", e.target.value)} inputMode="numeric" placeholder="1234" />
              </Field>
              <Field label="Ciudad o localidad" className="sm:col-span-3">
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" placeholder="CABA" />
              </Field>
              <Field label="Código postal" className="sm:col-span-3">
                <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} autoComplete="postal-code" placeholder="C1043 o 1043" />
              </Field>
              <Field label="Provincia" className="sm:col-span-3">
                <Select value={form.province} onChange={(e) => set("province", e.target.value)} placeholder="Elegí una provincia" options={[...PROVINCE_OPTIONS]} />
              </Field>
              <Field label="Subtotal del carrito" hint="Opcional: para ver si aplica el envío gratis." className="sm:col-span-3">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.subtotal}
                  onChange={(e) => set("subtotal", e.target.value)}
                  leading="$"
                  placeholder="0"
                />
              </Field>
              <div className="flex items-center gap-3 sm:col-span-6">
                <Button type="submit" variant="primary" loading={pending}>
                  Probar dirección
                </Button>
                <span className="text-xs text-adm-fg-muted">O hacé click en el mapa para probar un punto.</span>
              </div>
            </form>
          </CardBody>
        </Card>

        {tested ? (
          <Card>
            <CardHeader title="Resultado" />
            <CardBody className="space-y-3">
              {pending && tested.source === "point" && !tested.geocode ? (
                <p className="text-[13px] text-adm-fg-muted">Buscando la dirección del punto…</p>
              ) : null}

              {resolution ? (
                <div className="rounded-adm border border-adm-accent/30 bg-adm-accent-soft px-4 py-3">
                  <div className="text-xs text-adm-fg-muted">Zona asignada</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <Link href={`/admin/envios/zonas/${resolution.zone.id}`} className="text-base font-semibold text-adm-fg hover:underline">
                      {resolution.zone.name}
                    </Link>
                    <ZoneTypeBadge type={resolution.matchedBy} />
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
                    <div>
                      <dt className="text-adm-fg-muted">Costo</dt>
                      <dd className="tnum font-medium">
                        {resolution.cost === 0 ? "Gratis" : formatMoney(resolution.cost)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-adm-fg-muted">Gratis desde</dt>
                      <dd className="tnum font-medium">{resolution.freeOver === null ? "—" : formatMoney(resolution.freeOver)}</dd>
                    </div>
                    <div>
                      <dt className="text-adm-fg-muted">Demora</dt>
                      <dd className="font-medium">{resolution.eta || "—"}</dd>
                    </div>
                  </dl>
                  {validSubtotal !== undefined && resolution.freeOver !== null && resolution.cost > 0 ? (
                    <p className="mt-2 text-xs text-adm-fg-muted">
                      Le faltan {formatMoney(amountForFreeShipping(resolution.zone, validSubtotal))} para el envío gratis.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-adm border border-adm-border bg-adm-surface-2 px-4 py-3 text-[13px]">
                  <p className="font-medium text-adm-fg">Ninguna zona activa incluye esta dirección.</p>
                  <p className="mt-1 text-adm-fg-muted">
                    En el checkout el cliente ve “No llegamos a tu zona todavía” y puede consultar por WhatsApp o elegir retiro.
                    Si querés cubrirla, sumá una zona “Todo el país” al final.
                  </p>
                </div>
              )}

              <div className="text-[13px]">
                {tested.geocode ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={CONFIDENCE[tested.geocode.confidence].tone}>{CONFIDENCE[tested.geocode.confidence].label}</Badge>
                      <span className="tnum text-xs text-adm-fg-muted">
                        {tested.point?.lat.toFixed(5)}, {tested.point?.lng.toFixed(5)}
                      </span>
                    </div>
                    <p className="mt-1 text-adm-fg">{tested.geocode.displayName}</p>
                    <p className="mt-0.5 text-xs text-adm-fg-muted">
                      {tested.source === "point" ? "Punto marcado en el mapa. " : `${CONFIDENCE[tested.geocode.confidence].help} `}
                      {provinceHint ? `Provincia: ${provinceHint}.` : ""}
                      {tested.address.postal_code ? ` CP: ${tested.address.postal_code}.` : ""}
                    </p>
                  </>
                ) : tested.point ? (
                  <p className="text-adm-fg-muted">
                    Punto {tested.point.lat.toFixed(5)}, {tested.point.lng.toFixed(5)}.
                  </p>
                ) : (
                  <p className="text-adm-fg-muted">
                    No pudimos ubicar la dirección en el mapa, así que las zonas por polígono no se evaluaron. Probá escribiéndola
                    de otra forma o hacé click en el mapa donde queda.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        ) : null}
      </div>

      <div className="space-y-4">
        <PointMap
          point={tested?.point ?? null}
          onPointChange={testPoint}
          center={center}
          overlays={overlays}
          height={420}
          pointZoom={14}
          label="Mapa de prueba de zonas"
        />

        {tested ? (
          <Table>
            <THead>
              <tr>
                <TH className="w-8">#</TH>
                <TH>Zona</TH>
                <TH>Tipo</TH>
                <TH>Incluye</TH>
                <TH>
                  <span className="sr-only">Resultado</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {evaluation.map((e, i) => (
                <TR key={e.zone.id} className={e.inactive ? "text-adm-fg-muted" : undefined}>
                  <TD numeric muted className="text-left">
                    {i + 1}
                  </TD>
                  <TD>
                    <Link href={`/admin/envios/zonas/${e.zone.id}`} className="font-medium hover:underline">
                      {e.zone.name}
                    </Link>
                    {e.inactive ? <span className="ml-1.5 text-xs">(inactiva)</span> : null}
                  </TD>
                  <TD>
                    <ZoneTypeBadge type={e.zone.type} />
                  </TD>
                  <TD>
                    {e.includes ? (
                      <span className="inline-flex items-center gap-1 text-adm-success">
                        <Check className="size-4" aria-hidden /> Sí
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-adm-fg-muted">
                        <Minus className="size-4" aria-hidden /> No
                      </span>
                    )}
                  </TD>
                  <TD>{e.winner ? <Badge tone="accent">Gana</Badge> : null}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : null}
      </div>
    </div>
  );
}

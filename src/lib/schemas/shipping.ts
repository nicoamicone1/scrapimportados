/**
 * Schemas zod de envíos (compartidos entre los forms del admin y las actions).
 */
import { z } from "zod";

import { normalizeGeometry, type ZoneGeometry } from "@/lib/shipping/geometry";
import { isProvinceCode, normalizePostalPrefix, POSTAL_PREFIX_RE } from "@/lib/shipping/provinces";
import { ZONE_TYPES, type ShippingZoneType } from "@/lib/shipping/resolve";

/** "" / null / undefined → null; números como string ("12.500,50" no: usá punto o input number). */
const money = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v.replace(",", "."))) : v),
    z
      .number({ required_error: `Ingresá ${label}.`, invalid_type_error: `Ingresá ${label}.` })
      .finite(`Ingresá ${label}.`)
      .min(0, "No puede ser negativo.")
      .max(99_999_999, "Es demasiado alto."),
  );

const optionalMoney = z.preprocess(
  (v) => (v === "" || v === undefined ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v),
  z
    .number({ invalid_type_error: "Ingresá un monto válido." })
    .finite("Ingresá un monto válido.")
    .min(0, "No puede ser negativo.")
    .max(99_999_999, "Es demasiado alto.")
    .nullable(),
);

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : v ?? null),
    z.string().max(max, `Como máximo ${max} caracteres.`).nullable(),
  );

/** GeoJSON Polygon/MultiPolygon validado y normalizado (anillos cerrados, ≥ 4 posiciones, rango). */
export const zoneGeometrySchema = z.unknown().transform((value, ctx): ZoneGeometry | null => {
  if (value === null || value === undefined) return null;
  const res = normalizeGeometry(value);
  if (!res.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error });
    return z.NEVER;
  }
  return res.geometry;
});

export const shippingZoneSchema = z
  .object({
    name: z.string().trim().min(1, "Poné un nombre.").max(80, "Como máximo 80 caracteres."),
    type: z.enum(ZONE_TYPES as unknown as [ShippingZoneType, ...ShippingZoneType[]], {
      errorMap: () => ({ message: "Elegí un tipo de zona." }),
    }),
    cost: money("el costo"),
    free_over: optionalMoney,
    eta_text: optionalText(60),
    notes: optionalText(1000),
    is_active: z.boolean().default(true),
    geometry: zoneGeometrySchema,
    provinces: z.array(z.string()).default([]),
    postal_prefixes: z.array(z.string()).default([]),
  })
  .transform((zone) => ({
    ...zone,
    provinces: Array.from(new Set(zone.provinces)),
    postal_prefixes: Array.from(new Set(zone.postal_prefixes.map(normalizePostalPrefix).filter(Boolean))),
  }))
  .superRefine((zone, ctx) => {
    if (zone.type === "polygon" && !zone.geometry) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["geometry"], message: "Dibujá al menos un polígono en el mapa." });
    }
    if (zone.type === "provinces") {
      if (zone.provinces.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["provinces"], message: "Elegí al menos una provincia." });
      }
      const bad = zone.provinces.find((p) => !isProvinceCode(p));
      if (bad) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["provinces"], message: `Provincia desconocida: ${bad}.` });
    }
    if (zone.type === "postal_prefixes") {
      if (zone.postal_prefixes.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["postal_prefixes"], message: "Cargá al menos un código postal." });
      }
      const bad = zone.postal_prefixes.filter((p) => !POSTAL_PREFIX_RE.test(p));
      if (bad.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["postal_prefixes"],
          message: `No son válidos: ${bad.slice(0, 5).join(", ")}. Usá de 1 a 4 dígitos (1900) o un CPA (B1900ABC).`,
        });
      }
    }
  })
  // Se guarda sólo lo que corresponde al tipo (el resto vacío).
  .transform((zone) => ({
    ...zone,
    geometry: zone.type === "polygon" ? zone.geometry : null,
    provinces: zone.type === "provinces" ? zone.provinces : [],
    postal_prefixes: zone.type === "postal_prefixes" ? zone.postal_prefixes : [],
  }));

export type ShippingZoneInput = z.input<typeof shippingZoneSchema>;
export type ShippingZoneData = z.output<typeof shippingZoneSchema>;

const coordinate = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.number().finite().min(min).max(max).nullable(),
  );

export const pickupLocationSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre.").max(80, "Como máximo 80 caracteres."),
  address: z.string().trim().min(5, "Ingresá la dirección completa.").max(200, "Como máximo 200 caracteres."),
  hours_text: optionalText(200),
  instructions_md: optionalText(2000),
  is_active: z.boolean().default(true),
  lat: coordinate(-90, 90),
  lng: coordinate(-180, 180),
});

export type PickupLocationInput = z.input<typeof pickupLocationSchema>;
export type PickupLocationData = z.output<typeof pickupLocationSchema>;

export const testAddressSchema = z
  .object({
    street: z.string().trim().max(120).default(""),
    number: z.string().trim().max(20).default(""),
    city: z.string().trim().max(120).default(""),
    province: z.string().trim().max(10).default(""),
    postal_code: z.string().trim().max(12).default(""),
  })
  .refine((a) => a.street || a.city || a.postal_code, {
    message: "Completá al menos la calle, la ciudad o el código postal.",
    path: ["street"],
  });

export type TestAddressInput = z.input<typeof testAddressSchema>;

export const reorderSchema = z.array(z.string().uuid()).min(1).max(500);

"use server";

import { revalidateTag } from "next/cache";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { mapPickupRow, mapZoneRow, type AdminPickupLocation, type AdminShippingZone } from "@/lib/admin/shipping";
import { logAudit, shallowDiff } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { pickupLocationSchema, reorderSchema, shippingZoneSchema, testAddressSchema } from "@/lib/schemas/shipping";
import { EXAMPLE_PICKUP, EXAMPLE_ZONES } from "@/lib/shipping/examples";
import { geocodeAddress, reverseGeocode, searchPlaces, type GeocodeResult } from "@/lib/shipping/geocode";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";

const TAG = "shipping";

function revalidate() {
  revalidateTag(TAG, "max");
}

const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

// ---------------------------------------------------------------------------
// Zonas
// ---------------------------------------------------------------------------

/** Crea (sin `id`) o actualiza una zona. */
export async function saveShippingZone(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = shippingZoneSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const z = parsed.data;
    const row = {
      name: z.name,
      type: z.type,
      cost: z.cost,
      free_over: z.free_over,
      eta_text: z.eta_text,
      notes: z.notes,
      is_active: z.is_active,
      geometry: z.geometry as Json | null,
      provinces: z.provinces,
      postal_prefixes: z.postal_prefixes,
    };

    if (id) {
      if (!uuid(id)) return fail("Zona inválida.");
      const { data: before } = await ctx.supabase.from("shipping_zones").select("*").eq("id", id).maybeSingle();
      if (!before) return fail("La zona ya no existe.");
      const { error } = await ctx.supabase.from("shipping_zones").update(row).eq("id", id);
      if (error) throw error;
      const { geometry, ...afterRest } = row;
      await logAudit(ctx, {
        action: "shipping_zone.update",
        entity: "shipping_zone",
        entityId: id,
        summary: `Editó la zona de envío "${z.name}"`,
        diff: shallowDiff(
          {
            name: before.name,
            type: before.type,
            cost: Number(before.cost),
            free_over: before.free_over === null ? null : Number(before.free_over),
            eta_text: before.eta_text,
            notes: before.notes,
            is_active: before.is_active,
            provinces: before.provinces,
            postal_prefixes: before.postal_prefixes,
            geometry_changed: false,
          },
          {
            ...afterRest,
            // La geometría no va al diff (puede ser enorme): sólo si cambió.
            geometry_changed: JSON.stringify(before.geometry) !== JSON.stringify(geometry),
          },
        ),
      });
      revalidate();
      return ok({ id });
    }

    // Nueva: va al final de la lista (menor prioridad).
    const { data: last } = await ctx.supabase
      .from("shipping_zones")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await ctx.supabase
      .from("shipping_zones")
      .insert({ ...row, position: (last?.position ?? -1) + 1 })
      .select("id")
      .single();
    if (error) throw error;
    await logAudit(ctx, {
      action: "shipping_zone.create",
      entity: "shipping_zone",
      entityId: data.id,
      summary: `Creó la zona de envío "${z.name}"`,
    });
    revalidate();
    return ok({ id: data.id });
  });
}

export async function setShippingZoneActive(id: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!uuid(id)) return fail("Zona inválida.");
    const { data, error } = await ctx.supabase
      .from("shipping_zones")
      .update({ is_active: Boolean(active) })
      .eq("id", id)
      .select("name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("La zona ya no existe.");
    await logAudit(ctx, {
      action: "shipping_zone.update",
      entity: "shipping_zone",
      entityId: id,
      summary: `${active ? "Activó" : "Desactivó"} la zona de envío "${data.name}"`,
      diff: { is_active: [!active, Boolean(active)] },
    });
    revalidate();
    return ok();
  });
}

export async function duplicateShippingZone(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!uuid(id)) return fail("Zona inválida.");
    const { data: src } = await ctx.supabase.from("shipping_zones").select("*").eq("id", id).maybeSingle();
    if (!src) return fail("La zona ya no existe.");
    const { data: last } = await ctx.supabase
      .from("shipping_zones")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const name = `${src.name} (copia)`.slice(0, 80);
    const { data, error } = await ctx.supabase
      .from("shipping_zones")
      .insert({
        name,
        type: src.type,
        geometry: src.geometry,
        provinces: src.provinces,
        postal_prefixes: src.postal_prefixes,
        cost: src.cost,
        free_over: src.free_over,
        eta_text: src.eta_text,
        notes: src.notes,
        // La copia arranca inactiva para no cambiar el checkout sin querer.
        is_active: false,
        position: (last?.position ?? -1) + 1,
      })
      .select("id")
      .single();
    if (error) throw error;
    await logAudit(ctx, {
      action: "shipping_zone.create",
      entity: "shipping_zone",
      entityId: data.id,
      summary: `Duplicó la zona de envío "${src.name}"`,
    });
    revalidate();
    return ok({ id: data.id });
  });
}

export async function deleteShippingZone(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!uuid(id)) return fail("Zona inválida.");
    const { data, error } = await ctx.supabase.from("shipping_zones").delete().eq("id", id).select("name").maybeSingle();
    if (error) throw error;
    if (!data) return fail("La zona ya no existe.");
    await logAudit(ctx, {
      action: "shipping_zone.delete",
      entity: "shipping_zone",
      entityId: id,
      summary: `Borró la zona de envío "${data.name}"`,
    });
    revalidate();
    return ok();
  });
}

/** Nuevo orden de prioridad: `ids[0]` se evalúa primero. */
export async function reorderShippingZones(ids: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = reorderSchema.safeParse(ids);
    if (!parsed.success) return fail("Orden inválido.");
    const order = parsed.data;
    const { data: current, error: readError } = await ctx.supabase.from("shipping_zones").select("id, name, position");
    if (readError) throw readError;
    const known = new Set((current ?? []).map((z) => z.id));
    if (order.length !== known.size || order.some((id) => !known.has(id))) {
      return fail("La lista cambió mientras la ordenabas. Recargá la página.");
    }
    const byId = new Map((current ?? []).map((z) => [z.id, z]));
    const changed = order.filter((id, i) => byId.get(id)?.position !== i);
    const results = await Promise.all(
      changed.map((id) => ctx.supabase.from("shipping_zones").update({ position: order.indexOf(id) }).eq("id", id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    if (changed.length) {
      await logAudit(ctx, {
        action: "shipping_zone.reorder",
        entity: "shipping_zone",
        summary: `Reordenó las zonas de envío: ${order.map((id) => byId.get(id)?.name ?? id).join(" › ")}`,
      });
      revalidate();
    }
    return ok();
  });
}

// ---------------------------------------------------------------------------
// Retiro en local
// ---------------------------------------------------------------------------

export async function savePickupLocation(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ pickup: AdminPickupLocation; geocoded: boolean }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = pickupLocationSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const p = parsed.data;
    let { lat, lng } = p;
    let geocoded = false;

    const before = id
      ? (await ctx.supabase.from("pickup_locations").select("*").eq("id", id).maybeSingle()).data
      : null;
    if (id && (!uuid(id) || !before)) return fail("El punto de retiro ya no existe.");

    // Sin ubicación (o cambió la dirección y no movieron el pin): geocodificamos al guardar.
    const addressChanged = !before || before.address !== p.address;
    const pinUntouched = before && before.lat === lat && before.lng === lng;
    if (lat === null || lng === null || (addressChanged && pinUntouched)) {
      const found = (await searchPlaces(p.address, 1))[0] ?? null;
      if (found) {
        lat = found.lat;
        lng = found.lng;
        geocoded = true;
      }
    }

    const row = {
      name: p.name,
      address: p.address,
      hours_text: p.hours_text,
      instructions_md: p.instructions_md,
      is_active: p.is_active,
      lat,
      lng,
    };

    if (id && before) {
      const { data, error } = await ctx.supabase.from("pickup_locations").update(row).eq("id", id).select("*").single();
      if (error) throw error;
      await logAudit(ctx, {
        action: "pickup_location.update",
        entity: "pickup_location",
        entityId: id,
        summary: `Editó el punto de retiro "${p.name}"`,
        diff: shallowDiff(
          {
            name: before.name,
            address: before.address,
            hours_text: before.hours_text,
            instructions_md: before.instructions_md,
            is_active: before.is_active,
            lat: before.lat,
            lng: before.lng,
          },
          row,
        ),
      });
      revalidate();
      return ok({ pickup: mapPickupRow(data), geocoded });
    }

    const { data: last } = await ctx.supabase
      .from("pickup_locations")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await ctx.supabase
      .from("pickup_locations")
      .insert({ ...row, position: (last?.position ?? -1) + 1 })
      .select("*")
      .single();
    if (error) throw error;
    await logAudit(ctx, {
      action: "pickup_location.create",
      entity: "pickup_location",
      entityId: data.id,
      summary: `Creó el punto de retiro "${p.name}"`,
    });
    revalidate();
    return ok({ pickup: mapPickupRow(data), geocoded });
  });
}

export async function setPickupLocationActive(id: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!uuid(id)) return fail("Punto de retiro inválido.");
    const { data, error } = await ctx.supabase
      .from("pickup_locations")
      .update({ is_active: Boolean(active) })
      .eq("id", id)
      .select("name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("El punto de retiro ya no existe.");
    await logAudit(ctx, {
      action: "pickup_location.update",
      entity: "pickup_location",
      entityId: id,
      summary: `${active ? "Activó" : "Desactivó"} el punto de retiro "${data.name}"`,
      diff: { is_active: [!active, Boolean(active)] },
    });
    revalidate();
    return ok();
  });
}

export async function deletePickupLocation(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!uuid(id)) return fail("Punto de retiro inválido.");
    const { data, error } = await ctx.supabase.from("pickup_locations").delete().eq("id", id).select("name").maybeSingle();
    if (error) throw error;
    if (!data) return fail("El punto de retiro ya no existe.");
    await logAudit(ctx, {
      action: "pickup_location.delete",
      entity: "pickup_location",
      entityId: id,
      summary: `Borró el punto de retiro "${data.name}"`,
    });
    revalidate();
    return ok();
  });
}

// ---------------------------------------------------------------------------
// Ejemplo
// ---------------------------------------------------------------------------

/** Carga zonas + retiro de ejemplo SÓLO si no hay zonas (y el retiro si no hay puntos). */
export async function loadShippingExample(): Promise<ActionResult<{ zones: AdminShippingZone[]; pickups: AdminPickupLocation[] }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const [{ count: zoneCount }, { count: pickupCount }] = await Promise.all([
      ctx.supabase.from("shipping_zones").select("id", { count: "exact", head: true }),
      ctx.supabase.from("pickup_locations").select("id", { count: "exact", head: true }),
    ]);
    if ((zoneCount ?? 0) > 0) return fail("Ya tenés zonas cargadas: el ejemplo sólo se carga con la lista vacía.");

    const zoneRows: TablesInsert<"shipping_zones">[] = EXAMPLE_ZONES.map((z, i) => ({
      ...z,
      geometry: z.geometry as Json | null,
      is_active: true,
      position: i,
    }));
    const { data: zones, error } = await ctx.supabase.from("shipping_zones").insert(zoneRows).select("*");
    if (error) throw error;

    let pickups: AdminPickupLocation[] = [];
    if ((pickupCount ?? 0) === 0) {
      const { data, error: pErr } = await ctx.supabase
        .from("pickup_locations")
        .insert({ ...EXAMPLE_PICKUP, is_active: true, position: 0 })
        .select("*");
      if (pErr) throw pErr;
      pickups = (data ?? []).map(mapPickupRow);
    }

    await logAudit(ctx, {
      action: "shipping_zone.create",
      entity: "shipping_zone",
      summary: `Cargó el ejemplo de envíos (${zoneRows.length} zonas${pickups.length ? " y 1 punto de retiro" : ""})`,
    });
    revalidate();
    return ok({ zones: (zones ?? []).map(mapZoneRow).sort((a, b) => a.position - b.position), pickups });
  });
}

// ---------------------------------------------------------------------------
// Geocodificación (herramientas del admin)
// ---------------------------------------------------------------------------

/** Geocodifica la dirección de "Probar dirección". */
export async function geocodeTestAddress(input: unknown): Promise<ActionResult<GeocodeResult | null>> {
  return runAction(async () => {
    await requireAdmin();
    const parsed = testAddressSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const result = await geocodeAddress({ ...parsed.data, country: "AR" });
    return ok(result);
  });
}

/** Punto del mapa → dirección (provincia y CP para evaluar las demás zonas). */
export async function reverseGeocodePoint(lat: number, lng: number): Promise<ActionResult<GeocodeResult | null>> {
  return runAction(async () => {
    await requireAdmin();
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return fail("Punto inválido.");
    }
    return ok(await reverseGeocode(lat, lng));
  });
}

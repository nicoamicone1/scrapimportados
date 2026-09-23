import type { Metadata } from "next";
import Link from "next/link";

import { platformPageGuard } from "@/app/(platform)/platform/guard";
import { AppHeader } from "@/components/platform/AppHeader";
import { parsePlan } from "@/lib/plans";

import { PlanEditor } from "./PlanEditor";

export const metadata: Metadata = { title: "Planes · Plataforma" };
export const dynamic = "force-dynamic";

export default async function PlatformPlansPage() {
  const { supabase, user, profile } = await platformPageGuard("/platform/planes");
  const { data, error } = await supabase
    .from("plans")
    .select("code, name, description, price_monthly, currency, is_public, features, limits")
    .order("position");
  if (error) throw new Error(error.message);
  // plans.mp_plan_id llega con la migración 0015: sin ella, no se muestra el campo.
  const mp = await supabase.from("plans").select("code, mp_plan_id");
  const mpIds = mp.error ? null : new Map((mp.data ?? []).map((p) => [p.code, p.mp_plan_id ?? ""]));
  // Pago anual (migración 0019): sin ella, no se muestran los campos.
  const yr = await supabase.from("plans").select("code, price_yearly, mp_plan_id_yearly");
  const yearly = yr.error
    ? null
    : new Map(
        (yr.data ?? []).map((p) => [p.code, { price: p.price_yearly === null ? "" : String(Number(p.price_yearly)), mpPlanId: p.mp_plan_id_yearly ?? "" }]),
      );
  const mpConfigured = Boolean(process.env.MP_ACCESS_TOKEN?.trim());

  return (
    <div className="min-h-dvh">
      <AppHeader email={user.email ?? ""} isPlatformAdmin={profile.is_platform_admin} section="platform" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-[13px] text-adm-fg-muted">
          <Link href="/platform" className="hover:underline">
            Plataforma
          </Link>{" "}
          / Planes
        </p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em]">Planes</h1>
        <p className="mt-1 max-w-2xl text-sm text-adm-fg-muted">
          Lo que cambies acá rige al instante para todas las tiendas de ese plan (la web pública se actualiza en unos minutos). Los códigos de
          función y límite los usa el código: si agregás uno nuevo, sumalo también en <code className="font-mono text-xs">src/lib/plans/features.ts</code>.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-adm-fg-muted">
          {mpIds === null
            ? "Cobro con MercadoPago: falta aplicar la migración 0015."
            : mpConfigured
              ? "Cobro con MercadoPago activo: los planes con id de MercadoPago muestran «Pagar con MercadoPago» al dueño de cada tienda."
              : "Cobro con MercadoPago apagado (falta MP_ACCESS_TOKEN): los dueños sólo ven el pedido por WhatsApp."}
        </p>
        <p className="mt-2 max-w-2xl text-sm text-adm-fg-muted">
          {yearly === null
            ? "Pago anual: falta aplicar la migración 0019."
            : "Pago anual: con precio anual, la web muestra «Pagando el año: …» bajo el precio mensual y el dueño puede pagar el año (por WhatsApp y, con MercadoPago activo, también con MercadoPago). 12 meses por el precio de 10 = precio anual igual a 10 veces el mensual."}
        </p>
        <div className="mt-6 space-y-4">
          {(data ?? []).map((p) => (
            <PlanEditor
              key={p.code}
              value={{
                code: p.code,
                name: p.name,
                description: p.description ?? "",
                isPublic: p.is_public,
                plan: parsePlan({ ...p, status: "active" }),
                mpPlanId: mpIds ? (mpIds.get(p.code) ?? "") : null,
                yearly: yearly ? (yearly.get(p.code) ?? { price: "", mpPlanId: "" }) : null,
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

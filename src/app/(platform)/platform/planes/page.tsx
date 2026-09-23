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
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

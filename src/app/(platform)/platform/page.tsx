import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/platform/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/money";
import { PLAN_NAMES, type PlanCode } from "@/lib/plans";

import { platformPageGuard } from "./guard";

export const metadata: Metadata = { title: "Plataforma" };
export const dynamic = "force-dynamic";

interface Stats {
  stores: number;
  stores_active: number;
  stores_new_7d: number;
  users: number;
  orders_30d: number;
  gmv_30d: number;
  trialing: number;
  by_plan: Record<string, number>;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseStats(v: unknown): Stats {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const by = o.by_plan && typeof o.by_plan === "object" ? (o.by_plan as Record<string, unknown>) : {};
  return {
    stores: num(o.stores),
    stores_active: num(o.stores_active),
    stores_new_7d: num(o.stores_new_7d),
    users: num(o.users),
    orders_30d: num(o.orders_30d),
    gmv_30d: num(o.gmv_30d),
    trialing: num(o.trialing),
    by_plan: Object.fromEntries(Object.entries(by).map(([k, n]) => [k, num(n)])),
  };
}

const STATUS_TONE = { active: "green", suspended: "amber", deleted: "neutral" } as const;
const STATUS_LABEL: Record<string, string> = { active: "Activa", suspended: "Suspendida", deleted: "Borrada" };
const SUB_LABEL: Record<string, string> = { trialing: "Prueba", active: "Activa", past_due: "Pago pendiente", cancelled: "Cancelada" };

export default async function PlatformPage({ searchParams }: PageProps<"/platform">) {
  const { supabase, user, profile } = await platformPageGuard("/platform");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";

  const [{ data: rawStats }, { data: rows, error }] = await Promise.all([supabase.rpc("platform_stats"), supabase.rpc("platform_list_stores")]);
  if (error) throw new Error(error.message);
  const stats = parseStats(rawStats);
  const stores = (rows ?? []).filter(
    (s) => !q || s.name.toLowerCase().includes(q) || s.slug.includes(q) || (s.owner_email ?? "").toLowerCase().includes(q),
  );

  return (
    <div className="min-h-dvh">
      <AppHeader email={user.email ?? ""} isPlatformAdmin={profile.is_platform_admin} section="platform" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Plataforma</h1>
            <p className="mt-1 text-sm text-adm-fg-muted">Tiendas, planes y uso de Ecommy.</p>
          </div>
          <Link href="/platform/planes" className="text-sm font-medium text-adm-accent hover:underline">
            Editar planes
          </Link>
        </div>

        <dl className="mt-6 grid grid-cols-2 rounded-adm border border-adm-border bg-adm-surface sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Tiendas", formatNumber(stats.stores), `${formatNumber(stats.stores_active)} activas`],
            ["Nuevas (7 días)", formatNumber(stats.stores_new_7d), `${formatNumber(stats.trialing)} en prueba`],
            ["Usuarios", formatNumber(stats.users), ""],
            ["Pedidos (30 días)", formatNumber(stats.orders_30d), ""],
            ["Vendido (30 días)", formatMoney(stats.gmv_30d), "todas las tiendas"],
            [
              "Por plan",
              Object.entries(stats.by_plan)
                .map(([k, n]) => `${PLAN_NAMES[k as PlanCode] ?? k} ${n}`)
                .join(" · ") || "—",
              "",
            ],
          ].map(([label, value, sub], i) => (
            <div key={label} className={i ? "border-l border-adm-border px-4 py-3" : "px-4 py-3"}>
              <dt className="text-xs text-adm-fg-muted">{label}</dt>
              <dd className="tnum mt-1 text-[18px] leading-tight font-semibold">{value}</dd>
              {sub ? <dd className="text-xs text-adm-fg-muted">{sub}</dd> : null}
            </div>
          ))}
        </dl>

        <form className="mt-6 flex max-w-sm gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, dirección o email"
            className="h-8 flex-1 rounded-adm border border-adm-input-border bg-adm-surface px-2.5 text-sm"
            aria-label="Buscar tiendas"
          />
        </form>

        <div className="mt-3 overflow-x-auto rounded-adm border border-adm-border bg-adm-surface">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b border-adm-border bg-adm-table-head text-left text-xs text-adm-fg-muted">
                <th className="px-4 py-2 font-medium">Tienda</th>
                <th className="px-3 py-2 font-medium">Dueño</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Productos</th>
                <th className="px-3 py-2 text-right font-medium">Pedidos</th>
                <th className="px-3 py-2 font-medium">Creada</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} className="border-b border-adm-border last:border-b-0 hover:bg-adm-row-hover">
                  <td className="px-4 py-2">
                    <Link href={`/platform/tiendas/${s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    <div className="text-xs text-adm-fg-muted">{s.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-adm-fg-muted">{s.owner_email ?? "—"}</td>
                  <td className="px-3 py-2">
                    {PLAN_NAMES[(s.plan_code ?? "free") as PlanCode] ?? s.plan_code}
                    <div className="text-xs text-adm-fg-muted">
                      {SUB_LABEL[s.sub_status ?? ""] ?? "—"}
                      {s.sub_status === "trialing" && s.trial_ends_at ? ` hasta ${formatDate(s.trial_ends_at)}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[s.status as keyof typeof STATUS_TONE] ?? "neutral"}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                  </td>
                  <td className="tnum px-3 py-2 text-right">{formatNumber(s.products)}</td>
                  <td className="tnum px-3 py-2 text-right">{formatNumber(s.orders)}</td>
                  <td className="px-3 py-2 text-adm-fg-muted">{formatDate(s.created_at)}</td>
                </tr>
              ))}
              {!stores.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-adm-fg-muted">
                    No hay tiendas{q ? " que coincidan" : ""}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

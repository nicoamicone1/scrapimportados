import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStoreProvider } from "@/components/admin/AdminStoreContext";
import { SIDEBAR_COOKIE } from "@/components/admin/nav";
import { PendingApproval } from "@/components/admin/PendingApproval";
import { SidebarPlanChip } from "@/components/admin/Sidebar";
import { StoreSwitcher } from "@/components/admin/StoreSwitcher";
import { getAdminState, getSession, listMyStores, ROLE_LABELS } from "@/lib/auth";
import { getPlanChip } from "@/lib/plans/chip";
import { storeHref, storeUrl } from "@/lib/tenant/urls";

export const dynamic = "force-dynamic";

/**
 * Chequeo REAL de acceso al panel (el proxy sólo hace el redirect optimista):
 * sesión válida + membresía activa en la tienda activa (cookie
 * `ecommy_admin_store`, ver `requireAdmin()`). Sin tiendas → /app/nueva;
 * membresía pausada → pantalla de espera.
 */
export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/admin");

  const state = await getAdminState();
  if (state.kind === "anonymous") redirect("/login?next=/admin");
  if (state.kind === "no-stores") redirect("/app/nueva");
  if (state.kind === "inactive") return <PendingApproval email={user.email ?? ""} inactive />;

  const ctx = state.ctx;
  const [cookieStore, myStores] = await Promise.all([cookies(), listMyStores()]);
  const chip = getPlanChip(ctx);
  const switcherStores = myStores.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name, slug: s.slug, role: s.role }));
  if (ctx.membership.impersonating) switcherStores.unshift({ id: ctx.store.id, name: ctx.store.name, slug: ctx.store.slug, role: "owner" });

  return (
    <AdminStoreProvider
      value={{
        store: {
          id: ctx.store.id,
          slug: ctx.store.slug,
          name: ctx.store.name,
          status: ctx.store.status,
          url: storeUrl(ctx.store),
          href: storeHref(ctx.store),
        },
        plan: ctx.plan,
        role: ctx.membership.role,
        impersonating: ctx.membership.impersonating,
        isPlatformAdmin: ctx.profile.is_platform_admin,
      }}
    >
      <AdminShell
        storeName={ctx.store.name}
        storeHref={storeHref(ctx.store)}
        isOwner={ctx.membership.role === "owner"}
        initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
        planChip={
          <SidebarPlanChip tone={chip.tone} href="/admin/plan">
            {chip.label}
          </SidebarPlanChip>
        }
        storeSwitcher={
          <StoreSwitcher
            stores={switcherStores}
            active={{ id: ctx.store.id, name: ctx.store.name, slug: ctx.store.slug }}
            impersonating={ctx.membership.impersonating}
          />
        }
        user={{
          name: ctx.profile.name || user.email || "Usuario",
          email: ctx.profile.email,
          roleLabel: ctx.membership.impersonating ? "Superadmin" : ROLE_LABELS[ctx.membership.role],
        }}
      >
        {children}
      </AdminShell>
    </AdminStoreProvider>
  );
}

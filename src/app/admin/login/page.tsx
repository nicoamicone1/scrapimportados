import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getProfile, getSession, isAdminRole } from "@/lib/auth";
import { formatNumber } from "@/lib/money";
import { getCatalogIndex } from "@/lib/store/products";
import { getSettings } from "@/lib/store/settings";

import { AuthLayout } from "../AuthLayout";
import { LoginForm, NewPasswordForm } from "./LoginForms";

export const metadata: Metadata = { title: "Ingresar" };

async function storeContext() {
  try {
    const [settings, index] = await Promise.all([getSettings(), getCatalogIndex()]);
    return { name: settings.name, aside: `${formatNumber(index.length)} productos publicados en la tienda.` };
  } catch {
    return { name: "Ecommy", aside: undefined };
  }
}

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/admin";
  const reset = params.reset === "1";
  const linkError = params.error === "link";

  const { user } = await getSession();
  if (user && !reset) {
    const profile = await getProfile();
    if (profile && profile.is_active && isAdminRole(profile.role)) redirect(next.startsWith("/admin") ? next : "/admin");
  }

  const store = await storeContext();

  return (
    <AuthLayout storeName={store.name} aside={store.aside}>
      {linkError ? (
        <p role="alert" className="mb-6 rounded-adm border border-adm-border bg-adm-surface-2 px-3 py-2 text-[13px]">
          El link venció o ya se usó. Pedí uno nuevo desde «¿Olvidaste tu contraseña?».
        </p>
      ) : null}
      {reset && user ? <NewPasswordForm /> : <LoginForm next={next} />}
      <p className="mt-8 text-[13px] text-adm-fg-muted">
        ¿Primera vez? Si la tienda todavía no tiene dueño,{" "}
        <Link href="/admin/setup" className="text-adm-accent hover:underline">
          creá la cuenta inicial
        </Link>
        .
      </p>
    </AuthLayout>
  );
}

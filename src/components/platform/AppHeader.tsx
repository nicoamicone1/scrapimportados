import { LogOut } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/version";

import { BrandLockup } from "./brand";

/**
 * Header de las pantallas con sesión fuera del panel (/app, /platform):
 * lockup, navegación en pastillas (la activa en tinta, BRAND §10 chips) y la
 * cuenta. "Plataforma" y "Redes" sólo para superadmins.
 */
export function AppHeader({
  email,
  isPlatformAdmin,
  section,
}: {
  email: string;
  isPlatformAdmin: boolean;
  section: "app" | "platform" | "redes";
}) {
  const link = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 shrink-0 items-center rounded-full px-3.5 whitespace-nowrap transition-colors duration-[140ms] ease-eco-out pointer-coarse:h-11",
        active ? "bg-eco-ink font-medium text-white" : "text-adm-fg-muted hover:bg-eco-niebla-2 hover:text-adm-fg",
      )}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b border-eco-line bg-adm-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" aria-label={`${APP_NAME}, inicio`} className="flex shrink-0 items-center rounded-adm">
          <BrandLockup hideWordmarkOnMobile />
        </Link>
        <nav aria-label="Cuenta" className="flex min-w-0 items-center gap-1 overflow-x-auto text-[14px]">
          {link("/app", "Mis tiendas", section === "app")}
          {isPlatformAdmin ? link("/platform", "Plataforma", section === "platform") : null}
          {isPlatformAdmin ? link("/platform/redes", "Redes", section === "redes") : null}
          {link("/planes", "Planes", false)}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden max-w-[220px] truncate text-[13px] text-adm-fg-muted md:inline">{email}</span>
          <form action={signOut}>
            <SubmitButton size="sm" variant="ghost" pendingText="Saliendo…" className="h-10 rounded-full px-3.5 pointer-coarse:h-11" aria-label="Salir de la cuenta">
              <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
              <span className="max-sm:sr-only">Salir</span>
            </SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";

import { signOut } from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/version";

import { BrandLockup } from "./brand";

/** Header de las pantallas con sesión fuera del panel (/app, /platform). "Plataforma" y "Redes" sólo para superadmins. */
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
      className={cn("inline-flex h-11 shrink-0 items-center whitespace-nowrap", active ? "font-medium text-adm-fg" : "text-adm-fg-muted hover:text-adm-fg")}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b border-adm-border bg-adm-surface">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <Link href="/" aria-label={`${APP_NAME}, inicio`} className="flex shrink-0 items-center rounded-adm">
          <BrandLockup hideWordmarkOnMobile />
        </Link>
        <nav aria-label="Cuenta" className="flex min-w-0 items-center gap-4 overflow-x-auto text-[13px] sm:gap-5">
          {link("/app", "Mis tiendas", section === "app")}
          {isPlatformAdmin ? link("/platform", "Plataforma", section === "platform") : null}
          {isPlatformAdmin ? link("/platform/redes", "Redes", section === "redes") : null}
          {link("/planes", "Planes", false)}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden truncate text-[13px] text-adm-fg-muted sm:inline">{email}</span>
          <form action={signOut}>
            <SubmitButton size="sm" variant="ghost" pendingText="Saliendo…">
              Salir
            </SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";

import { signOut } from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { APP_NAME } from "@/lib/version";

import { BrandMark } from "./PlatformChrome";

/** Header de las pantallas con sesión fuera del panel (/app, /platform). */
export function AppHeader({ email, isPlatformAdmin, section }: { email: string; isPlatformAdmin: boolean; section: "app" | "platform" }) {
  const link = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={active ? "font-medium text-adm-fg" : "text-adm-fg-muted hover:text-adm-fg"}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b border-adm-border bg-adm-surface">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-[5px]">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">{APP_NAME}</span>
        </Link>
        <nav aria-label="Cuenta" className="flex items-center gap-5 text-[13px]">
          {link("/app", "Mis tiendas", section === "app")}
          {isPlatformAdmin ? link("/platform", "Plataforma", section === "platform") : null}
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

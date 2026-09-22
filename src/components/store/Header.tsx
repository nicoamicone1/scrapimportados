import Link from "next/link";

import type { MenuItem } from "@/lib/store/menus";
import type { StoreSettings } from "@/lib/store/settings";

import { HeaderBar } from "./HeaderBar";

/**
 * Announcement bar + header temable (DESIGN.md §6.4): layouts `logo-left`,
 * `logo-center` y `minimal`; sticky y transparente sobre el hero de la home
 * según el tema.
 */
export function StoreHeader({
  settings,
  menu,
  homeStartsWithHero = false,
}: {
  settings: StoreSettings;
  menu: MenuItem[];
  /** La home publicada empieza con un `hero` con imagen. */
  homeStartsWithHero?: boolean;
}) {
  const { theme, announcement } = settings;
  const safeColor = (v: string) => (/^#[0-9a-f]{3,8}$/i.test(v) ? v : undefined);
  return (
    <>
      {announcement.enabled && announcement.text ? (
        <div
          className="flex min-h-8 items-center justify-center bg-secondary px-4 py-1.5 text-center text-xs text-fg"
          style={{ background: safeColor(announcement.bg), color: safeColor(announcement.fg) }}
        >
          {announcement.href ? (
            <Link href={announcement.href} className="link-quiet">
              {announcement.text}
            </Link>
          ) : (
            <p>{announcement.text}</p>
          )}
        </div>
      ) : null}
      <HeaderBar
        layout={theme.header.layout}
        sticky={theme.header.sticky}
        transparentOnHome={theme.header.transparentOnHome && homeStartsWithHero}
        showSearch={theme.header.showSearch}
        dividers={theme.effects.dividers}
        shadowOnScroll={theme.effects.shadows === "strong"}
        name={settings.name}
        logoUrl={settings.logo_url}
        menu={menu}
      />
    </>
  );
}

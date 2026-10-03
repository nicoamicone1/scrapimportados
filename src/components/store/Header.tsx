import { StoreLink } from "@/components/store/StoreLink";
import type { MenuItem } from "@/lib/store/menus";
import type { StoreSettings } from "@/lib/store/settings";

import { HeaderBar } from "./HeaderBar";

/** Copias de la marquesina: la mitad visible + la mitad duplicada para el loop. */
const MARQUEE_COPIES = 4;

/**
 * Announcement bar + header temable (DESIGN.md §6.4). La barra es estática y
 * centrada, salvo con `style.motion: "lively"`, donde corre como marquesina
 * (`.st-marquee`, se pausa con hover/foco; con movimiento reducido, quieta).
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
  const lively = theme.style.motion === "lively";

  const text = announcement.text;
  const track = (
    <div className="st-marquee-track">
      <span>{text}</span>
      {lively
        ? Array.from({ length: MARQUEE_COPIES * 2 - 1 }, (_, i) => (
            <span key={i} data-dup="" aria-hidden>
              {text}
            </span>
          ))
        : null}
    </div>
  );

  return (
    <>
      {announcement.enabled && text ? (
        <div
          className="store-announce st-marquee min-h-8 bg-secondary px-4 py-1.5 text-xs text-fg"
          data-lively={lively ? "1" : undefined}
          style={{ background: safeColor(announcement.bg), color: safeColor(announcement.fg) }}
        >
          {announcement.href ? (
            <StoreLink href={announcement.href} className="link-quiet flex min-w-full">
              {track}
            </StoreLink>
          ) : (
            track
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

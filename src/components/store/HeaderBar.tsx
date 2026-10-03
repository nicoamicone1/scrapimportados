"use client";

import { ChevronDown, Menu, Search, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useStoreBase } from "@/components/store/StoreBase";
import { StoreLink } from "@/components/store/StoreLink";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/cn";
import type { MenuItem } from "@/lib/store/menus";
import type { Theme } from "@/lib/theme";
import { stripStoreBase } from "@/lib/tenant/urls";

import { Drawer } from "./Drawer";
import { SearchBox } from "./SearchBox";

export type HeaderLayout = Theme["header"]["layout"];

export interface HeaderBarProps {
  layout: HeaderLayout;
  sticky: boolean;
  /** La home empieza con un hero con imagen y el tema pide header transparente. */
  transparentOnHome: boolean;
  showSearch: boolean;
  dividers: boolean;
  shadowOnScroll: boolean;
  name: string;
  logoUrl: string | null;
  menu: MenuItem[];
}

/** Layouts que se pueden superponer al hero (los de una sola fila, sin pastilla). */
const CAN_BE_TRANSPARENT: HeaderLayout[] = ["logo-left", "logo-center", "minimal"];

function isCurrent(pathname: string, href: string): boolean {
  if (!href.startsWith("/") || href.includes("#")) return false;
  const path = href.split("?")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

function Logo({ name, logoUrl, center, size = "md" }: { name: string; logoUrl: string | null; center?: boolean; size?: "md" | "xl" }) {
  return (
    <StoreLink href="/" className={cn("hdr-logo flex min-w-0 shrink-0 items-center", center && "justify-center")} data-size={size} aria-label={`${name}, inicio`}>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={name}
          width={size === "xl" ? 240 : 160}
          height={size === "xl" ? 60 : 40}
          className={cn("w-auto object-contain", size === "xl" ? "h-8 max-w-[200px] lg:h-12 lg:max-w-[240px]" : "h-7 max-w-[160px] lg:h-9")}
          priority
        />
      ) : (
        <span className="hdr-logo-text heading truncate leading-none">{name}</span>
      )}
    </StoreLink>
  );
}

function CartTrigger({ variant = "icon" }: { variant?: "icon" | "text" | "labeled" }) {
  const { count, hydrated, open } = useCart();
  const n = hydrated ? count : 0;
  const label = n ? `Abrir carrito, ${n} ${n === 1 ? "producto" : "productos"}` : "Abrir carrito";
  if (variant === "text") {
    return (
      <button type="button" onClick={open} className="nav-link nav-upper st-link tnum inline-flex min-h-11 items-center px-1">
        Carrito ({n})
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      className={cn("hdr-cart relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md", variant === "labeled" ? "px-2 text-sm font-medium" : "size-11")}
      aria-label={label}
    >
      <ShoppingBag className="size-5" aria-hidden strokeWidth={1.5} />
      {variant === "labeled" ? <span className="hidden xl:inline">Carrito</span> : null}
      {n > 0 ? (
        <span
          key={n}
          className={cn(
            "hdr-cart-count st-pop tnum inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-none font-semibold text-primary-fg",
            variant === "labeled" ? "relative" : "absolute top-1 right-0.5",
          )}
        >
          {n}
        </span>
      ) : null}
    </button>
  );
}

/** Nav de escritorio: submenús al hover/foco (y click para teclado/touch). */
function DesktopNav({ menu, pathname, className, center }: { menu: MenuItem[]; pathname: string; className?: string; center?: boolean }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <nav aria-label="Principal" className={className}>
      <ul className={cn("hdr-nav flex items-center gap-x-6", center && "justify-center")}>
        {menu.map((item, i) =>
          item.children.length ? (
            <li
              key={`${item.label}-${i}`}
              className="group relative"
              onMouseEnter={() => setOpenIdx(i)}
              onMouseLeave={() => setOpenIdx(null)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpenIdx(null);
              }}
            >
              <button
                type="button"
                className="nav-link nav-upper inline-flex min-h-11 items-center gap-1"
                aria-expanded={openIdx === i}
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                onKeyDown={(e) => e.key === "Escape" && setOpenIdx(null)}
              >
                {item.label}
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", openIdx === i && "rotate-180")} aria-hidden strokeWidth={1.5} />
              </button>
              {openIdx === i ? (
                <div className="hdr-menu absolute top-full left-0 z-40 pt-1">
                  <ul
                    className={cn(
                      "panel-float rounded-md border border-border p-2 text-fg",
                      item.children.length > 6 ? "grid w-[min(640px,80vw)] grid-cols-3 gap-x-4" : "min-w-56",
                    )}
                  >
                    {item.href && item.href !== "#" ? (
                      <li className={cn(item.children.length > 6 && "col-span-3")}>
                        <StoreLink href={item.href} className="block rounded-sm px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpenIdx(null)}>
                          Ver todo {item.label.toLowerCase()}
                        </StoreLink>
                      </li>
                    ) : null}
                    {item.children.map((child, j) => (
                      <li key={`${child.label}-${j}`}>
                        <StoreLink
                          href={child.href}
                          className="block rounded-sm px-3 py-2 text-sm hover:bg-surface"
                          aria-current={isCurrent(pathname, child.href) ? "page" : undefined}
                          onClick={() => setOpenIdx(null)}
                        >
                          {child.label}
                        </StoreLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ) : (
            <li key={`${item.label}-${i}`}>
              <StoreLink
                href={item.href}
                className="nav-link nav-upper st-link inline-flex min-h-11 items-center"
                aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </StoreLink>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

/** Menú del drawer mobile: acordeón para los submenús. */
function MobileNav({ menu, onNavigate, big }: { menu: MenuItem[]; onNavigate: () => void; big?: boolean }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const linkCls = big ? "heading block py-2 text-[length:var(--text-2xl)]" : "block py-3 text-base";
  return (
    <ul className={cn("px-4 sm:px-5", !big && "divide-y divide-border")}>
      {menu.map((item, i) => (
        <li key={`${item.label}-${i}`} className="st-pop" style={{ "--i": i } as React.CSSProperties}>
          {item.children.length ? (
            <>
              <button
                type="button"
                className={cn(linkCls, "flex w-full items-center justify-between text-left")}
                aria-expanded={expanded === i}
                aria-controls={`mnav-${i}`}
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                {item.label}
                <ChevronDown className={cn("size-4 transition-transform", expanded === i && "rotate-180")} aria-hidden strokeWidth={1.5} />
              </button>
              {expanded === i ? (
                <ul id={`mnav-${i}`} className="pb-3 pl-3">
                  {item.href && item.href !== "#" ? (
                    <li>
                      <StoreLink href={item.href} className="block py-2 text-sm font-medium" onClick={onNavigate}>
                        Ver todo
                      </StoreLink>
                    </li>
                  ) : null}
                  {item.children.map((child, j) => (
                    <li key={`${child.label}-${j}`}>
                      <StoreLink href={child.href} className="block py-2 text-sm text-fg-muted hover:text-fg" onClick={onNavigate}>
                        {child.label}
                      </StoreLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <StoreLink href={item.href} className={linkCls} onClick={onNavigate}>
              {item.label}
            </StoreLink>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Header temable (DESIGN.md §6.4): seis disposiciones que se reconocen de lejos.
 * `logo-left` y `logo-center` (una fila), `minimal` (todo en texto), `stacked`
 * (logo grande centrado + nav abajo; al scrollear queda sólo la nav),
 * `pill` (pastilla flotante despegada de los bordes) y `double` (buscador
 * protagonista + banda de categorías en el color primario). En mobile todos
 * son menú · logo · carrito, salvo `pill` (sigue siendo pastilla) y `double`
 * (suma el buscador visible en una segunda fila).
 */
export function HeaderBar(props: HeaderBarProps) {
  const { layout, sticky, showSearch, dividers, shadowOnScroll, name, logoUrl, menu } = props;
  const { basePath } = useStoreBase();
  // Path "de la tienda" (sin `/s/<slug>`), para comparar con los hrefs del menú.
  const pathname = stripStoreBase(usePathname(), basePath);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const transparent = props.transparentOnHome && pathname === "/" && CAN_BE_TRANSPARENT.includes(layout);

  useEffect(() => {
    // Un solo booleano (no por frame): cambia de estado al pasar los 8 px.
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const iconBtn = "inline-flex size-11 items-center justify-center rounded-md";
  const searchIcon = showSearch ? (
    <button type="button" className={iconBtn} aria-label="Buscar" onClick={() => setSearchOpen(true)}>
      <Search className="size-5" aria-hidden strokeWidth={1.5} />
    </button>
  ) : null;
  const menuBtn = (
    <button type="button" className={cn(iconBtn, "-ml-2")} aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>
      <Menu className="size-5" aria-hidden strokeWidth={1.5} />
    </button>
  );

  /** Fila mobile común: menú · logo · buscar + carrito. */
  const mobileRow = (
    <>
      <div className="flex flex-1 items-center lg:hidden">{menuBtn}</div>
      <div className="flex min-w-0 justify-center lg:hidden">
        <Logo name={name} logoUrl={logoUrl} center />
      </div>
      <div className="flex flex-1 items-center justify-end lg:hidden">
        {layout === "double" ? null : searchIcon}
        <CartTrigger />
      </div>
    </>
  );

  let body: React.ReactNode;
  if (layout === "stacked") {
    body = (
      <>
        <div className="hdr-row1 store-container flex items-center gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          {mobileRow}
          <div className="hidden items-center lg:flex">
            {showSearch ? (
              <button type="button" className="nav-link nav-upper st-link inline-flex min-h-11 items-center gap-2" onClick={() => setSearchOpen(true)}>
                <Search className="size-4" aria-hidden strokeWidth={1.5} />
                Buscar
              </button>
            ) : null}
          </div>
          <div className="hidden lg:block">
            <Logo name={name} logoUrl={logoUrl} center size="xl" />
          </div>
          <div className="hidden items-center justify-end lg:flex">
            <CartTrigger variant="text" />
          </div>
        </div>
        <div className="hdr-row2 hidden lg:block">
          <DesktopNav menu={menu} pathname={pathname} center className="store-container" />
        </div>
      </>
    );
  } else if (layout === "double") {
    body = (
      <>
        <div className="hdr-row1 store-container flex items-center gap-3 lg:gap-8">
          {mobileRow}
          <div className="hidden lg:block">
            <Logo name={name} logoUrl={logoUrl} />
          </div>
          {showSearch ? <SearchBox className="hdr-search-xl hidden max-w-[680px] flex-1 lg:block" /> : <div className="hidden flex-1 lg:block" />}
          <div className="hidden items-center lg:flex">
            <CartTrigger variant="labeled" />
          </div>
        </div>
        {showSearch ? (
          <div className="store-container pb-2.5 lg:hidden">
            <SearchBox className="hdr-search-xl" />
          </div>
        ) : null}
        {menu.length ? (
          <div className="hdr-band hidden lg:block">
            <DesktopNav menu={menu} pathname={pathname} className="store-container" />
          </div>
        ) : null}
      </>
    );
  } else if (layout === "pill") {
    body = (
      <div className="store-container h-full">
        <div className="hdr-pill flex h-full items-center gap-2 lg:gap-6">
          <div className="flex flex-1 items-center lg:hidden">{menuBtn}</div>
          <div className="flex min-w-0 justify-center lg:justify-start">
            <Logo name={name} logoUrl={logoUrl} />
          </div>
          <DesktopNav menu={menu} pathname={pathname} className="hidden min-w-0 flex-1 lg:block" center />
          <div className="flex flex-1 items-center justify-end lg:flex-none">
            {searchIcon}
            <CartTrigger />
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="store-container flex h-full items-center gap-3 lg:gap-6">
        {mobileRow}
        {layout === "logo-left" ? (
          <div className="hidden w-full items-center gap-8 lg:flex">
            <Logo name={name} logoUrl={logoUrl} />
            <DesktopNav menu={menu} pathname={pathname} className="min-w-0" />
            <div className="ml-auto flex items-center gap-2">
              {showSearch ? <SearchBox className="w-[min(420px,30vw)]" /> : null}
              <CartTrigger />
            </div>
          </div>
        ) : layout === "logo-center" ? (
          <div className="hidden w-full grid-cols-[1fr_auto_1fr] items-center gap-6 lg:grid">
            <DesktopNav menu={menu} pathname={pathname} />
            <Logo name={name} logoUrl={logoUrl} center />
            <div className="flex items-center justify-end gap-1">
              {searchIcon}
              <CartTrigger />
            </div>
          </div>
        ) : (
          <div className="hidden w-full items-center justify-between lg:flex">
            <Logo name={name} logoUrl={logoUrl} />
            <div className="flex items-center gap-6">
              <button type="button" className="nav-link nav-upper st-link min-h-11" onClick={() => setMenuOpen(true)}>
                Menú
              </button>
              {showSearch ? (
                <button type="button" className="nav-link nav-upper st-link min-h-11" onClick={() => setSearchOpen(true)}>
                  Buscar
                </button>
              ) : null}
              <CartTrigger variant="text" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <header
        data-layout={layout}
        data-sticky={sticky ? "1" : undefined}
        data-scrolled={scrolled && (sticky || transparent) ? "1" : undefined}
        data-transparent={transparent ? "1" : undefined}
        data-divider={dividers ? "1" : undefined}
        data-shadow={shadowOnScroll ? "1" : undefined}
        className={cn("store-header z-30", sticky ? "sticky top-0" : "relative")}
      >
        {body}
      </header>

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menú"
        side="left"
        size={layout === "minimal" ? "md" : "sm"}
      >
        <div className="py-2">
          {showSearch && layout !== "double" ? (
            <div className="px-4 pt-2 pb-3 sm:px-5 lg:hidden">
              <SearchBox onNavigate={() => setMenuOpen(false)} />
            </div>
          ) : null}
          <MobileNav menu={menu} onNavigate={() => setMenuOpen(false)} big={layout === "minimal" || layout === "stacked"} />
        </div>
      </Drawer>

      <Drawer open={searchOpen} onClose={() => setSearchOpen(false)} title="Buscar productos" side="right" size="md">
        <div className="p-4 sm:p-5">
          <SearchBox variant="overlay" autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      </Drawer>
    </>
  );
}

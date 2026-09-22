"use client";

import { ChevronDown, Menu, Search, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useCart } from "@/lib/cart";
import { cn } from "@/lib/cn";
import type { MenuItem } from "@/lib/store/menus";

import { Drawer } from "./Drawer";
import { SearchBox } from "./SearchBox";

export interface HeaderBarProps {
  layout: "logo-left" | "logo-center" | "minimal";
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

function isCurrent(pathname: string, href: string): boolean {
  if (!href.startsWith("/") || href.includes("#")) return false;
  const path = href.split("?")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

function Logo({ name, logoUrl, center }: { name: string; logoUrl: string | null; center?: boolean }) {
  return (
    <Link href="/" className={cn("flex shrink-0 items-center", center && "justify-center")} aria-label={`${name}, inicio`}>
      {logoUrl ? (
        <Image src={logoUrl} alt={name} width={160} height={40} className="h-7 w-auto max-w-[160px] object-contain lg:h-9" priority />
      ) : (
        <span className="heading truncate text-xl leading-none lg:text-2xl">{name}</span>
      )}
    </Link>
  );
}

function CartTrigger({ text }: { text?: boolean }) {
  const { count, hydrated, open } = useCart();
  const n = hydrated ? count : 0;
  if (text) {
    return (
      <button type="button" onClick={open} className="nav-link nav-upper tnum inline-flex min-h-11 items-center px-1">
        Carrito ({n})
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      className="relative inline-flex size-11 items-center justify-center rounded-md"
      aria-label={n ? `Abrir carrito, ${n} ${n === 1 ? "producto" : "productos"}` : "Abrir carrito"}
    >
      <ShoppingBag className="size-5" aria-hidden strokeWidth={1.5} />
      {n > 0 ? (
        <span className="tnum absolute top-1 right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-none font-semibold text-primary-fg">
          {n}
        </span>
      ) : null}
    </button>
  );
}

/** Nav de escritorio: submenús al hover/foco (y click para teclado/touch). */
function DesktopNav({ menu, pathname, className }: { menu: MenuItem[]; pathname: string; className?: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <nav aria-label="Principal" className={className}>
      <ul className="flex items-center gap-x-6">
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
                <ChevronDown className="size-3.5" aria-hidden strokeWidth={1.5} />
              </button>
              {openIdx === i ? (
                <div className="absolute top-full left-0 z-40 pt-1">
                  <ul
                    className={cn(
                      "panel-float rounded-md border border-border p-2 text-fg",
                      item.children.length > 6 ? "grid w-[min(640px,80vw)] grid-cols-3 gap-x-4" : "min-w-56",
                    )}
                  >
                    {item.href && item.href !== "#" ? (
                      <li className={cn(item.children.length > 6 && "col-span-3")}>
                        <Link href={item.href} className="block rounded-sm px-3 py-2 text-sm font-medium hover:bg-surface" onClick={() => setOpenIdx(null)}>
                          Ver todo {item.label.toLowerCase()}
                        </Link>
                      </li>
                    ) : null}
                    {item.children.map((child, j) => (
                      <li key={`${child.label}-${j}`}>
                        <Link
                          href={child.href}
                          className="block rounded-sm px-3 py-2 text-sm hover:bg-surface"
                          aria-current={isCurrent(pathname, child.href) ? "page" : undefined}
                          onClick={() => setOpenIdx(null)}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ) : (
            <li key={`${item.label}-${i}`}>
              <Link
                href={item.href}
                className="nav-link nav-upper inline-flex min-h-11 items-center"
                aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
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
        <li key={`${item.label}-${i}`}>
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
                      <Link href={item.href} className="block py-2 text-sm font-medium" onClick={onNavigate}>
                        Ver todo
                      </Link>
                    </li>
                  ) : null}
                  {item.children.map((child, j) => (
                    <li key={`${child.label}-${j}`}>
                      <Link href={child.href} className="block py-2 text-sm text-fg-muted hover:text-fg" onClick={onNavigate}>
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <Link href={item.href} className={linkCls} onClick={onNavigate}>
              {item.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function HeaderBar(props: HeaderBarProps) {
  const { layout, sticky, showSearch, dividers, shadowOnScroll, name, logoUrl, menu } = props;
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const transparent = props.transparentOnHome && pathname === "/";

  useEffect(() => {
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

  return (
    <>
      <header
        data-sticky={sticky ? "1" : undefined}
        data-scrolled={scrolled && (sticky || transparent) ? "1" : undefined}
        data-transparent={transparent ? "1" : undefined}
        data-divider={dividers ? "1" : undefined}
        data-shadow={shadowOnScroll ? "1" : undefined}
        className={cn("store-header z-30", sticky ? "sticky top-0" : "relative")}
        style={{ height: "var(--header-h)" }}
      >
        <div className="store-container flex h-full items-center gap-3 lg:gap-6">
          {/* Mobile (los tres layouts): menú · logo · buscar + carrito */}
          <div className="flex flex-1 items-center lg:hidden">
            <button type="button" className={cn(iconBtn, "-ml-2")} aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>
              <Menu className="size-5" aria-hidden strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex min-w-0 justify-center lg:hidden">
            <Logo name={name} logoUrl={logoUrl} center />
          </div>
          <div className="flex flex-1 items-center justify-end lg:hidden">
            {searchIcon}
            <CartTrigger />
          </div>

          {/* Desktop */}
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
                <button type="button" className="nav-link nav-upper min-h-11" onClick={() => setMenuOpen(true)}>
                  Menú
                </button>
                {showSearch ? (
                  <button type="button" className="nav-link nav-upper min-h-11" onClick={() => setSearchOpen(true)}>
                    Buscar
                  </button>
                ) : null}
                <CartTrigger text />
              </div>
            </div>
          )}
        </div>
      </header>

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menú"
        side="left"
        size={layout === "minimal" ? "md" : "sm"}
      >
        <div className="py-2">
          {showSearch ? (
            <div className="px-4 pt-2 pb-3 sm:px-5 lg:hidden">
              <SearchBox onNavigate={() => setMenuOpen(false)} />
            </div>
          ) : null}
          <MobileNav menu={menu} onNavigate={() => setMenuOpen(false)} big={layout === "minimal"} />
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

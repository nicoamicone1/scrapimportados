import "server-only";

import { Menu, Search, ShoppingBag } from "lucide-react";

import { renderBlock } from "@/components/blocks/BlockRenderer";
import { buttonAttrs } from "@/components/blocks/Button";
import { BlockSection } from "@/components/blocks/Section";
import { PriceTag } from "@/components/store/PriceTag";
import { resolveBlockData } from "@/lib/blocks/resolve";
import type { Block } from "@/lib/blocks/schema";
import { cn } from "@/lib/cn";
import { getMenus, type MenuItem } from "@/lib/store/menus";
import { getPublishedPage } from "@/lib/store/pages";
import { getSettings, type StoreSettings } from "@/lib/store/settings";
import type { Theme } from "@/lib/theme";

import { previewContext } from "../builder/render-preview";

import type { PreviewDevice } from "./preview-css";

/*
 * Contenido del preview del editor de apariencia (agente E), renderizado en
 * el server con componentes reales de la tienda (bloques, ProductCard,
 * PriceTag) y el tema SIN guardar. Header y footer son simulados (fieles a
 * DESIGN.md §6.4 y §6.7) para que respondan al ancho simulado.
 */

const FALLBACK_HERO = "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=2000&q=70";

function heroFrom(home: Block[] | undefined): Block {
  const existing = home?.find((b) => b.type === "hero" && b.settings.imageUrl);
  // En el preview, la portada va baja para que se vea más contenido del tema.
  if (existing && existing.type === "hero")
    return { ...existing, id: "pv-hero", style: { ...existing.style, hidden: false, hideOnMobile: false }, settings: { ...existing.settings, height: "sm" } };
  return {
    id: "pv-hero",
    type: "hero",
    style: { background: "default", paddingY: "none", container: "full" },
    settings: {
      eyebrow: "Temporada primavera",
      title: "Llegaron las novedades para la casa",
      subtitle: "Cocina, audio y deco. 10 % off pagando con transferencia.",
      imageUrl: FALLBACK_HERO,
      overlay: 45,
      align: "left",
      height: "sm",
      cta: { label: "Ver novedades", href: "/productos" },
      cta2: { label: "Cómo comprar", href: "/" },
    },
  };
}

const SLIDER: Block = {
  id: "pv-slider",
  type: "product_slider",
  style: { background: "default", paddingY: "md", container: "normal" },
  settings: { title: "Novedades", subtitle: "Lo último que sumamos al catálogo.", source: { kind: "newest", limit: 4 }, viewAllHref: "/productos", cardsPerView: 4 },
};

const BANNERS: Block = {
  id: "pv-banners",
  type: "banner_grid",
  style: { background: "default", paddingY: "sm", container: "normal" },
  settings: {
    columns: 2,
    ratio: "16:9",
    gap: "md",
    items: [
      {
        imageUrl: "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1400&q=70",
        title: "Cocina",
        subtitle: "Pequeños electros y bazar",
        cta: { label: "Ver cocina", href: "/productos" },
        align: "left",
        overlay: 40,
        textColor: "light",
      },
      {
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1400&q=70",
        title: "Audio",
        subtitle: "Auriculares y parlantes",
        cta: { label: "Ver audio", href: "/productos" },
        align: "left",
        overlay: 40,
        textColor: "light",
      },
    ],
  },
};

function Logo({ settings, className }: { settings: StoreSettings; className?: string }) {
  if (settings.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element -- logo de la tienda (cualquier dominio).
    return <img src={settings.logo_url} alt={settings.name} className={cn("h-8 w-auto max-w-[160px] object-contain", className)} />;
  }
  return <span className={cn("heading text-xl leading-none", className)}>{settings.name}</span>;
}

function PreviewHeader({ theme, settings, menu }: { theme: Theme; settings: StoreSettings; menu: MenuItem[] }) {
  const { layout, showSearch } = theme.header;
  const nav = menu.slice(0, 5);
  const upper = theme.buttons.uppercase && layout === "logo-center";
  const navClass = cn("text-sm hover:underline", upper && "text-xs tracking-[0.12em] uppercase");
  const cart = <ShoppingBag className="size-5" strokeWidth={1.5} aria-hidden />;
  return (
    <div className="@container">
      {settings.announcement.enabled && settings.announcement.text ? (
        <div
          className="flex h-8 items-center justify-center bg-secondary px-4 text-center text-xs text-fg"
          style={{ background: settings.announcement.bg || undefined, color: settings.announcement.fg || undefined }}
        >
          {settings.announcement.text}
        </div>
      ) : null}
      <header className={cn("bg-bg text-fg", theme.effects.dividers && "border-b border-border")}>
        <div className="store-container flex items-center gap-6" style={{ height: "var(--header-h)" }}>
          {/* Mobile: menú · logo · carrito */}
          <div className="flex w-full items-center justify-between @3xl:hidden">
            <Menu className="size-5" strokeWidth={1.5} aria-hidden />
            <Logo settings={settings} />
            <span className="flex items-center gap-3">
              {showSearch ? <Search className="size-5" strokeWidth={1.5} aria-hidden /> : null}
              {cart}
            </span>
          </div>
          {layout === "logo-left" ? (
            <div className="hidden w-full items-center gap-8 @3xl:flex">
              <Logo settings={settings} />
              <nav className="flex items-center gap-5" style={{ fontWeight: "var(--body-strong-weight)" }}>
                {nav.map((i) => (
                  <span key={i.label} className={navClass}>
                    {i.label}
                  </span>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-4">
                {showSearch ? (
                  <span className="flex h-10 w-[300px] items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm text-fg-muted">
                    <Search className="size-4" aria-hidden /> Buscar productos
                  </span>
                ) : null}
                {cart}
              </div>
            </div>
          ) : layout === "logo-center" ? (
            <div className="hidden w-full grid-cols-[1fr_auto_1fr] items-center @3xl:grid">
              <nav className="flex items-center gap-5">
                {nav.map((i) => (
                  <span key={i.label} className={navClass}>
                    {i.label}
                  </span>
                ))}
              </nav>
              <Logo settings={settings} className="text-2xl" />
              <div className="flex items-center justify-end gap-4">
                {showSearch ? <Search className="size-5" strokeWidth={1.5} aria-hidden /> : null}
                {cart}
              </div>
            </div>
          ) : (
            <div className="hidden w-full items-center justify-between @3xl:flex">
              <Logo settings={settings} />
              <div className="flex items-center gap-6 text-sm">
                <span>Menú</span>
                {showSearch ? <span>Buscar</span> : null}
                <span>Carrito (2)</span>
              </div>
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

function PreviewFooter({ theme, settings, menu }: { theme: Theme; settings: StoreSettings; menu: MenuItem[] }) {
  const year = new Date().getFullYear();
  const social = Object.keys(settings.social).map((k) => k[0].toUpperCase() + k.slice(1));
  const payments = "Transferencia bancaria (10 % off) · Acordás con el vendedor";
  const groups = menu.filter((m) => m.children.length);
  const style = theme.footer.style === "columns" && groups.length < 2 ? "simple" : theme.footer.style;

  if (style === "minimal") {
    return (
      <footer className="border-t border-border py-6 text-sm text-fg-muted">
        <div className="store-container">
          © {year} {settings.name} · Términos · Privacidad{theme.footer.showSocial && social.length ? ` · ${social.join(" · ")}` : ""}
        </div>
      </footer>
    );
  }
  if (style === "simple") {
    return (
      <footer className="@container border-t border-border pt-10 pb-6 text-sm">
        <div className="store-container">
          <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-end @3xl:justify-between">
            <p className="heading" style={{ fontSize: theme.preset === "editorial" ? "var(--text-display)" : "var(--text-2xl)" }}>
              {settings.name}
            </p>
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-fg-muted">
              {menu.flatMap((m) => (m.children.length ? m.children : [m])).slice(0, 6).map((i) => (
                <span key={`${i.label}${i.href}`}>{i.label}</span>
              ))}
            </nav>
          </div>
          <p className="mt-8 text-xs text-fg-muted">
            {[settings.whatsapp_phone ? `WhatsApp +${settings.whatsapp_phone}` : null, theme.footer.showSocial && social.length ? social.join(" · ") : null, theme.footer.showPayments ? payments : null, `© ${year} ${settings.name}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </footer>
    );
  }
  return (
    <footer className="@container border-t border-border pt-12 pb-6 text-sm">
      <div className="store-container grid gap-8 @3xl:grid-cols-12">
        <div className="@3xl:col-span-5">
          <p className="heading text-xl">{settings.name}</p>
          {settings.tagline ? <p className="mt-2 max-w-[40ch] text-fg-muted">{settings.tagline}</p> : null}
          {settings.whatsapp_phone ? <p className="mt-3 text-fg-muted">WhatsApp +{settings.whatsapp_phone}</p> : null}
          {theme.footer.showSocial && social.length ? <p className="mt-1 text-fg-muted">{social.join(" · ")}</p> : null}
        </div>
        {groups.slice(0, 2).map((g) => (
          <div key={g.label} className="@3xl:col-span-2">
            <p style={{ fontWeight: "var(--body-strong-weight)" }}>{g.label}</p>
            <ul className="mt-3 space-y-2 text-fg-muted">
              {g.children.map((c) => (
                <li key={`${c.label}${c.href}`}>{c.label}</li>
              ))}
            </ul>
          </div>
        ))}
        {theme.footer.showPayments ? (
          <div className="@3xl:col-span-3">
            <p style={{ fontWeight: "var(--body-strong-weight)" }}>Medios de pago</p>
            <p className="mt-3 text-fg-muted">{payments}</p>
          </div>
        ) : null}
      </div>
      <p className="store-container mt-10 text-xs text-fg-muted">
        © {year} {settings.name} · Defensa del Consumidor · Botón de arrepentimiento
      </p>
    </footer>
  );
}

function Showcase({ theme, transferPercent }: { theme: Theme; transferPercent: number }) {
  return (
    <section className="@container border-t border-border py-10">
      <div className="store-container grid gap-10 @3xl:grid-cols-2">
        <div>
          <h2 className="blk-title">Botones</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="sbtn" {...buttonAttrs(theme, "primary")}>
              Agregar al carrito
            </span>
            <span className="sbtn" {...buttonAttrs(theme, "secondary")}>
              Seguir comprando
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="sbtn" {...buttonAttrs(theme, "solid")}>
              Confirmar pedido
            </span>
            <span className="text-xs text-fg-muted">El botón de compra final es siempre sólido.</span>
          </div>
          <label className="mt-6 block max-w-[360px]">
            <span className="text-sm" style={{ fontWeight: 500 }}>
              Teléfono
            </span>
            <span
              className="mt-1.5 flex items-center rounded-md border border-border-strong bg-surface px-3 text-sm text-fg-muted"
              style={{ height: "var(--control-h)" }}
            >
              11 5555 0000
            </span>
            <span className="mt-1 block text-xs text-fg-muted">Con código de área, sin 0 ni 15.</span>
          </label>
        </div>
        <div>
          <h2 className="blk-title">Precios</h2>
          <div className="mt-4 space-y-5">
            <PriceTag price={36720} compareAt={45900} transferPercent={theme.cards.showTransferPrice ? transferPercent : 0} size="lg" />
            <PriceTag price={12500} transferPercent={theme.cards.showTransferPrice ? transferPercent : 0} size="md" />
          </div>
          <p className="mt-5 text-sm">
            <span className="text-success">Pagado</span> · <span className="text-danger">Sin stock</span> ·{" "}
            <span className="text-accent">Precio promocional</span>
          </p>
        </div>
      </div>
    </section>
  );
}

/** Preview completo con el tema sin guardar. */
export async function ThemePreview({ storeId, theme, device }: { storeId: string; theme: Theme; device: PreviewDevice }) {
  const [ctx, settings, menus, home] = await Promise.all([
    previewContext(storeId, device, theme),
    getSettings(storeId),
    getMenus(storeId),
    getPublishedPage(storeId, "home"),
  ]);
  const blocks = [heroFrom(home?.blocks), SLIDER, BANNERS];
  ctx.data = await resolveBlockData(storeId, blocks, ctx.promotions);
  return (
    <>
      <PreviewHeader theme={theme} settings={settings} menu={menus.header} />
      {blocks.map((b, i) => {
        const node = renderBlock(b, ctx, i);
        return node ? (
          <BlockSection key={b.id} block={b}>
            {node}
          </BlockSection>
        ) : null;
      })}
      <Showcase theme={theme} transferPercent={ctx.transferPercent} />
      <PreviewFooter theme={theme} settings={settings} menu={menus.footer} />
    </>
  );
}

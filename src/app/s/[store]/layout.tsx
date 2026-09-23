import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StoreAnalytics } from "@/components/store/Analytics";
import { CartDrawer } from "@/components/store/CartDrawer";
import { StoreFooter } from "@/components/store/Footer";
import { StoreHeader } from "@/components/store/Header";
import { MaintenanceGate } from "@/components/store/MaintenanceGate";
import { StoreBaseProvider } from "@/components/store/StoreBase";
import { WhatsAppFab } from "@/components/store/WhatsAppFab";
import { NavigationProgress } from "@/components/ui/NavigationProgress";
import { getProfile, listMyStores } from "@/lib/auth";
import ConfigureMoney from "@/components/store/ConfigureMoney";
import { CartProvider } from "@/lib/cart";
import { getStoreDisplay } from "@/lib/store/display";
import { getMenus } from "@/lib/store/menus";
import { getPublishedPage } from "@/lib/store/pages";
import { absoluteUrl } from "@/lib/store/seo";
import { getTenant } from "@/lib/tenant/resolve";
import { platformUrl } from "@/lib/tenant/urls";
import { cssVars, isDarkTheme, themeFontsHref } from "@/lib/theme";

import "./store.css";

// Todas las páginas del storefront son dinámicas; las lecturas se cachean
// con `unstable_cache` + tags por tienda (spec §6, §14.2).
export const dynamic = "force-dynamic";

/*
 * Storefront multi-tienda: `params.store` es siempre el slug (en subdominio
 * o dominio propio el proxy reescribe `/…` → `/s/<slug>/…`). Si la tienda no
 * existe o no está activa → `notFound()`, que resuelve `src/app/s/not-found.tsx`
 * ("Esta tienda no existe"): el 404 de ESTE segmento vive dentro de este
 * layout y necesita una tienda.
 */

export async function generateMetadata({ params }: LayoutProps<"/s/[store]">): Promise<Metadata> {
  const { store: slug } = await params;
  const { store } = await getTenant(slug);
  if (!store) return { title: "Esta tienda no existe", robots: { index: false } };
  const { settings } = await getStoreDisplay(store.id);
  const title = settings.seo.title || settings.name;
  const description = settings.seo.description || settings.tagline || undefined;
  return {
    title: { default: title, template: `%s · ${settings.name}` },
    description,
    applicationName: settings.name,
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
    openGraph: {
      siteName: settings.name,
      locale: "es_AR",
      type: "website",
      title,
      description,
      url: absoluteUrl(store, "/"),
      images: settings.seo.og_image_url ? [settings.seo.og_image_url] : undefined,
    },
    twitter: { card: settings.seo.og_image_url ? "summary_large_image" : "summary" },
    verification: settings.integrations.google_site_verification
      ? { google: settings.integrations.google_site_verification }
      : undefined,
  };
}

/**
 * ¿Alguien del equipo de ESTA tienda (o un superadmin) está viéndola? Sólo
 * se consulta si hace falta (mantenimiento).
 */
async function isAdminViewer(storeId: string): Promise<boolean> {
  try {
    const mine = await listMyStores();
    if (mine.some((s) => s.id === storeId && s.is_active)) return true;
    return Boolean((await getProfile())?.is_platform_admin);
  } catch {
    return false;
  }
}

export default async function StoreLayout({ children, params }: LayoutProps<"/s/[store]">) {
  const { store: slug } = await params;
  const tenant = await getTenant(slug);
  const store = tenant.store;
  if (!store) notFound();

  const [display, menus, home] = await Promise.all([
    getStoreDisplay(store.id),
    getMenus(store.id),
    getPublishedPage(store.id, "home"),
  ]);
  const { settings, paymentMethods, zones, pickups, promotions } = display;
  const { theme } = settings;
  const fontsHref = themeFontsHref(theme);
  const dark = isDarkTheme(theme);

  const firstBlock = home?.blocks.find((b) => !b.style.hidden);
  const homeStartsWithHero = firstBlock?.type === "hero" && Boolean(firstBlock.settings.imageUrl);

  const maintenance = settings.maintenance.enabled;
  const adminBypass = maintenance ? await isAdminViewer(store.id) : false;
  const wa = settings.whatsapp_button;

  return (
    <>
      {fontsHref ? (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={fontsHref} precedence="default" />
        </>
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: cssVars(theme) }} />
      <div
        className="store-root flex min-h-dvh flex-col"
        data-btn={theme.buttons.style}
        data-btn-upper={theme.buttons.uppercase ? "1" : undefined}
        data-dark={dark ? "1" : undefined}
        data-glow={dark && theme.effects.shadows !== "none" ? "1" : undefined}
        data-shadows={theme.effects.shadows}
      >
        <NavigationProgress color="var(--primary)" />
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        <ConfigureMoney currency={settings.currency} />
        <StoreBaseProvider basePath={tenant.basePath} storeId={store.id} slug={store.slug}>
          <CartProvider storeId={store.id} slug={store.slug}>
            {maintenance && adminBypass ? (
              <div className="bg-fg px-4 py-2 text-center text-xs text-bg" role="status">
                Modo mantenimiento activo: la tienda está cerrada al público. Vos la ves porque iniciaste sesión como admin.{" "}
                <a href={platformUrl("/admin")} className="underline underline-offset-2">
                  Ir al panel
                </a>
              </div>
            ) : null}
            <StoreHeader settings={settings} menu={menus.header} homeStartsWithHero={homeStartsWithHero} />
            <main id="contenido" className="flex-1" tabIndex={-1}>
              {maintenance && !adminBypass ? (
                <MaintenanceGate storeName={settings.name} message={settings.maintenance.message}>
                  {children}
                </MaintenanceGate>
              ) : (
                children
              )}
            </main>
            <StoreFooter
              settings={settings}
              menu={menus.footer}
              paymentMethods={paymentMethods}
              zones={zones}
              hasPickup={pickups.length > 0}
            />
            <CartDrawer
              promotions={promotions}
              freeShippingThreshold={display.freeShippingThreshold}
              freeShippingPartial={display.freeShippingPartial}
              minOrderTotal={settings.checkout.min_order_total}
              net={settings.tax.show_net_price ? { defaultVat: settings.tax.default_vat_percent, label: settings.tax.label } : null}
            />
            {wa.enabled && settings.whatsapp_phone ? (
              <WhatsAppFab
                phone={settings.whatsapp_phone}
                template={wa.message_template}
                position={wa.position}
                showOnMobile={wa.show_on_mobile}
                showOnDesktop={wa.show_on_desktop}
              />
            ) : null}
          </CartProvider>
        </StoreBaseProvider>
      </div>
      <StoreAnalytics integrations={settings.integrations} />
    </>
  );
}

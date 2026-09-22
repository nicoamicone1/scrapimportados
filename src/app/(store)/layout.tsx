import type { Metadata } from "next";

import { StoreAnalytics } from "@/components/store/Analytics";
import { CartDrawer } from "@/components/store/CartDrawer";
import { StoreFooter } from "@/components/store/Footer";
import { StoreHeader } from "@/components/store/Header";
import { MaintenanceGate } from "@/components/store/MaintenanceGate";
import { WhatsAppFab } from "@/components/store/WhatsAppFab";
import { getProfile, isAdminRole } from "@/lib/auth";
import ConfigureMoney from "@/components/store/ConfigureMoney";
import { CartProvider } from "@/lib/cart";
import { getStoreDisplay } from "@/lib/store/display";
import { getMenus } from "@/lib/store/menus";
import { getPublishedPage } from "@/lib/store/pages";
import { absoluteUrl } from "@/lib/store/seo";
import { cssVars, isDarkTheme, themeFontsHref } from "@/lib/theme";

import "./store.css";

// Todas las páginas del storefront son dinámicas; las lecturas se cachean
// con `unstable_cache` + tags (spec §6).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getStoreDisplay();
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
      url: absoluteUrl("/"),
      images: settings.seo.og_image_url ? [settings.seo.og_image_url] : undefined,
    },
    twitter: { card: settings.seo.og_image_url ? "summary_large_image" : "summary" },
    verification: settings.integrations.google_site_verification
      ? { google: settings.integrations.google_site_verification }
      : undefined,
  };
}

/** ¿El admin está viendo la tienda? (sólo se consulta si hace falta: mantenimiento). */
async function isAdminViewer(): Promise<boolean> {
  try {
    const profile = await getProfile();
    return Boolean(profile?.is_active && isAdminRole(profile.role));
  } catch {
    return false;
  }
}

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const [display, menus, home] = await Promise.all([getStoreDisplay(), getMenus(), getPublishedPage("home")]);
  const { settings, paymentMethods, zones, pickups, promotions } = display;
  const { theme } = settings;
  const fontsHref = themeFontsHref(theme);
  const dark = isDarkTheme(theme);

  const firstBlock = home?.blocks.find((b) => !b.style.hidden);
  const homeStartsWithHero = firstBlock?.type === "hero" && Boolean(firstBlock.settings.imageUrl);

  const maintenance = settings.maintenance.enabled;
  const adminBypass = maintenance ? await isAdminViewer() : false;
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
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        <ConfigureMoney currency={settings.currency} />
        <CartProvider>
          {maintenance && adminBypass ? (
            <div className="bg-fg px-4 py-2 text-center text-xs text-bg" role="status">
              Modo mantenimiento activo: la tienda está cerrada al público. Vos la ves porque iniciaste sesión como admin.
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
      </div>
      <StoreAnalytics integrations={settings.integrations} />
    </>
  );
}

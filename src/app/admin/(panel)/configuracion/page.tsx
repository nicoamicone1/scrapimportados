import { AlertTriangle, ChevronRight, CreditCard, Download, Palette, Scale, Search, Store, Truck, Users, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/display";
import { getAdminSettings, getSchemaStatus, listPaymentMethodsAdmin } from "@/lib/admin/settings";
import { formatPercent } from "@/lib/money";

export const metadata: Metadata = { title: "Configuración" };

interface Row {
  href: string;
  title: string;
  description: string;
  status?: string;
  icon: LucideIcon;
  warn?: boolean;
}

function SettingsList({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-2 text-xs font-medium tracking-[0.06em] text-adm-fg-muted uppercase">{title}</h2>
      <Card>
        <ul className="divide-y divide-adm-border">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.href}>
                <Link href={r.href} className="flex items-center gap-3 px-4 py-3 hover:bg-adm-hover">
                  <Icon className="size-4 shrink-0 text-adm-fg-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-adm-fg">{r.title}</div>
                    <div className="text-[13px] text-adm-fg-muted">{r.description}</div>
                  </div>
                  {r.status ? (
                    <span className={r.warn ? "hidden text-[13px] font-medium text-adm-danger sm:block" : "hidden max-w-[40%] truncate text-[13px] text-adm-fg-muted sm:block"}>
                      {r.status}
                    </span>
                  ) : null}
                  <ChevronRight className="size-4 shrink-0 text-adm-fg-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}

export default async function ConfiguracionPage() {
  const [settings, methods, schema] = await Promise.all([getAdminSettings(), listPaymentMethodsAdmin(), getSchemaStatus()]);

  const activeMethods = methods.filter((m) => m.is_active);
  const paymentsStatus = activeMethods.length
    ? activeMethods.map((m) => (m.discount_percent > 0 ? `${m.name} ${formatPercent(m.discount_percent)} off` : m.name)).join(" · ")
    : "Sin métodos activos";
  const policiesDone = Object.values(settings.policies).filter((p) => p && p.trim()).length;
  const integrations = [
    settings.integrations.ga4_id && "GA4",
    settings.integrations.gtm_id && "GTM",
    settings.integrations.meta_pixel_id && "Pixel",
  ].filter(Boolean);

  return (
    <>
      <PageHeader title="Configuración" description={`${settings.name} · ${settings.currency} · ${settings.timezone.replace(/_/g, " ")}`} />

      {schema.outdated ? (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-adm border border-adm-danger/40 bg-adm-danger-soft px-4 py-3 text-sm text-adm-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Base de datos desactualizada: aplicá las migraciones.</p>
            <p className="mt-0.5 text-[13px]">
              Esta versión de Ecommy espera el esquema {schema.expected} y la base está en el {schema.current ?? "desconocido"}. Aplicá los archivos de
              <code className="mx-1 font-mono text-xs">supabase/migrations/</code>que falten, en orden.
            </p>
          </div>
        </div>
      ) : null}

      {settings.maintenance.enabled ? (
        <div role="alert" className="mb-5 flex items-center gap-3 rounded-adm border border-adm-danger/40 bg-adm-danger-soft px-4 py-3 text-sm text-adm-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <p className="flex-1">
            <span className="font-medium">La tienda está en mantenimiento.</span> Los visitantes no pueden comprar.
          </p>
          <Link href="/admin/configuracion/seo#mantenimiento" className="text-[13px] font-medium underline underline-offset-2">
            Desactivar
          </Link>
        </div>
      ) : null}

      <div className="max-w-3xl">
        <SettingsList
          title="General"
          rows={[
            {
              href: "/admin/configuracion/tienda",
              title: "Tienda",
              description: "Nombre, contacto, WhatsApp, moneda, zona horaria y redes.",
              status: settings.whatsapp_phone ? `WhatsApp +${settings.whatsapp_phone}` : "Falta el WhatsApp",
              warn: !settings.whatsapp_phone,
              icon: Store,
            },
            {
              href: "/admin/configuracion/pagos",
              title: "Pagos y checkout",
              description: "Métodos de pago, datos bancarios, reserva de stock y reglas del checkout.",
              status: paymentsStatus,
              warn: !activeMethods.length,
              icon: CreditCard,
            },
            {
              href: "/admin/configuracion/legales",
              title: "Impuestos y legales",
              description: "Precio sin impuestos, CUIT, Data Fiscal, Defensa del Consumidor y políticas.",
              status: `${policiesDone} de 4 políticas`,
              warn: policiesDone < 4,
              icon: Scale,
            },
            {
              href: "/admin/configuracion/seo",
              title: "SEO e integraciones",
              description: "Título y descripción de la tienda, Analytics, Pixel, mantenimiento y redirecciones.",
              status: settings.maintenance.enabled ? "En mantenimiento" : integrations.length ? integrations.join(" · ") : undefined,
              warn: settings.maintenance.enabled,
              icon: Search,
            },
          ]}
        />
        <SettingsList
          title="Datos"
          rows={[
            {
              href: "/admin/configuracion/exportar",
              title: "Exportar",
              description: "Productos, inventario, pedidos y clientes en CSV.",
              icon: Download,
            },
          ]}
        />
        <SettingsList
          title="En otras secciones"
          rows={[
            { href: "/admin/apariencia", title: "Apariencia", description: "Logo, favicon, colores y tipografías.", icon: Palette },
            { href: "/admin/envios", title: "Envíos y retiro", description: "Zonas, costos, envío gratis y puntos de retiro.", icon: Truck },
            { href: "/admin/usuarios", title: "Usuarios", description: "Tu equipo, roles y cuentas por aprobar.", icon: Users },
          ]}
        />
      </div>
    </>
  );
}

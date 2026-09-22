import Link from "next/link";

import { cn } from "@/lib/cn";
import type { MenuItem } from "@/lib/store/menus";
import type { StorePaymentMethod } from "@/lib/store/payment-methods";
import type { StoreSettings } from "@/lib/store/settings";
import { CONSUMER_DEFENSE_URL, POLICY_LINKS } from "@/lib/store/policies";
import type { StoreShippingZone } from "@/lib/store/shipping";
import { waLink } from "@/lib/store/whatsapp";
import { APP_NAME } from "@/lib/version";

const SOCIAL_LABELS = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", x: "X", youtube: "YouTube" } as const;

/** "5493816173548" → "+54 9 381 617-3548" (aprox.; sólo para mostrar). */
function prettyPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  const m = /^54(9)?(\d{2,4})(\d{3,4})(\d{4})$/.exec(d);
  return m ? `+54 ${m[1] ? "9 " : ""}${m[2]} ${m[3]}-${m[4]}` : `+${d}`;
}

interface FooterProps {
  settings: StoreSettings;
  menu: MenuItem[];
  paymentMethods: StorePaymentMethod[];
  zones: StoreShippingZone[];
  hasPickup: boolean;
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = /^https?:\/\//.test(href);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-fg-muted hover:text-fg">
      {children}
    </a>
  ) : (
    <Link href={href} className="text-fg-muted hover:text-fg">
      {children}
    </Link>
  );
}

/** Bloque legal obligatorio en Argentina (P0-14, P0-16) + políticas. Va en los 3 estilos. */
function LegalBand({ settings, year }: { settings: StoreSettings; year: number }) {
  const { legal } = settings;
  const policies = POLICY_LINKS.filter((p) => settings.policies[p.key]);
  return (
    <div className="border-t border-border">
      <div className="store-container flex flex-col gap-4 py-5 text-xs text-fg-muted lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            <li>
              <Link href="/arrepentimiento" className="font-medium text-fg underline underline-offset-2">
                Botón de arrepentimiento
              </Link>
            </li>
            {policies.map((p) => (
              <li key={p.key}>
                <FooterLink href={`/politicas/${p.slug}`}>{p.label}</FooterLink>
              </li>
            ))}
          </ul>
          {legal.country === "AR" && legal.consumer_defense_link ? (
            <p>
              Defensa de las y los consumidores. Para reclamos{" "}
              <a href={CONSUMER_DEFENSE_URL} target="_blank" rel="noopener noreferrer" className="text-fg underline underline-offset-2">
                ingresá acá
              </a>
              .
            </p>
          ) : null}
          <p>
            © {year} {legal.razon_social || settings.name}
            {legal.cuit ? ` · CUIT ${legal.cuit}` : ""}
            {" · "}
            <span>Hecho con {APP_NAME}</span>
          </p>
        </div>
        {legal.data_fiscal.image_url ? (
          <a
            href={legal.data_fiscal.href || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-fit shrink-0"
            aria-label="Data Fiscal (ARCA)"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- imagen de ARCA en un dominio arbitrario */}
            <img src={legal.data_fiscal.image_url} alt="Data Fiscal" width={48} height={66} className="h-16 w-auto" loading="lazy" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Contact({ settings }: { settings: StoreSettings }) {
  return (
    <ul className="space-y-1.5">
      {settings.whatsapp_phone ? (
        <li>
          <FooterLink href={waLink(settings.whatsapp_phone)}>WhatsApp {prettyPhone(settings.whatsapp_phone)}</FooterLink>
        </li>
      ) : null}
      {settings.contact_email ? (
        <li>
          <FooterLink href={`mailto:${settings.contact_email}`}>{settings.contact_email}</FooterLink>
        </li>
      ) : null}
      {settings.contact_phone && settings.contact_phone !== settings.whatsapp_phone ? (
        <li>
          <FooterLink href={`tel:${settings.contact_phone.replace(/[^\d+]/g, "")}`}>{settings.contact_phone}</FooterLink>
        </li>
      ) : null}
      {settings.address ? <li className="text-fg-muted">{settings.address}</li> : null}
    </ul>
  );
}

function Social({ settings, className }: { settings: StoreSettings; className?: string }) {
  const social = (Object.entries(settings.social) as [keyof typeof SOCIAL_LABELS, string][]).filter(([k, url]) => url && k in SOCIAL_LABELS);
  if (!settings.theme.footer.showSocial || !social.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1", className)}>
      {social.map(([key, url]) => (
        <li key={key}>
          <FooterLink href={url}>{SOCIAL_LABELS[key]}</FooterLink>
        </li>
      ))}
    </ul>
  );
}

function paymentsText(methods: StorePaymentMethod[]): string[] {
  return methods.map((m) =>
    m.type === "whatsapp" ? "Acordás con el vendedor por WhatsApp" : m.discountPercent > 0 ? `${m.name} (${m.discountPercent} % off)` : m.name,
  );
}

function shippingText(zones: StoreShippingZone[], hasPickup: boolean): string[] {
  const out: string[] = [];
  if (zones.some((z) => z.type === "everywhere")) out.push("Envíos a todo el país");
  else if (zones.length) out.push(`Envíos a ${zones.slice(0, 3).map((z) => z.name).join(", ")}${zones.length > 3 ? " y más" : ""}`);
  if (hasPickup) out.push("Retirás en el local sin cargo");
  return out;
}

/** Footer temable (DESIGN.md §6.7): `simple`, `columns` o `minimal`. */
export function StoreFooter({ settings, menu, paymentMethods, zones, hasPickup }: FooterProps) {
  const year = new Date().getFullYear();
  const style = settings.theme.footer.style;
  const groups = menu.filter((g) => g.children.length);
  const flatLinks = menu.flatMap((g) => (g.children.length ? g.children : [g])).filter((l, i, all) => all.findIndex((x) => x.href === l.href && x.label === l.label) === i);
  const effective = style === "columns" && groups.length < 2 ? "simple" : style;
  const showPayments = settings.theme.footer.showPayments && paymentMethods.length > 0;
  const ship = shippingText(zones, hasPickup);

  if (effective === "minimal") {
    const terms = settings.policies.terms_md;
    const privacy = settings.policies.privacy_md;
    return (
      <footer className="mt-[var(--space-section-md)] border-t border-border bg-bg text-sm">
        <div className="store-container flex flex-wrap items-center gap-x-3 gap-y-1 py-5 text-fg-muted">
          <span className="text-fg">{settings.name}</span>
          {terms ? <FooterLink href="/politicas/terminos">Términos</FooterLink> : null}
          {privacy ? <FooterLink href="/politicas/privacidad">Privacidad</FooterLink> : null}
          <Social settings={settings} />
          {settings.whatsapp_phone ? <FooterLink href={waLink(settings.whatsapp_phone)}>WhatsApp</FooterLink> : null}
        </div>
        <LegalBand settings={settings} year={year} />
      </footer>
    );
  }

  if (effective === "simple") {
    const editorial = settings.theme.preset === "editorial";
    return (
      <footer className="mt-[var(--space-section-md)] border-t border-border bg-bg text-sm">
        <div className="store-container flex flex-col gap-6 py-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={cn("heading leading-none", editorial ? "text-display" : "h-section")}>{settings.name}</p>
            {settings.tagline ? <p className="mt-2 max-w-[48ch] text-fg-muted">{settings.tagline}</p> : null}
          </div>
          {flatLinks.length ? (
            <nav aria-label="Pie de página">
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {flatLinks.map((l) => (
                  <li key={`${l.label}-${l.href}`}>
                    <FooterLink href={l.href}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
        <div className="store-container grid gap-6 border-t border-border py-6 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Contact settings={settings} />
          </div>
          <div className="space-y-3 lg:col-span-4">
            <Social settings={settings} />
            {showPayments ? <p className="text-fg-muted">{paymentsText(paymentMethods).join(" · ")}</p> : null}
          </div>
          {ship.length ? <p className="text-fg-muted lg:col-span-3">{ship.join(" · ")}</p> : null}
        </div>
        <LegalBand settings={settings} year={year} />
      </footer>
    );
  }

  // columns: 5 · 2 · 2 · 3 (anchos desiguales, sólo grupos con links reales)
  return (
    <footer className="mt-[var(--space-section-md)] border-t border-border bg-bg text-sm">
      <div className="store-container grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
        <div className="sm:col-span-2 lg:col-span-5 lg:pr-8">
          <p className="heading text-xl leading-tight">{settings.name}</p>
          {settings.tagline ? <p className="mt-1.5 max-w-[48ch] text-fg-muted">{settings.tagline}</p> : null}
          <div className="mt-4">
            <Contact settings={settings} />
          </div>
          <Social settings={settings} className="mt-4" />
        </div>
        {groups.slice(0, 2).map((group) => (
          <nav key={group.label} aria-label={group.label} className="lg:col-span-2">
            <p className="font-medium">{group.label}</p>
            <ul className="mt-3 space-y-2">
              {group.children.map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <FooterLink href={link.href}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        {showPayments || ship.length ? (
          <div className="space-y-5 lg:col-span-3">
            {showPayments ? (
              <div>
                <p className="font-medium">Medios de pago</p>
                <ul className="mt-3 space-y-1.5 text-fg-muted">
                  {paymentsText(paymentMethods).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {ship.length ? (
              <div>
                <p className="font-medium">Envíos</p>
                <ul className="mt-3 space-y-1.5 text-fg-muted">
                  {ship.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <LegalBand settings={settings} year={year} />
    </footer>
  );
}

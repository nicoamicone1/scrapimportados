import { ExternalLink, Share2 } from "lucide-react";

import { PresetThumb, presetFontsHref } from "@/components/admin/appearance/PresetThumb";
import { ButtonLink } from "@/components/ui/Button";
import { PRESET_LIST, type Theme } from "@/lib/theme";

import { CopyStoreHost } from "./OnboardingActions";

/**
 * "Tu tienda": la miniatura fiel del tema que está publicado (la misma de
 * Apariencia, con el nombre y los productos reales de la tienda) sobre un
 * arco durazno, el link copiable y las dos salidas: verla y compartirla. Es
 * el recordatorio de que el negocio está online (BRAND §8: el producto real
 * es la ilustración).
 */
export function StoreCard({
  theme,
  name,
  tagline,
  products,
  url,
  host,
  href,
  markShared,
  online = true,
}: {
  theme: Theme;
  name: string;
  tagline: string | null;
  /** Nombres de productos activos para las tarjetas de la miniatura. */
  products: string[];
  url: string;
  host: string;
  href: string;
  markShared: boolean;
  /** `stores.status === "active"`: si no, la tienda no atiende al público. */
  online?: boolean;
}) {
  const meta = PRESET_LIST.find((p) => p.id === theme.preset);
  const fonts = presetFontsHref([theme]);
  const styleName = theme.preset === "custom" ? "Estilo personalizado" : `Estilo ${meta?.name ?? theme.preset}`;

  return (
    <section aria-labelledby="tu-tienda" className="overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface shadow-adm-card">
      {fonts ? <link rel="stylesheet" href={fonts} precedence="default" /> : null}
      <div className="relative isolate overflow-hidden bg-eco-niebla-2 px-5 pt-5">
        {/* El arco detrás de la captura (BRAND §7.2): nítido, nunca difuminado. */}
        <svg aria-hidden viewBox="0 0 200 200" className="absolute -top-16 -right-14 -z-10 size-56 text-eco-durazno">
          <circle cx="100" cy="100" r="78" fill="none" stroke="currentColor" strokeWidth="34" />
        </svg>
        <div className="flex items-center justify-between gap-3 pb-3">
          <h2 id="tu-tienda" className="text-[15px] font-semibold text-adm-fg">
            Tu tienda
          </h2>
          <span
            className={`inline-flex h-6 items-center gap-1.5 rounded-full bg-adm-surface px-2.5 text-xs font-medium shadow-adm-card ${online ? "text-adm-success" : "text-adm-fg-muted"}`}
          >
            <span aria-hidden className="size-2 rounded-full bg-current ring-[3px] ring-current/20" />
            {online ? "Online" : "No publicada"}
          </span>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="dsh-lift eco-bubble group block overflow-hidden border border-adm-border bg-adm-surface shadow-[0_18px_40px_-22px_rgb(16_22_47/0.45)] [--eco-bubble-r:18px]"
          style={{ borderEndStartRadius: 0, borderEndEndRadius: 0 }}
          aria-label={`Abrir ${name} en una pestaña nueva`}
        >
          <PresetThumb theme={theme} brand={name} headline={tagline || meta?.mood || name} labels={products.length ? products : meta?.industries} />
        </a>
      </div>
      <div className="space-y-3 border-t border-adm-border p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-semibold text-adm-fg">{name}</p>
          <p className="shrink-0 text-xs text-adm-fg-muted">{styleName}</p>
        </div>
        <CopyStoreHost url={url} host={host} markShared={markShared} />
        <div className="grid grid-cols-2 gap-2">
          <ButtonLink href={href} external icon={<ExternalLink />} className="w-full">
            Ver tienda
          </ButtonLink>
          <ButtonLink href="/admin/compartir" icon={<Share2 />} className="w-full">
            Compartir
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

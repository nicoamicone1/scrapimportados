import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { Quoter } from "@/components/store/print3d/Quoter";
import { requireStore } from "@/lib/store/context";
import { getStoreDisplay } from "@/lib/store/display";
import { markdownToHtml } from "@/lib/store/markdown";
import { storeHasModule } from "@/lib/store/modules";
import { getPrint3dConfig } from "@/lib/store/print3d";
import { buildMetadata } from "@/lib/store/seo";
import { waLink } from "@/lib/store/whatsapp";

type Props = PageProps<"/s/[store]/impresion-3d">;

const DEFAULT_INTRO = "Subí el STL o 3MF, elegí material, color y relleno, y ves el precio y la fecha de entrega al instante.";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store } = await requireStore(params);
  const { settings } = await getStoreDisplay(store.id);
  return buildMetadata({
    store,
    title: "Impresión 3D a pedido",
    description: `Cotizá tu pieza en ${settings.name}: subí el STL o 3MF y ves gramos, horas, precio y fecha al instante.`,
    path: "/impresion-3d",
    siteName: settings.name,
  });
}

/** Cotizador de impresión 3D (Taller 3D, spec TALLER-3D §4). */
export default async function Print3dQuoterPage({ params }: Props) {
  const { store, basePath } = await requireStore(params);
  const [active, config, display] = await Promise.all([
    storeHasModule(store.id, "print3d"),
    getPrint3dConfig(store.id),
    getStoreDisplay(store.id),
  ]);
  if (!active || !config) notFound();
  const { settings } = display;
  const phone = settings.whatsapp_phone ?? "";
  const intro = markdownToHtml(config.settings.intro_md, basePath);
  const usable = config.materials.some((m) => m.colors.length) && config.qualities.length > 0;

  return (
    <div className="store-container py-[var(--space-section-sm)]">
      <div className="mb-4">
        <Breadcrumbs items={[{ name: "Inicio", href: "/" }, { name: "Impresión 3D" }]} />
      </div>
      <header className="mb-6 max-w-2xl lg:mb-8">
        <p className="eyebrow">Impresión 3D a pedido</p>
        <h1 className="h-page mt-1.5">Cotizá tu pieza</h1>
        {intro ? (
          <div className="prose-store mt-3 text-fg-muted" dangerouslySetInnerHTML={{ __html: intro }} />
        ) : (
          <p className="mt-3 text-fg-muted">{DEFAULT_INTRO}</p>
        )}
      </header>

      {usable ? (
        <Quoter config={config} whatsappPhone={phone} storeName={settings.name} />
      ) : (
        <div className="max-w-xl rounded-lg border border-border p-5">
          <p className="font-medium">Estamos cargando los materiales del taller.</p>
          <p className="mt-1 text-sm text-fg-muted">Mientras tanto, mandanos el archivo y te pasamos el precio a mano.</p>
          {phone ? (
            <a
              className="btn btn-solid mt-4"
              href={waLink(phone, "Hola. Quiero cotizar una impresión 3D, te mando el archivo.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              Escribir por WhatsApp
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}

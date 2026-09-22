import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { BrandEditor } from "@/components/admin/appearance/BrandEditor";
import { ThemeEditor } from "@/components/admin/appearance/ThemeEditor";
import { ThemePreview } from "@/components/admin/appearance/ThemePreview";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { TabsNav } from "@/components/ui/Tabs";
import { getAppearanceData } from "@/lib/admin/appearance";

export const metadata: Metadata = { title: "Apariencia" };

export default async function AppearancePage({ searchParams }: PageProps<"/admin/apariencia">) {
  const { tab } = await searchParams;
  const brandTab = tab === "marca";
  const data = await getAppearanceData();

  return (
    <>
      <PageHeader
        title="Apariencia"
        description={brandTab ? "Logo, nombre y barra de anuncio." : "Colores, tipografías, botones y tarjetas. Los cambios se ven en la vista previa y se publican al guardar."}
        actions={
          <ButtonLink href="/" external icon={<ExternalLink />}>
            Ver la tienda
          </ButtonLink>
        }
      >
        <TabsNav
          label="Secciones de apariencia"
          items={[
            { href: "/admin/apariencia", label: "Tema", active: !brandTab },
            { href: "/admin/apariencia?tab=marca", label: "Marca y anuncio", active: brandTab },
          ]}
        />
      </PageHeader>
      {data.themeWasInvalid && !brandTab ? (
        <p className="mb-4 rounded-adm border border-[#E9D5A8] bg-[#FBF3E2] px-3 py-2 text-[13px] text-[#7A4A00]">
          El tema guardado tenía valores que no reconocemos: los completamos con los del preset. Guardá para dejarlo prolijo.
        </p>
      ) : null}
      {brandTab ? (
        <BrandEditor data={data} />
      ) : (
        <ThemeEditor initialTheme={data.theme} initialNode={<ThemePreview theme={data.theme} device="desktop" />} />
      )}
    </>
  );
}

import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { MenuEditor } from "@/components/admin/menus/MenuEditor";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { getAdminMenus } from "@/lib/admin/menus";
import { listCategoryOptions, listPageOptions } from "@/lib/admin/pages";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Menús" };

export default async function MenusPage() {
  const ctx = await requireAdmin();
  const [menus, categories, pages] = await Promise.all([getAdminMenus(), listCategoryOptions(ctx), listPageOptions(ctx)]);
  const options = { categories, pages };
  return (
    <>
      <PageHeader
        title="Menús"
        description="Links del encabezado y del pie de la tienda. Arrastrá para ordenar; usá la sangría para armar subítems."
        actions={
          <ButtonLink href="/" external icon={<ExternalLink />}>
            Ver la tienda
          </ButtonLink>
        }
      />
      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <MenuEditor handle="header" initialItems={menus.header.items} options={options} />
        <MenuEditor handle="footer" initialItems={menus.footer.items} options={options} />
      </div>
    </>
  );
}

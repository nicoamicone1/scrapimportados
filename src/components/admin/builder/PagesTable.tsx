"use client";

import { Copy, ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deletePage, duplicatePage } from "@/app/admin/(panel)/paginas/actions";
import { useAdminStore } from "@/components/admin/AdminStoreContext";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { toast } from "@/components/ui";
import { withPendingToast } from "@/components/ui/feedback";
import type { AdminPageListItem } from "@/lib/admin/pages";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { PAGE_TYPE_LABELS } from "@/lib/schemas/page";

export function PagesTable({ pages, filtered }: { pages: AdminPageListItem[]; filtered: boolean }) {
  const router = useRouter();
  const { store } = useAdminStore();
  const [toDelete, setToDelete] = useState<AdminPageListItem | null>(null);
  /** Link a la página en la tienda activa (`/s/<slug>/…` en modo fallback, absoluto con subdominio). */
  const storeLink = (path: string) => (path === "/" ? store.href : `${store.href.replace(/\/+$/, "")}${path}`);

  const duplicate = async (p: AdminPageListItem) => {
    const r = await duplicatePage(p.id);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Página duplicada como borrador");
    router.push(`/admin/paginas/${r.data.id}`);
  };

  return (
    <>
      <Table>
        <THead>
          <tr>
            <TH>Título</TH>
            <TH>Dirección</TH>
            <TH>Tipo</TH>
            <TH>Estado</TH>
            <TH numeric>Bloques</TH>
            <TH>Actualizada</TH>
            <TH className="w-10">
              <span className="sr-only">Acciones</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {pages.length === 0 ? (
            <TableEmpty
              colSpan={7}
              title={filtered ? "No hay páginas con estos filtros." : "Todavía no hay páginas"}
              description={filtered ? undefined : "Armá landings de campaña, «Sobre nosotros» o páginas legales con bloques."}
            />
          ) : null}
          {pages.map((p) => {
            const home = p.type === "home";
            const path = home ? "/" : `/${p.slug}`;
            return (
              <TR key={p.id}>
                <TD>
                  <Link href={`/admin/paginas/${p.id}`} className="font-medium text-adm-fg hover:underline">
                    {home ? "Portada" : p.title}
                  </Link>
                </TD>
                <TD>
                  {p.status === "published" ? (
                    <a href={storeLink(path)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-adm-fg-muted hover:text-adm-accent hover:underline">
                      {path}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-adm-fg-muted">{path}</span>
                  )}
                </TD>
                <TD muted>{PAGE_TYPE_LABELS[p.type]}</TD>
                <TD>
                  <StatusBadge kind="page" value={p.status} />
                </TD>
                <TD numeric>{p.blockCount}</TD>
                <TD muted>
                  <time dateTime={p.updatedAt} title={formatDateTime(p.updatedAt)} suppressHydrationWarning>
                    {formatRelative(p.updatedAt)}
                  </time>
                </TD>
                <TD className="text-right">
                  <DropdownMenu
                    trigger={
                      <Button size="icon-sm" variant="ghost" aria-label={`Acciones de ${p.title}`}>
                        <MoreHorizontal />
                      </Button>
                    }
                  >
                    <DropdownItem icon={<Pencil />} href={`/admin/paginas/${p.id}`}>
                      Editar
                    </DropdownItem>
                    <DropdownItem icon={<Copy />} onSelect={() => void withPendingToast("Duplicando página…", () => duplicate(p))}>
                      Duplicar
                    </DropdownItem>
                    {p.status === "published" ? (
                      <DropdownItem icon={<ExternalLink />} onSelect={() => window.open(storeLink(path), "_blank", "noopener")}>
                        Ver en la tienda
                      </DropdownItem>
                    ) : null}
                    {!home ? (
                      <>
                        <DropdownSeparator />
                        <DropdownItem icon={<Trash2 />} danger onSelect={() => setToDelete(p)}>
                          Borrar
                        </DropdownItem>
                      </>
                    ) : null}
                  </DropdownMenu>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`¿Borrar «${toDelete?.title ?? ""}»?`}
        description={toDelete?.status === "published" ? `/${toDelete.slug} deja de existir y los links que circulen van a dar error. Si sólo querés sacarla, despublicala.` : "No se puede deshacer."}
        confirmLabel="Borrar página"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          const r = await deletePage(toDelete.id);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Página borrada");
          router.refresh();
        }}
      />
    </>
  );
}

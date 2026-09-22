"use client";

import { ArrowRight, FileUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createRedirect,
  deleteRedirects,
  importRedirectsCsv,
  previewRedirectsCsv,
  type RedirectImportRow,
} from "@/app/admin/(panel)/configuracion/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Checkbox, Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import type { RedirectRow } from "@/lib/admin/settings";

export function RedirectsManager({
  rows,
  total,
  page,
  perPage,
  query,
}: {
  rows: RedirectRow[];
  total: number;
  page: number;
  perPage: number;
  query: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [adding, startAdding] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const add = () => {
    startAdding(async () => {
      const res = await createRedirect({ from_path: from, to_path: to });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      setFrom("");
      setTo("");
      toast.success("Redirección creada.");
      router.refresh();
    });
  };

  const remove = async (ids: string[]) => {
    const res = await deleteRedirects(ids);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.data.deleted === 1 ? "Redirección borrada." : `${res.data.deleted} redirecciones borradas.`);
    setSelected(new Set());
    router.refresh();
  };

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="max-w-5xl space-y-4">
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="grid items-start gap-3 md:grid-cols-[1fr_auto_1fr_auto]"
        >
          <Field label="Desde" hint="Ruta vieja, empieza con /. Ej. /producto/remera-vieja" error={errors.from_path}>
            <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="/ruta-vieja" className="font-mono text-[13px]" spellCheck={false} />
          </Field>
          <ArrowRight className="mt-8 hidden size-4 text-adm-fg-muted md:block" aria-hidden />
          <Field label="Hacia" hint="Ruta interna (/…) o URL completa (https://…)." error={errors.to_path}>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="/ruta-nueva" className="font-mono text-[13px]" spellCheck={false} />
          </Field>
          <Button type="submit" variant="primary" icon={<Plus />} loading={adding} className="md:mt-[22px]" disabled={!from.trim() || !to.trim()}>
            Agregar
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {selected.size ? (
          <div className="flex h-8 items-center gap-3 text-sm">
            <span className="font-medium">
              {selected.size} {selected.size === 1 ? "seleccionada" : "seleccionadas"}
            </span>
            <Button size="sm" variant="danger" icon={<Trash2 />} onClick={() => setConfirm([...selected])}>
              Borrar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Deseleccionar
            </Button>
          </div>
        ) : (
          <SearchInput placeholder="Buscar por ruta" aria-label="Buscar redirecciones" />
        )}
        <Button icon={<FileUp />} onClick={() => setImportOpen(true)}>
          Importar CSV
        </Button>
      </div>

      <div>
        <Table>
          <THead>
            <tr>
              <TH className="w-10">
                <Checkbox checked={allOnPage} onChange={toggleAll} aria-label="Seleccionar todas" disabled={!rows.length} />
              </TH>
              <TH>Desde</TH>
              <TH>Hacia</TH>
              <TH numeric>Visitas</TH>
              <TH>Creada</TH>
              <TH className="w-10">
                <span className="sr-only">Acciones</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TableEmpty
                colSpan={6}
                title={query ? "No hay redirecciones con esta búsqueda." : "Todavía no hay redirecciones"}
                description={
                  query
                    ? undefined
                    : "Cuando cambiás la URL de un producto o una categoría se crean solas. También podés cargarlas a mano o importar las de tu tienda anterior."
                }
              />
            ) : (
              rows.map((r) => (
                <TR key={r.id} selected={selected.has(r.id)}>
                  <TD>
                    <Checkbox checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Seleccionar ${r.from_path}`} />
                  </TD>
                  <TD className="max-w-[320px] truncate font-mono text-xs" title={r.from_path}>
                    {r.from_path}
                  </TD>
                  <TD className="max-w-[320px] truncate font-mono text-xs" title={r.to_path}>
                    {r.to_path}
                  </TD>
                  <TD numeric>{formatNumber(r.hits)}</TD>
                  <TD muted>
                    <time suppressHydrationWarning dateTime={r.created_at} title={formatDateTime(r.created_at)}>
                      {formatRelative(r.created_at)}
                    </time>
                  </TD>
                  <TD>
                    <button
                      type="button"
                      onClick={() => setConfirm([r.id])}
                      aria-label={`Borrar ${r.from_path}`}
                      className="inline-flex size-7 items-center justify-center rounded-adm text-adm-fg-muted opacity-0 group-hover/row:opacity-100 hover:bg-adm-surface-2 hover:text-adm-danger focus-visible:opacity-100"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
        {total > perPage ? <Pagination page={page} perPage={perPage} total={total} /> : null}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm && confirm.length > 1 ? `¿Borrar ${confirm.length} redirecciones?` : "¿Borrar la redirección?"}
        description="Los links viejos van a dar «página no encontrada». No se puede deshacer."
        confirmLabel={confirm && confirm.length > 1 ? `Borrar ${confirm.length} redirecciones` : "Borrar redirección"}
        destructive
        onConfirm={() => (confirm ? remove(confirm) : undefined)}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={() => router.refresh()} />
    </div>
  );
}

function ImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<{ rows: RedirectImportRow[]; truncated: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText("");
    setFileName("");
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const analyze = (content: string) => {
    startTransition(async () => {
      const res = await previewRedirectsCsv(content);
      if (!res.ok) {
        toast.error(res.error);
        setPreview(null);
        return;
      }
      setPreview(res.data);
    });
  };

  const apply = () => {
    startTransition(async () => {
      const res = await importRedirectsCsv(text);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${formatNumber(res.data.created)} redirecciones importadas${res.data.skipped ? ` · ${formatNumber(res.data.skipped)} omitidas` : ""}.`);
      reset();
      onOpenChange(false);
      onDone();
    });
  };

  const valid = preview?.rows.filter((r) => !r.error).length ?? 0;
  const invalid = (preview?.rows.length ?? 0) - valid;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      size="lg"
      title="Importar redirecciones"
      description="Un CSV con dos columnas: from,to (con o sin encabezado). Las rutas que ya existen o tienen errores se omiten."
      dismissable={!pending}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={apply} loading={pending && Boolean(preview)} disabled={!preview || valid === 0}>
            {valid ? `Importar ${formatNumber(valid)} ${valid === 1 ? "redirección" : "redirecciones"}` : "Importar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2_000_000) {
                toast.error("El archivo pesa más de 2 MB.");
                return;
              }
              const content = await file.text();
              setText(content);
              setFileName(file.name);
              analyze(content);
            }}
          />
          <Button icon={<FileUp />} onClick={() => fileRef.current?.click()} loading={pending && !preview}>
            Elegir archivo
          </Button>
          <span className="text-[13px] text-adm-fg-muted">{fileName || "Ningún archivo elegido"}</span>
        </div>
        <pre className="rounded-adm bg-adm-surface-2 px-3 py-2 font-mono text-xs text-adm-fg-muted">
          {"from,to\n/producto/remera-vieja,/producto/remera-basica\n/categoria/ofertas,/productos?orden=descuento"}
        </pre>

        {preview ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <Badge tone="green">{formatNumber(valid)} válidas</Badge>
              {invalid ? <Badge tone="red">{formatNumber(invalid)} con errores</Badge> : null}
              {preview.truncated ? <span className="text-adm-fg-muted">Se muestran las primeras 500 filas.</span> : null}
            </div>
            <Table containerClassName="max-h-[320px]">
              <THead>
                <tr>
                  <TH numeric className="w-12">
                    Fila
                  </TH>
                  <TH>Desde</TH>
                  <TH>Hacia</TH>
                  <TH>Estado</TH>
                </tr>
              </THead>
              <TBody>
                {preview.rows.map((r) => (
                  <TR key={r.line} interactive={false}>
                    <TD numeric muted>
                      {r.line}
                    </TD>
                    <TD className="max-w-[200px] truncate font-mono text-xs">{r.from || "—"}</TD>
                    <TD className="max-w-[200px] truncate font-mono text-xs">{r.to || "—"}</TD>
                    <TD className={r.error ? "text-xs text-adm-danger" : "text-xs text-adm-success"}>{r.error ?? "Lista"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

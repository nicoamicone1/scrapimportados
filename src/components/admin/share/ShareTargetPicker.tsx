"use client";

import { Download, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { searchShareProducts } from "@/app/admin/(panel)/compartir/actions";
import { buttonClass } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

import { CopyButton, WhatsAppShareLink } from "./CopyButton";
import { categoryMessage, productMessage } from "./messages";

export interface ShareTarget {
  id: string;
  kind: "product" | "category";
  name: string;
  /** Texto del selector si difiere del nombre ("Hogar › Cocina"). */
  label?: string;
  /** URL pública absoluta. */
  url: string;
  /** Path dentro de la tienda ("/producto/mate"), para el QR. */
  path: string;
  price: number | null;
  maxPrice: number | null;
  /** "$ 12.500" o "desde $ 12.500". */
  priceText: string | null;
  imageUrl: string | null;
}

/**
 * Link de un producto o una categoría: buscador de productos activos (server
 * action, 10 resultados; sin texto, los últimos editados) o selector de
 * categorías visibles. Arma el link, el mensaje "Mirá … · link" y el QR.
 */
export function ShareTargetPicker({
  storeName,
  currency,
  initialProducts,
  categories,
}: {
  storeName: string;
  currency: string;
  initialProducts: ShareTarget[];
  categories: ShareTarget[];
}) {
  const searchId = useId();
  const categoryId = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(initialProducts);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ShareTarget | null>(initialProducts[0] ?? categories[0] ?? null);
  // Último término buscado ("" = la lista inicial) y n.º de pedido, para
  // no repetir búsquedas ni pisar un resultado nuevo con uno viejo.
  const lastTerm = useRef("");
  const request = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term === lastTerm.current) return;
    const handle = setTimeout(() => {
      lastTerm.current = term;
      const id = ++request.current;
      startTransition(async () => {
        const res = await searchShareProducts({ q: term });
        if (id !== request.current) return;
        if (res.ok) {
          setResults(res.data);
          setError(null);
        } else setError(res.error);
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [q]);

  const message = selected
    ? selected.kind === "product"
      ? productMessage({ name: selected.name, price: selected.price, maxPrice: selected.maxPrice, url: selected.url, currency })
      : categoryMessage({ name: selected.name, storeName, url: selected.url })
    : "";

  return (
    <div>
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <Label htmlFor={searchId}>Producto</Label>
          <Input
            id={searchId}
            type="search"
            className="mt-1.5"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o SKU"
            leading={<Search strokeWidth={1.5} />}
            autoComplete="off"
            aria-describedby={`${searchId}-status`}
          />
          <p id={`${searchId}-status`} className="mt-1 text-[12px] text-adm-fg-muted" aria-live="polite">
            {pending
              ? "Buscando…"
              : error
                ? error
                : q.trim()
                  ? `${results.length === 10 ? "Primeros 10" : results.length} ${results.length === 1 ? "resultado" : "resultados"}`
                  : "Últimos productos activos que editaste."}
          </p>
          {results.length ? (
            <ul className={cn("mt-2 divide-y divide-adm-border rounded-adm border border-adm-border", pending && "opacity-60")}>
              {results.map((p) => {
                const active = selected?.kind === "product" && selected.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelected(p)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-1.5 text-left text-[13px] hover:bg-adm-row-hover",
                        active && "bg-adm-accent-2-soft/60 hover:bg-adm-accent-2-soft/60",
                      )}
                    >
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- miniatura del buscador
                        <img src={p.imageUrl} alt="" className="size-8 shrink-0 rounded-adm-sm border border-adm-border object-cover" />
                      ) : (
                        <span aria-hidden className="size-8 shrink-0 rounded-adm-sm bg-adm-surface-2" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      {p.priceText ? <span className="tnum shrink-0 text-adm-fg-muted">{p.priceText}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : !pending && q.trim() ? (
            <p className="mt-2 text-[13px] text-adm-fg-muted">No hay productos activos que coincidan con “{q.trim()}”.</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor={categoryId}>O una categoría</Label>
          <Select
            id={categoryId}
            className="mt-1.5"
            value={selected?.kind === "category" ? selected.id : ""}
            onChange={(e) => {
              const c = categories.find((x) => x.id === e.target.value);
              if (c) setSelected(c);
            }}
            placeholder={categories.length ? "Elegir categoría" : "No hay categorías visibles"}
            disabled={!categories.length}
            options={categories.map((c) => ({ value: c.id, label: c.label ?? c.name }))}
          />
          <p className="mt-1 text-[12px] text-adm-fg-muted">Sirve para promocionar una línea entera: &quot;todo lo de temporada&quot;.</p>
        </div>
      </div>

      {selected ? (
        <div className="border-t border-adm-border bg-adm-table-head px-4 py-3">
          <p className="text-[12px] text-adm-fg-muted">
            {selected.kind === "product" ? "Link del producto" : "Link de la categoría"} · {selected.name}
          </p>
          <p className="mt-0.5 font-mono text-[13px] break-all text-adm-fg">{selected.url}</p>
          <p className="mt-2 text-[13px] whitespace-pre-line text-adm-fg-muted">{message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CopyButton text={selected.url} label="Copiar link" ariaLabel={`Copiar link de ${selected.name}`} />
            <CopyButton text={message} label="Copiar mensaje" ariaLabel={`Copiar mensaje de ${selected.name}`} />
            <WhatsAppShareLink text={message} />
            <a
              href={`/admin/compartir/qr?path=${encodeURIComponent(selected.path)}`}
              download
              className={buttonClass("ghost", "sm")}
            >
              <Download aria-hidden strokeWidth={1.5} />
              QR de este link
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

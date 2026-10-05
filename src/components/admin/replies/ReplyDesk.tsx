"use client";

import { ChevronDown, PackagePlus, ReceiptText, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { searchProductsForReply } from "@/app/admin/(panel)/responder/actions";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/display";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { productReply, stockLevel, type ReplyProductHit, type ReplyTerms, type ReplyVariant } from "@/lib/admin/replies";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { WA_MAX_MESSAGE } from "@/lib/store/whatsapp";

import { CopyReplyButton, OpenWhatsAppLink } from "./ReplyButtons";

/**
 * Buscador de `/admin/responder`: productos de la tienda por nombre o SKU
 * (server action con debounce; sin texto, los últimos editados). Al abrir uno
 * se elige la variante por la que preguntan y queda la respuesta lista, con
 * vista previa editable, para copiar o abrir en WhatsApp.
 */
export function ReplyDesk({
  initial,
  initialError = null,
  terms,
}: {
  initial: ReplyProductHit[];
  /** Error de la carga inicial (se muestra en lugar del vacío "no tenés productos"). */
  initialError?: string | null;
  terms: ReplyTerms;
}) {
  const searchId = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(initial);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(initial.length === 1 ? initial[0].id : null);
  // Último término buscado ("" = la lista inicial) y n.º de pedido, para no
  // repetir búsquedas ni pisar un resultado nuevo con uno viejo.
  const lastTerm = useRef("");
  const request = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term === lastTerm.current) return;
    const handle = setTimeout(() => {
      lastTerm.current = term;
      const id = ++request.current;
      startTransition(async () => {
        const res = await searchProductsForReply({ q: term });
        if (id !== request.current) return;
        if (res.ok) {
          setResults(res.data);
          setError(null);
          // Con un solo resultado se abre directo: un toque menos.
          setOpenId((current) => (res.data.length === 1 ? res.data[0].id : res.data.some((p) => p.id === current) ? current : null));
        } else setError(res.error);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  const term = q.trim();
  const noCatalog = !term && !error && !initialError && !initial.length && !results.length;

  return (
    <div>
      <div className="p-4 sm:p-5">
        <Label htmlFor={searchId}>¿Por qué producto te preguntan?</Label>
        <Input
          id={searchId}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          className="mt-1.5"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre o SKU: remera negra, MATE-01…"
          leading={<Search strokeWidth={1.5} />}
          autoComplete="off"
          aria-describedby={`${searchId}-status`}
          aria-controls={`${searchId}-results`}
        />
        <p id={`${searchId}-status`} className="mt-1.5 text-[12px] text-adm-fg-muted" aria-live="polite">
          {pending
            ? "Buscando…"
            : error
              ? error
              : term
                ? `${results.length === 8 ? "Primeros 8" : results.length} ${results.length === 1 ? "resultado" : "resultados"}`
                : results.length
                  ? "Últimos productos que editaste. Tocá uno para armar la respuesta."
                  : ""}
        </p>
      </div>

      {noCatalog ? (
        <EmptyState
          bare
          icon={<PackagePlus />}
          title="Todavía no tenés productos"
          description="Cuando cargues tu catálogo, acá los buscás para contestar con precio, stock y link en un toque."
          actions={
            <ButtonLink href="/admin/productos/nuevo" variant="primary">
              Cargar producto
            </ButtonLink>
          }
        />
      ) : results.length ? (
        <ul id={`${searchId}-results`} className={cn("divide-y divide-adm-border border-t border-adm-border", pending && "opacity-60")}>
          {results.map((p) => (
            <ProductResult
              key={p.id}
              hit={p}
              terms={terms}
              open={openId === p.id}
              onToggle={() => setOpenId((current) => (current === p.id ? null : p.id))}
            />
          ))}
        </ul>
      ) : term && !pending && !error ? (
        <p className="border-t border-adm-border px-4 py-6 text-[13px] text-adm-fg-muted sm:px-5">
          No encontramos productos con “{term}”. Probá con otra palabra o con el SKU.
        </p>
      ) : null}
    </div>
  );
}

function money(value: number, terms: ReplyTerms): string {
  return formatMoney(value, { currency: terms.currency });
}

function priceRange(variants: ReplyVariant[], terms: ReplyTerms): string | null {
  if (!variants.length) return null;
  const prices = variants.map((v) => v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return max > min ? `${money(min, terms)} – ${money(max, terms)}` : money(min, terms);
}

/** "3 variantes · 2 con stock" / "Sin stock" / "12 u.". */
function stockSummary(hit: ReplyProductHit): { text: string; out: boolean } {
  const vs = hit.variants;
  if (!vs.length) return { text: "Sin variantes activas", out: true };
  const available = vs.filter((v) => stockLevel(v) !== "out").length;
  if (vs.length === 1) return { text: variantStock(vs[0]).text, out: available === 0 };
  if (!available) return { text: `${vs.length} variantes · sin stock`, out: true };
  return { text: `${vs.length} variantes · ${available === vs.length ? "todas" : available} con stock`, out: false };
}

function variantStock(v: ReplyVariant): { text: string; tone: "red" | "amber" | null } {
  if (!v.trackInventory) return { text: "Stock sin control", tone: null };
  if (v.stock <= 0) return v.allowBackorder ? { text: "A pedido", tone: null } : { text: "Sin stock", tone: "red" };
  if (stockLevel(v) === "low") return { text: v.stock === 1 ? "Queda 1" : `Quedan ${v.stock}`, tone: "amber" };
  return { text: `${v.stock.toLocaleString("es-AR")} u.`, tone: null };
}

function ProductResult({ hit, terms, open, onToggle }: { hit: ReplyProductHit; terms: ReplyTerms; open: boolean; onToggle: () => void }) {
  const panelId = useId();
  const summary = stockSummary(hit);
  const range = priceRange(hit.variants, terms);
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-[140ms] hover:bg-adm-row-hover sm:px-5",
          open && "bg-adm-accent-2-soft/50 hover:bg-adm-accent-2-soft/50",
        )}
      >
        {hit.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura del buscador
          <img src={hit.imageUrl} alt="" className="size-11 shrink-0 rounded-adm-sm border border-adm-border object-cover" />
        ) : (
          <span aria-hidden className="size-11 shrink-0 rounded-adm-sm bg-adm-surface-2" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-medium text-adm-fg">{hit.name}</span>
            {hit.status === "draft" ? (
              <Badge tone="neutral" className="shrink-0">
                Borrador
              </Badge>
            ) : null}
          </span>
          <span className={cn("mt-0.5 block truncate text-[12px]", summary.out ? "text-adm-danger" : "text-adm-fg-muted")}>
            {summary.text}
            {range ? <span className="tnum text-adm-fg-muted"> · {range}</span> : null}
          </span>
        </span>
        <ChevronDown aria-hidden strokeWidth={1.5} className={cn("size-4 shrink-0 text-adm-fg-muted transition-transform duration-[140ms]", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={panelId} className="border-t border-adm-border bg-adm-table-head px-4 py-4 sm:px-5">
          <ReplyComposer key={hit.id} hit={hit} terms={terms} />
        </div>
      ) : null}
    </li>
  );
}

function ReplyComposer({ hit, terms }: { hit: ReplyProductHit; terms: ReplyTerms }) {
  const textId = useId();
  const multi = hit.variants.length > 1;
  const [variantId, setVariantId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const generated = productReply(hit, terms, variantId);
  const text = draft ?? generated;
  const tooLong = text.length > WA_MAX_MESSAGE;

  const choose = (id: string | null) => {
    setVariantId(id);
    setDraft(null);
  };

  return (
    <div className="space-y-4">
      {hit.status === "draft" ? (
        <p role="status" className="flex gap-2 rounded-adm bg-adm-accent-2-soft px-3 py-2.5 text-[13px] text-adm-fg">
          <TriangleAlert aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
          <span>
            Está en borrador: el link no abre para tu cliente hasta que lo publiques.{" "}
            <Link href={`/admin/productos/${hit.id}`} className="font-medium text-adm-link underline-offset-2 hover:underline">
              Ir al producto
            </Link>
          </span>
        </p>
      ) : null}

      {multi ? (
        <fieldset>
          <legend className="text-[13px] font-medium text-adm-fg">¿Por cuál te preguntan?</legend>
          <div className="mt-2 overflow-hidden rounded-adm border border-adm-border bg-adm-surface">
            <VariantOption pressed={variantId === null} onClick={() => choose(null)} title="Todo el producto" detail={stockSummary(hit).text} price={priceRange(hit.variants, terms)} />
            {hit.variants.map((v) => {
              const stock = variantStock(v);
              return (
                <VariantOption
                  key={v.id}
                  pressed={variantId === v.id}
                  onClick={() => choose(v.id)}
                  title={v.title ?? "Única"}
                  detail={v.sku ? `SKU ${v.sku}` : null}
                  price={money(v.price, terms)}
                  stock={stock}
                />
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={textId}>Respuesta</Label>
          {draft !== null ? (
            <button type="button" onClick={() => setDraft(null)} className="text-[12px] text-adm-link underline-offset-2 hover:underline">
              Volver al texto armado
            </button>
          ) : (
            <span className="text-[12px] text-adm-fg-muted">Podés editarla antes de copiar</span>
          )}
        </div>
        <Textarea
          id={textId}
          rows={5}
          value={text}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-1.5 rounded-[16px] rounded-ee-[4px] bg-adm-surface text-[14px]"
          aria-describedby={`${textId}-count`}
        />
        <p id={`${textId}-count`} className={cn("tnum mt-1 text-right text-[12px]", tooLong ? "text-adm-danger" : "text-adm-fg-muted")}>
          {tooLong ? "Muy larga: WhatsApp puede cortarla. " : ""}
          {text.length.toLocaleString("es-AR")} de {WA_MAX_MESSAGE.toLocaleString("es-AR")} caracteres
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <CopyReplyButton text={text} variant="primary" size="lg" className="w-full sm:w-auto" ariaLabel={`Copiar respuesta sobre ${hit.name}`} />
        <OpenWhatsAppLink text={text} size="lg" className="w-full sm:w-auto" />
        <ButtonLink href="/admin/pedidos/nuevo" variant="ghost" size="lg" icon={<ReceiptText />} className="max-sm:h-11 sm:ml-auto">
          Armar pedido
        </ButtonLink>
      </div>
    </div>
  );
}

function VariantOption({
  pressed,
  onClick,
  title,
  detail,
  price,
  stock,
}: {
  pressed: boolean;
  onClick: () => void;
  title: string;
  detail?: string | null;
  price: string | null;
  stock?: { text: string; tone: "red" | "amber" | null };
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 border-b border-adm-border px-3 py-2 text-left text-[13px] transition-colors duration-[140ms] last:border-b-0 hover:bg-adm-row-hover",
        pressed && "bg-adm-accent-2-soft/60 hover:bg-adm-accent-2-soft/60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
          pressed ? "border-adm-fg" : "border-adm-input-border",
        )}
      >
        {pressed ? <span className="size-2 rounded-full bg-adm-fg" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-adm-fg">{title}</span>
        {detail ? <span className="block truncate text-[12px] text-adm-fg-muted">{detail}</span> : null}
      </span>
      {stock ? (
        stock.tone ? (
          <Badge tone={stock.tone} className="shrink-0">
            {stock.text}
          </Badge>
        ) : (
          <span className="tnum shrink-0 text-[12px] text-adm-fg-muted">{stock.text}</span>
        )
      ) : null}
      {price ? <span className="tnum min-w-[76px] shrink-0 text-right text-adm-fg">{price}</span> : null}
    </button>
  );
}

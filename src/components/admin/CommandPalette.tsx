"use client";

import { Command } from "cmdk";
import {
  CornerDownLeft,
  ExternalLink,
  FilePlus2,
  Loader2,
  MessageSquareReply,
  Package,
  PackagePlus,
  Receipt,
  ReceiptText,
  Search,
  TicketPlus,
  UserRound,
  BadgePercent,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/display";
import type { PaletteSearchResult } from "@/app/admin/api/search/route";
import type { ModuleCode } from "@/lib/modules/registry";
import { formatMoney } from "@/lib/money";
import { normalizeText } from "@/lib/slug";

import { useOptionalAdminStore } from "./AdminStoreContext";
import { buildNav } from "./nav";

/**
 * Command palette (Ctrl K / ⌘K) — DESIGN.md §7.10.
 * Grupos: Ir a (menú), Acciones rápidas y búsqueda en vivo de Pedidos
 * (#número, email o nombre) y Productos (nombre o SKU) vía
 * GET /admin/api/search?q= con debounce de 200 ms. 100 % teclado; Esc cierra
 * y devuelve el foco (lo maneja el <dialog> nativo).
 */
export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Apps vigentes de la tienda (`ctx.modules`): sus pantallas aparecen en "Ir a". */
  modules?: readonly ModuleCode[];
}

const NO_MODULES: readonly ModuleCode[] = [];

export function CommandPalette({ open, onOpenChange, modules = NO_MODULES }: CommandPaletteProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg" hideClose label="Buscar o ir a" className="mt-[8vh] mb-auto sm:mt-[15vh]">
      {open ? <PaletteBody modules={modules} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

interface PaletteAction {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
  external?: boolean;
}

// Rutas de alta de cada sección (A, B, C, E). Si alguna cambia, actualizar acá.
// E: /admin/paginas no abre el diálogo por URL todavía; `?nueva=1` queda listo para cuando lo soporte.
const ACTIONS: PaletteAction[] = [
  { id: "new-product", label: "Nuevo producto", href: "/admin/productos/nuevo", icon: PackagePlus, keywords: ["crear", "alta", "artículo"] },
  { id: "new-order", label: "Nuevo pedido manual", href: "/admin/pedidos/nuevo", icon: ReceiptText, keywords: ["crear", "venta", "orden"] },
  { id: "reply", label: "Responder una consulta", href: "/admin/responder", icon: MessageSquareReply, keywords: ["whatsapp", "stock", "precio", "contestar"] },
  { id: "new-promo", label: "Nueva promoción", href: "/admin/promociones/nuevo", icon: BadgePercent, keywords: ["crear", "oferta", "descuento"] },
  { id: "new-coupon", label: "Nuevo cupón", href: "/admin/cupones/nuevo", icon: TicketPlus, keywords: ["crear", "código", "descuento"] },
  { id: "new-page", label: "Nueva página", href: "/admin/paginas?nueva=1", icon: FilePlus2, keywords: ["crear", "landing", "builder"] },
  { id: "my-account", label: "Mi cuenta", href: "/admin/usuarios/mi-cuenta", icon: UserRound, keywords: ["contraseña", "perfil", "sesión"] },
  { id: "store", label: "Ver tienda", href: "/", icon: ExternalLink, keywords: ["storefront", "sitio", "web"], external: true },
];

const EMPTY: PaletteSearchResult = { products: [], orders: [] };

function useLiveSearch(query: string) {
  const [result, setResult] = useState<PaletteSearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const trimmed = query.trim();
  const searchable = trimmed.length >= 2 || /^#?\d+$/.test(trimmed);

  useEffect(() => {
    if (!searchable) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/admin/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        setResult((await res.json()) as PaletteSearchResult);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setResult(EMPTY);
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searchable]);

  return { result: searchable ? result : EMPTY, loading: searchable && loading, error: searchable && error };
}

/* Fila activa: niebla con el ícono en tinta y la tecla Enter a la derecha (aparece con la curva de la marca). */
const itemClass =
  "flex h-10 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-sm pointer-coarse:h-11 text-adm-fg transition-colors duration-[140ms] ease-eco-out data-[selected=true]:bg-adm-surface-2 data-[disabled=true]:opacity-50 [&>svg:first-child]:transition-colors data-[selected=true]:[&>svg:first-child]:text-adm-fg";
const groupClass =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.1em] [&_[cmdk-group-heading]]:text-adm-fg-muted [&_[cmdk-group-heading]]:uppercase";

function Enter() {
  return (
    <CornerDownLeft
      className="size-3.5 -translate-x-1 text-adm-fg-muted opacity-0 transition-[opacity,translate] duration-[240ms] ease-eco-out group-data-[selected=true]/item:translate-x-0 group-data-[selected=true]/item:opacity-100"
      aria-hidden
    />
  );
}

function PaletteBody({ modules, onClose }: { modules: readonly ModuleCode[]; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { result, loading, error } = useLiveSearch(query);
  const q = normalizeText(query.trim().replace(/^#/, ""));

  const navItems = useMemo(() => {
    const all = buildNav(modules).flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
    if (!q) return all;
    return all.filter((i) => normalizeText([i.label, i.group, ...(i.keywords ?? [])].join(" ")).includes(q));
  }, [q, modules]);

  // "Ver tienda" va a la tienda activa, no a "/" (que en el host del panel es la landing).
  const storeHref = useOptionalAdminStore()?.store.href;
  const actions = useMemo(() => {
    const list = storeHref ? ACTIONS.map((a) => (a.id === "store" ? { ...a, href: storeHref } : a)) : ACTIONS;
    if (!q) return list;
    return list.filter((a) => normalizeText([a.label, ...a.keywords].join(" ")).includes(q));
  }, [q, storeHref]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const go = (href: string, external?: boolean) => {
    onClose();
    if (external) window.open(href, "_blank", "noopener,noreferrer");
    else router.push(href);
  };

  const nothing = !navItems.length && !actions.length && !result.orders.length && !result.products.length;

  return (
    <Command label="Buscar o ir a" shouldFilter={false} loop className="-mx-6 -mb-5">
      <div className="flex items-center gap-3 border-b border-adm-border px-5">
        {loading ? (
          <Loader2 className="size-[18px] shrink-0 animate-spin text-eco-pomelo" aria-hidden />
        ) : (
          <Search className="size-[18px] shrink-0 text-adm-fg-muted" aria-hidden />
        )}
        <Command.Input
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          placeholder="Buscar pedidos, productos o ir a…"
          className="h-14 w-full bg-transparent text-[15px] text-adm-fg outline-none pointer-coarse:text-base placeholder:text-adm-fg-muted focus-visible:shadow-none"
        />
      </div>
      <Command.List className="adm-scroll max-h-[min(60vh,440px)] overflow-y-auto p-2">
        {nothing && !loading ? (
          <div className="px-3 py-8 text-[13px] text-adm-fg-muted">
            {error ? "No pudimos buscar. Probá de nuevo." : query.trim() ? `Sin resultados para «${query.trim()}».` : "Escribí para buscar."}
          </div>
        ) : null}

        {navItems.length ? (
          <Command.Group heading="Ir a" className={groupClass}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Command.Item key={item.href} value={`nav-${item.href}`} onSelect={() => go(item.href, item.external)} className={`group/item ${itemClass}`}>
                  <Icon className="size-4 shrink-0 text-adm-fg-muted" aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-adm-fg-muted">{item.group}</span>
                  <Enter />
                </Command.Item>
              );
            })}
          </Command.Group>
        ) : null}

        {actions.length ? (
          <Command.Group heading="Acciones" className={groupClass}>
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Command.Item key={a.id} value={`action-${a.id}`} onSelect={() => go(a.href, a.external)} className={`group/item ${itemClass}`}>
                  <Icon className="size-4 shrink-0 text-adm-fg-muted" aria-hidden />
                  <span className="flex-1">{a.label}</span>
                  <Enter />
                </Command.Item>
              );
            })}
          </Command.Group>
        ) : null}
        {result.orders.length ? (
          <Command.Group heading="Pedidos" className={groupClass}>
            {result.orders.map((o) => (
              <Command.Item key={o.id} value={`order-${o.id}`} onSelect={() => go(`/admin/pedidos/${o.id}`)} className={`group/item ${itemClass}`}>
                <Receipt className="size-4 shrink-0 text-adm-fg-muted" aria-hidden />
                <span className="tnum font-medium">#{o.number}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-adm-fg-muted">{[o.name, o.email].filter(Boolean).join(" · ")}</span>
                <span className="tnum text-[13px]">{formatMoney(o.total)}</span>
                <Enter />
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {result.products.length ? (
          <Command.Group heading="Productos" className={groupClass}>
            {result.products.map((p) => (
              <Command.Item key={p.id} value={`product-${p.id}`} onSelect={() => go(`/admin/productos/${p.id}`)} className={`group/item ${itemClass}`}>
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura de 20px de dominios variados
                  <img src={p.image} alt="" width={20} height={20} className="size-5 shrink-0 rounded-[3px] border border-adm-border object-cover" />
                ) : (
                  <Package className="size-4 shrink-0 text-adm-fg-muted" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {p.sku ? <span className="font-mono text-xs text-adm-fg-muted">{p.sku}</span> : null}
                {p.status === "draft" ? <Badge tone="neutral">Borrador</Badge> : null}
                <Enter />
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

      </Command.List>
      <div className="flex items-center gap-3 border-t border-adm-border bg-adm-bg px-5 py-2.5 text-xs text-adm-fg-muted">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> moverse
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Enter</Kbd> abrir
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Esc</Kbd> cerrar
        </span>
        <span className="ml-auto hidden sm:inline">#1043 abre un pedido</span>
      </div>
    </Command>
  );
}

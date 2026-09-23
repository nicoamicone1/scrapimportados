import { FileSpreadsheet, MessageCircle } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { PRESETS, themeVars } from "@/lib/theme";

/*
 * "Capturas" de la landing hechas con componentes reales del admin (Badge,
 * tipografía y tokens `--adm-*`), no con imágenes: siempre coinciden con el
 * producto y no pesan nada.
 */

function Frame({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-adm border border-adm-border bg-adm-surface shadow-adm-card", className)} aria-hidden>
      <div className="flex h-7 items-center gap-1.5 border-b border-adm-border bg-adm-surface-2 px-2.5">
        <span className="size-2 rounded-full bg-adm-border" />
        <span className="size-2 rounded-full bg-adm-border" />
        <span className="ml-2 truncate text-[11px] text-adm-fg-muted">{title}</span>
      </div>
      {children}
    </div>
  );
}

const PRODUCTS = [
  { name: "Jarra de cerámica esmaltada 1 L", sku: "JAR-010", price: 18900, stock: 14, tone: "green" as const, label: "En stock" },
  { name: "Set 4 tazas gres · verde oliva", sku: "TAZ-044", price: 26500, stock: 3, tone: "amber" as const, label: "Quedan 3" },
  { name: "Fuente ovalada 32 cm", sku: "FUE-032", price: 21700, stock: 0, tone: "red" as const, label: "Agotado" },
  { name: "Portavelas de barro · par", sku: "POR-002", price: 9400, stock: 22, tone: "green" as const, label: "En stock" },
];

export function CatalogMock() {
  return (
    <Frame title="Panel · Productos">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]">
        <span className="font-medium">Productos · 128</span>
        <span className="inline-flex items-center gap-1 rounded-adm border border-adm-border px-1.5 py-0.5 text-adm-fg-muted">
          <FileSpreadsheet className="size-3" strokeWidth={1.75} />
          Importar planilla
        </span>
      </div>
      <table className="w-full text-[12px]">
        <tbody>
          {PRODUCTS.map((p) => (
            <tr key={p.sku} className="border-t border-adm-border">
              <td className="py-1.5 pl-3">
                <span className="block size-6 rounded-[3px] bg-adm-surface-2" />
              </td>
              <td className="w-full max-w-0 px-2 py-1.5">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-[11px] text-adm-fg-muted">{p.sku}</div>
              </td>
              <td className="tnum px-2 py-1.5 text-right">{formatMoney(p.price)}</td>
              <td className="py-1.5 pr-3 text-right">
                <Badge tone={p.tone}>{p.label}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  );
}

export function PricesMock() {
  const rows: [string, number, number][] = [
    ["Jarra de cerámica 1 L", 17500, 18900],
    ["Set 4 tazas gres", 24540, 26500],
    ["Fuente ovalada 32 cm", 20090, 21700],
  ];
  return (
    <Frame title="Panel · Precios masivos">
      <div className="space-y-1 px-3 py-2.5 text-[12px]">
        <p>
          <span className="font-medium">Subir 8 %</span> en <span className="font-medium">Cocina y mesa</span> · redondeo a {formatMoney(100)}
        </p>
        <p className="text-adm-fg-muted">64 variantes · se puede deshacer</p>
      </div>
      <table className="w-full text-[12px]">
        <tbody>
          {rows.map(([name, before, after]) => (
            <tr key={name} className="border-t border-adm-border">
              <td className="truncate px-3 py-1.5">{name}</td>
              <td className="tnum px-2 py-1.5 text-right text-adm-fg-muted line-through">{formatMoney(before)}</td>
              <td className="tnum px-3 py-1.5 text-right font-medium">{formatMoney(after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  );
}

export function CheckoutMock() {
  return (
    <Frame title="Panel · Pedido #1042">
      <div className="grid gap-3 p-3 text-[12px] sm:grid-cols-[1fr_1fr]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge tone="amber">Pendiente de pago</Badge>
          </div>
          <dl className="tnum space-y-0.5">
            <div className="flex justify-between">
              <dt className="text-adm-fg-muted">Subtotal</dt>
              <dd>{formatMoney(45400)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-adm-fg-muted">Transferencia −10 %</dt>
              <dd>− {formatMoney(4540)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-adm-fg-muted">Envío CABA</dt>
              <dd>{formatMoney(3200)}</dd>
            </div>
            <div className="flex justify-between border-t border-adm-border pt-1 font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(44060)}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-adm bg-adm-accent-soft p-2 text-[11px] leading-snug">
          <p className="mb-1 flex items-center gap-1 font-medium text-adm-accent">
            <MessageCircle className="size-3" strokeWidth={1.75} />
            WhatsApp del cliente
          </p>
          <p className="font-mono whitespace-pre-line text-adm-fg">
            {`Hola! Pedido #1042 en Taller Luna.\n1 × Jarra de cerámica\n1 × Set 4 tazas de gres\nTotal: ${formatMoney(44060)}`}
          </p>
        </div>
      </div>
    </Frame>
  );
}

export function ShippingMock() {
  const zones: [string, number, string][] = [
    ["CABA", 3200, "24 a 48 h"],
    ["GBA norte", 4800, "48 a 72 h"],
    ["Resto del país", 7900, "3 a 6 días"],
  ];
  return (
    <Frame title="Panel · Envíos">
      <div className="grid grid-cols-[112px_1fr] gap-0">
        <svg viewBox="0 0 112 96" className="h-full w-full border-r border-adm-border bg-adm-surface-2">
          <path d="M18 70 L30 24 L64 16 L92 34 L86 72 L48 84 Z" fill="var(--adm-accent-soft)" stroke="var(--adm-accent)" strokeWidth="1.5" />
          <path d="M40 58 L46 36 L66 34 L70 56 Z" fill="var(--adm-accent-2-soft)" stroke="var(--adm-accent-2-ink)" strokeWidth="1.2" />
          <circle cx="56" cy="46" r="2.5" fill="var(--adm-fg)" />
        </svg>
        <ul className="text-[12px]">
          {zones.map(([name, cost, eta]) => (
            <li key={name} className="flex items-center justify-between gap-2 border-b border-adm-border px-3 py-1.5 last:border-b-0">
              <span>
                <span className="font-medium">{name}</span>
                <span className="block text-[11px] text-adm-fg-muted">{eta}</span>
              </span>
              <span className="tnum">{formatMoney(cost)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

const STORE_PRODUCTS: { name: string; price: number; compareAt?: number; tone: number }[] = [
  { name: "Jarra de cerámica esmaltada 1 L", price: 18900, tone: 34 },
  { name: "Individuales de yute × 4", price: 13900, compareAt: 15600, tone: 56 },
  { name: "Set 4 tazas de gres", price: 26500, tone: 52 },
  { name: "Portavelas de barro · par", price: 9400, tone: 60 },
  { name: "Fuente ovalada 32 cm", price: 21700, tone: 44 },
  { name: "Mate de calabaza forrado", price: 12800, tone: 40 },
];

/** Textos que dibuja `StorefrontMock` con las fuentes del preset (para recortar la hoja de Google Fonts). */
export const STOREFRONT_MOCK_TEXTS = [
  "Taller Luna",
  "Productos",
  "Cómo comprar",
  "Carrito (2)",
  "Hecho a mano en Tucumán",
  "Cerámica esmaltada para la mesa de todos los días",
  "Ver productos",
  ...STORE_PRODUCTS.flatMap((p) => [p.name, formatMoney(p.price), p.compareAt ? formatMoney(p.compareAt) : ""]),
];

/**
 * Mock de una tienda con el preset "mercado", dibujado con las variables
 * reales del preset (`themeVars`): fondo crema, Fraunces en títulos, portada
 * en banda `--secondary`, botón pill y cards con borde fino. `address` es la
 * dirección de ejemplo del entorno (`exampleStoreAddress`). `fontSheet`: hoja de
 * Google Fonts del preset, que pide `LazyFontSheets` sin bloquear el render.
 */
export function StorefrontMock({ address, fontSheet, className }: { address: string; fontSheet?: string; className?: string }) {
  const vars = themeVars(PRESETS.mercado) as CSSProperties;
  return (
    <div
      className={cn("overflow-hidden rounded-adm border border-adm-border shadow-adm-card", className)}
      data-font-sheet={fontSheet}
      aria-hidden
    >
      <div className="flex h-7 items-center gap-1.5 border-b border-adm-border bg-adm-surface-2 px-2.5">
        <span className="size-2 rounded-full bg-adm-border" />
        <span className="size-2 rounded-full bg-adm-border" />
        <span className="ml-2 truncate rounded-[3px] bg-adm-surface px-2 text-[10px] text-adm-fg-muted">{address}</span>
      </div>
      <div style={vars} className="bg-bg text-fg [font-family:var(--font-body)]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <span className="text-[15px] [font-family:var(--font-heading)] [font-weight:var(--heading-weight)] [letter-spacing:var(--heading-tracking)]">
            Taller Luna
          </span>
          <span className="flex gap-3 text-[10px] text-fg-muted">
            <span className="hidden sm:inline">Productos</span>
            <span className="hidden sm:inline">Cómo comprar</span>
            <span className="text-fg">Carrito (2)</span>
          </span>
        </div>
        <div className="bg-secondary px-4 py-5">
          <p className="text-[10px] text-fg-muted">Hecho a mano en Tucumán</p>
          <p className="mt-1 max-w-[260px] text-[17px] leading-[1.15] [font-family:var(--font-heading)] [font-weight:var(--heading-weight)] [letter-spacing:var(--heading-tracking)]">
            Cerámica esmaltada para la mesa de todos los días
          </p>
          <span className="mt-3 inline-block rounded-[var(--btn-radius)] bg-primary px-3 py-1 text-[10px] font-semibold text-primary-fg">
            Ver productos
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
          {STORE_PRODUCTS.map((p, i) => (
            <li key={p.name} className={cn("overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface", i > 3 && "hidden sm:block")}>
              <div className="aspect-square" style={{ background: `color-mix(in oklab, var(--secondary) ${100 - p.tone}%, var(--border))` }} />
              <div className="space-y-0.5 px-2 py-1.5 text-[10px] leading-tight">
                <p className="truncate">{p.name}</p>
                <p className="tnum font-semibold">
                  <span className={p.compareAt ? "text-accent" : undefined}>{formatMoney(p.price)}</span>
                  {p.compareAt ? <s className="ml-1 font-normal text-fg-muted">{formatMoney(p.compareAt)}</s> : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

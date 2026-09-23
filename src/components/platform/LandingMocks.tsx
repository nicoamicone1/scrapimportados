import { FileSpreadsheet, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

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
  { name: "Jarra de cerámica esmaltada 1 L", sku: "JAR-010", price: "$ 18.900", stock: 14, tone: "green" as const, label: "En stock" },
  { name: "Set 4 tazas gres · verde oliva", sku: "TAZ-044", price: "$ 26.500", stock: 3, tone: "amber" as const, label: "Quedan 3" },
  { name: "Fuente ovalada 32 cm", sku: "FUE-032", price: "$ 21.700", stock: 0, tone: "red" as const, label: "Agotado" },
  { name: "Portavelas de barro · par", sku: "POR-002", price: "$ 9.400", stock: 22, tone: "green" as const, label: "En stock" },
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
              <td className="px-2 py-1.5">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-[11px] text-adm-fg-muted">{p.sku}</div>
              </td>
              <td className="tnum px-2 py-1.5 text-right">{p.price}</td>
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
  const rows = [
    ["Jarra de cerámica 1 L", "$ 17.500", "$ 18.900"],
    ["Set 4 tazas gres", "$ 24.540", "$ 26.500"],
    ["Fuente ovalada 32 cm", "$ 20.090", "$ 21.700"],
  ];
  return (
    <Frame title="Panel · Precios masivos">
      <div className="space-y-1 px-3 py-2.5 text-[12px]">
        <p>
          <span className="font-medium">Subir 8 %</span> en <span className="font-medium">Cocina y mesa</span> · redondeo a $ 100
        </p>
        <p className="text-adm-fg-muted">64 variantes · se puede deshacer</p>
      </div>
      <table className="w-full text-[12px]">
        <tbody>
          {rows.map(([name, before, after]) => (
            <tr key={name} className="border-t border-adm-border">
              <td className="truncate px-3 py-1.5">{name}</td>
              <td className="tnum px-2 py-1.5 text-right text-adm-fg-muted line-through">{before}</td>
              <td className="tnum px-3 py-1.5 text-right font-medium">{after}</td>
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
              <dd>$ 45.400</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-adm-fg-muted">Transferencia −10 %</dt>
              <dd>− $ 4.540</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-adm-fg-muted">Envío CABA</dt>
              <dd>$ 3.200</dd>
            </div>
            <div className="flex justify-between border-t border-adm-border pt-1 font-semibold">
              <dt>Total</dt>
              <dd>$ 44.060</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-adm bg-adm-accent-soft p-2 text-[11px] leading-snug">
          <p className="mb-1 flex items-center gap-1 font-medium text-adm-accent">
            <MessageCircle className="size-3" strokeWidth={1.75} />
            WhatsApp del cliente
          </p>
          <p className="font-mono whitespace-pre-line text-adm-fg">
            {"Hola! Hice el pedido #1042.\n2 × Jarra de cerámica\n1 × Set 4 tazas\nTotal: $ 44.060"}
          </p>
        </div>
      </div>
    </Frame>
  );
}

export function ShippingMock() {
  const zones = [
    ["CABA", "$ 3.200", "24 a 48 h"],
    ["GBA norte", "$ 4.800", "48 a 72 h"],
    ["Resto del país", "$ 7.900", "3 a 6 días"],
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
              <span className="tnum">{cost}</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

/** Mock de un storefront con el preset "mercado" (colores del preset, no del admin). */
export function StorefrontMock({ className }: { className?: string }) {
  const tiles = ["#E3D5BC", "#D7C2A3", "#CFB99A", "#E8DCC8", "#D9C6A8", "#E1CFB2"];
  return (
    <div className={cn("overflow-hidden rounded-adm border border-adm-border shadow-[var(--adm-shadow)]", className)} aria-hidden>
      <div className="flex h-7 items-center gap-1.5 border-b border-[#DCCFB8] bg-[#EFE6D6] px-2.5">
        <span className="size-2 rounded-full bg-[#D3C4AA]" />
        <span className="size-2 rounded-full bg-[#D3C4AA]" />
        <span className="ml-2 rounded-[3px] bg-[#FFFBF3] px-2 text-[10px] text-[#6B5C4B]">taller-luna.ecommy.app</span>
      </div>
      <div className="bg-[#F6F0E4] text-[#2B2118]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-[13px] font-semibold tracking-[-0.01em]">Taller Luna</span>
          <span className="flex gap-3 text-[10px] text-[#6B5C4B]">
            <span>Productos</span>
            <span>Cómo comprar</span>
            <span>Carrito (2)</span>
          </span>
        </div>
        <div className="mx-4 rounded-[10px] bg-[#2F5D46] px-4 py-5 text-[#FFFBF3]">
          <p className="text-[10px] tracking-[0.08em] uppercase opacity-80">Hecho a mano en Tucumán</p>
          <p className="mt-1 max-w-[220px] text-[15px] leading-tight font-semibold">Cerámica esmaltada para la mesa de todos los días</p>
          <span className="mt-3 inline-block rounded-full bg-[#FFFBF3] px-2.5 py-1 text-[10px] font-medium text-[#2F5D46]">Ver productos</span>
        </div>
        <div className="grid grid-cols-3 gap-2 p-4">
          {tiles.map((c, i) => (
            <div key={i} className="space-y-1">
              <div className="aspect-square rounded-[8px]" style={{ background: c }} />
              <div className="h-1.5 w-4/5 rounded-full bg-[#DCCFB8]" />
              <div className="h-1.5 w-2/5 rounded-full bg-[#2F5D46]/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import {
  ArrowRight,
  Boxes,
  Copy,
  ExternalLink,
  FolderTree,
  LayoutGrid,
  Menu as MenuIcon,
  Package,
  Palette,
  Percent,
  Plus,
  Receipt,
  Search,
  Share2,
  ShoppingCart,
  Ticket,
  TrendingDown,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

import { DISPLAY, NUM } from "../brand";

import { SAMPLE_ORDER, sampleTotals } from "./sample-order";
import { LUNA, StoreMock } from "./StoreMock";

/*
 * Escenas del panel que todavía no tienen captura (docs/PRODUCT-THESIS.md
 * §4.2 y §4.3): "Qué pasó esta semana" y "Respuestas listas". Mocks
 * tipográficos con los datos de la tienda de ejemplo (Luna Indumentaria), sin JS
 * ni botones de verdad: son ilustraciones, así que van `aria-hidden` y el
 * texto de al lado cuenta lo mismo.
 */

const CARD = "rounded-[24px] bg-eco-paper p-5 shadow-[0_0_0_1px_var(--eco-line),0_30px_60px_-36px_rgb(16_22_47/0.4)] sm:p-6";

/** "Qué pasó esta semana": el número y, abajo, por qué. */
export function WeekScene() {
  const lines = [
    { k: "Producto", text: "Pantalones vendió 31 % menos." },
    { k: "Precio", text: "Subiste los precios de Pantalones un 12 % el martes." },
    { k: "Stock", text: "El pantalón wide beige en 38 se quedó sin stock el jueves." },
  ];
  return (
    <div aria-hidden className={cn(CARD, "lp-tilt-l")}>
      <p className="text-[12px] font-semibold tracking-[0.08em] text-eco-text-muted uppercase">Qué pasó esta semana</p>
      <p className={cn(DISPLAY, "mt-2 flex items-start gap-2.5 text-[20px] leading-tight text-eco-ink sm:text-[22px]")}>
        <TrendingDown className="mt-0.5 size-5 shrink-0 text-eco-pomelo-ink" strokeWidth={1.75} />
        <span>
          Vendiste <span className="tnum">18 %</span> menos que la semana pasada.
        </span>
      </p>
      <ul className="mt-4 space-y-2">
        {lines.map((l) => (
          <li key={l.k} className="flex min-w-0 items-baseline gap-3 rounded-[14px] bg-eco-niebla px-3 py-2 text-[13px] leading-snug text-eco-ink">
            <span className="w-[78px] shrink-0 text-[11px] font-semibold tracking-[0.06em] text-eco-text-muted uppercase">{l.k}</span>
            <span className="tnum min-w-0">{l.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Respuestas listas": buscás el producto y copiás la respuesta armada. */
export function RepliesScene({ storeAddress }: { storeAddress: string }) {
  const [remera] = SAMPLE_ORDER.items;
  return (
    <div aria-hidden className={cn(CARD, "lp-tilt-r")}>
      <p className="flex h-11 items-center gap-2 rounded-[12px] border-2 border-eco-ink px-3 text-[15px] text-eco-ink">
        <Search className="size-4 shrink-0 text-eco-text-muted" strokeWidth={1.75} />
        remera negra
        <span className="h-5 w-[2px] bg-eco-azul" />
      </p>
      <div className="mt-3 flex min-w-0 items-center gap-3 rounded-[14px] bg-eco-niebla px-3 py-2.5 text-[13px] text-eco-ink">
        <span className="size-9 shrink-0 rounded-[10px] bg-eco-durazno" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{remera.name}</span>
          <span className="tnum block text-eco-text-muted">
            S: 5 · M: 3 · L: sin stock · {formatMoney(remera.total)}
          </span>
        </span>
      </div>
      <div className="eco-bubble-r mt-4 ml-auto w-[94%] bg-eco-durazno px-3.5 py-2.5 text-[13px] leading-snug text-eco-ink [--eco-bubble-r:16px]">
        Sí, tenemos {remera.name} en M. Nos quedan las últimas 3 unidades. Sale <span className="tnum">{formatMoney(remera.total)}</span>, con{" "}
        {SAMPLE_ORDER.transferPercent} % menos pagando por transferencia. Podés comprarlo acá:{" "}
        <span className="break-all">{storeAddress}/producto/remera-oversize-negra</span>
      </div>
      <p className="mt-3 flex justify-end">
        <span className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-eco-ink px-3.5 text-[13px] font-medium text-white">
          <Copy className="size-3.5" strokeWidth={1.75} />
          Copiar respuesta
        </span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* El panel de la tienda de ejemplo (en lugar de las capturas)          */
/* ------------------------------------------------------------------ */

/*
 * Maquetas del panel con los datos de Luna Indumentaria: Inicio, Productos
 * (computadora) y Pedidos (celular). Reemplazan a las capturas de la tienda
 * demo anterior (electro y bazar). Se dibujan como el panel real (sidebar
 * tinta, superficies blancas, badges `--adm-badge-*`, stack del sistema) en
 * "px virtuales" que escalan con el marco (`--u`, igual que `StoreMock`):
 * se ven como una captura a 330 px o a 700 px. Son ilustraciones: van como
 * `role="img"` con su descripción, y el texto de al lado cuenta lo mismo.
 */

/** Largo en px virtuales → CSS que escala con el ancho del marco. */
const v = (n: number) => `calc(var(--u) * ${n})`;

type Tone = "neutral" | "amber" | "blue" | "purple" | "teal" | "green";

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full font-medium whitespace-nowrap"
      style={{ height: v(15), gap: v(4), paddingInline: v(6), fontSize: v(7.5), background: `var(--adm-badge-${tone}-bg)`, color: `var(--adm-badge-${tone}-fg)` }}
    >
      <span className="shrink-0 rounded-full bg-current" style={{ width: v(4), height: v(4) }} />
      {children}
    </span>
  );
}

/** Lienzo escalable de una maqueta del panel (W px virtuales de ancho). */
function PanelCanvas({ width, label, className, children }: { width: number; label: string; className?: string; children: ReactNode }) {
  return (
    <div role="img" aria-label={label} className={cn("@container size-full overflow-hidden", className)}>
      <div
        className="relative size-full bg-adm-bg text-adm-fg select-none font-[family-name:var(--eco-font-text)]"
        style={{ "--u": `calc(100cqw / ${width})`, fontSize: v(9), lineHeight: 1.3 } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

/** La "e" de la marca en su burbuja, medida en px virtuales. */
function Mark({ size }: { size: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center bg-eco-pomelo" style={{ width: v(size), height: v(size), borderRadius: `${v(size * 0.34)} ${v(size * 0.34)} ${v(size * 0.34)} ${v(size * 0.08)}` }}>
      <svg viewBox="16 16 68 68" style={{ width: v(size * 0.58), height: v(size * 0.58) }}>
        <path d="M24 50H76A26 26 0 1 0 69.9 66.7" fill="none" stroke="var(--eco-ink)" strokeWidth={13} />
      </svg>
    </span>
  );
}

const NAV: { section: string; items: { icon: LucideIcon; label: string; badge?: number; key?: string }[] }[] = [
  {
    section: "Principal",
    items: [
      { icon: LayoutGrid, label: "Inicio", key: "inicio" },
      { icon: Receipt, label: "Pedidos", badge: 2, key: "pedidos" },
      { icon: ShoppingCart, label: "Carritos abandonados" },
      { icon: Users, label: "Clientes" },
    ],
  },
  {
    section: "Catálogo",
    items: [
      { icon: Package, label: "Productos", key: "productos" },
      { icon: FolderTree, label: "Categorías" },
      { icon: Boxes, label: "Inventario" },
    ],
  },
  {
    section: "Marketing",
    items: [
      { icon: Percent, label: "Promociones" },
      { icon: Ticket, label: "Cupones" },
    ],
  },
  { section: "Tienda", items: [{ icon: Palette, label: "Apariencia" }] },
];

function Sidebar({ active }: { active: "inicio" | "productos" }) {
  return (
    <div className="absolute inset-y-0 left-0 bg-adm-sidebar-bg text-adm-sidebar-fg" style={{ width: v(150), padding: `${v(14)} ${v(10)}` }}>
      <p className="flex items-center" style={{ gap: v(6), paddingInline: v(4) }}>
        <Mark size={18} />
        <span className={cn(DISPLAY, "text-white")} style={{ fontSize: v(13) }}>
          ecommy
        </span>
      </p>
      <p className="flex items-center border border-adm-sidebar-border" style={{ marginTop: v(14), gap: v(6), padding: v(6), borderRadius: v(8) }}>
        <span className="flex shrink-0 items-center justify-center bg-eco-mist font-semibold text-eco-ink" style={{ width: v(18), height: v(18), borderRadius: v(5), fontSize: v(8) }}>
          L
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-white" style={{ fontSize: v(8.5) }}>
            {LUNA.name}
          </span>
          <span className="block text-adm-sidebar-muted" style={{ fontSize: v(7) }}>
            Pro
          </span>
        </span>
      </p>
      {NAV.map((group) => (
        <div key={group.section} style={{ marginTop: v(12) }}>
          <p className="font-semibold tracking-[0.08em] text-adm-sidebar-muted uppercase" style={{ fontSize: v(6.5), paddingInline: v(6), marginBottom: v(3) }}>
            {group.section}
          </p>
          {group.items.map(({ icon: Icon, label, badge, key }) => (
            <p
              key={label}
              className={cn("flex items-center", key === active && "bg-adm-sidebar-active text-white")}
              style={{ gap: v(7), height: v(20), paddingInline: v(6), borderRadius: v(6), fontSize: v(8.5) }}
            >
              <Icon strokeWidth={1.75} style={{ width: v(10), height: v(10) }} />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {badge ? (
                <span className="flex items-center justify-center rounded-full bg-eco-pomelo font-semibold text-eco-ink" style={{ width: v(12), height: v(12), fontSize: v(6.5) }}>
                  {badge}
                </span>
              ) : null}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function TopBar() {
  return (
    <div className="flex items-center justify-between" style={{ height: v(34), paddingInline: v(16) }}>
      <span className="flex items-center rounded-full border border-adm-border bg-adm-surface text-adm-fg-muted" style={{ width: v(230), height: v(20), gap: v(5), paddingInline: v(8), fontSize: v(7.5) }}>
        <Search strokeWidth={1.75} style={{ width: v(9), height: v(9) }} />
        Buscar pedidos, productos o ir a…
      </span>
      <span className="flex items-center" style={{ gap: v(8) }}>
        <span className="flex items-center rounded-full border border-adm-border bg-adm-surface font-medium" style={{ height: v(20), gap: v(4), paddingInline: v(8), fontSize: v(7.5) }}>
          Ver tienda
          <ExternalLink strokeWidth={1.75} style={{ width: v(8), height: v(8) }} />
        </span>
        <span className="flex items-center justify-center rounded-full bg-eco-ink font-semibold text-white" style={{ width: v(20), height: v(20), fontSize: v(7) }}>
          LI
        </span>
      </span>
    </div>
  );
}

const PANEL_CARD = "rounded-adm-lg border border-adm-border bg-adm-surface";

const { total: SAMPLE_TOTAL } = sampleTotals();

/** Pedidos de ejemplo (el #1042 es el del hero; el resto, compras con precios del catálogo). */
const ORDERS: { n: number; who: string; status: [string, Tone]; pay: [string, Tone]; total: number; detail: string; action?: string }[] = [
  { n: SAMPLE_ORDER.number, who: SAMPLE_ORDER.customer, status: ["Pendiente", "amber"], pay: ["Sin pagar", "amber"], total: SAMPLE_TOTAL, detail: "2 ítems · Envío · Transferencia", action: "Confirmar pago" },
  { n: 1041, who: "Lucía Fernández", status: ["En preparación", "purple"], pay: ["Pagado", "green"], total: 80100, detail: "1 ítem · Retiro · Transferencia", action: "Listo para retirar" },
  { n: 1040, who: "Carla Benítez", status: ["Confirmado", "blue"], pay: ["Sin pagar", "amber"], total: 49500, detail: "2 ítems · Envío · Transferencia", action: "Confirmar pago" },
  { n: 1039, who: "Sofía Ramírez", status: ["Enviado", "teal"], pay: ["Pagado", "green"], total: 128700, detail: "1 ítem · Envío · Transferencia" },
  { n: 1038, who: "Martina Gómez", status: ["Entregado", "green"], pay: ["Pagado", "green"], total: 26000, detail: "1 ítem · Retiro · Efectivo" },
];

/** Inicio del panel: lo que hay para hacer hoy, los últimos pedidos y el stock bajo. */
export function PanelHomeScene() {
  return (
    <PanelCanvas width={760} label={`Inicio del panel de ${LUNA.name}: un pedido por confirmar, dos para despachar, dos pagos sin acreditar, los últimos pedidos y el stock bajo`}>
      <Sidebar active="inicio" />
      <div className="absolute inset-y-0 right-0" style={{ left: v(150) }}>
        <TopBar />
        <div style={{ paddingInline: v(18) }}>
          <p className="text-adm-fg-muted" style={{ fontSize: v(8) }}>
            Buenas tardes
          </p>
          <p className={DISPLAY} style={{ fontSize: v(19), marginTop: v(2) }}>
            {LUNA.name}
          </p>
          <p className="flex" style={{ gap: v(5), marginTop: v(6) }}>
            {["1 por confirmar", "2 para despachar", "2 sin pagar"].map((t) => (
              <span key={t} className="rounded-full bg-adm-surface font-medium" style={{ paddingInline: v(7), height: v(16), lineHeight: v(16), fontSize: v(7.5), boxShadow: "0 0 0 1px var(--adm-border)" }}>
                {t}
              </span>
            ))}
          </p>
          <div className="grid" style={{ gridTemplateColumns: "1fr 0.62fr", gap: v(12), marginTop: v(12) }}>
            <div className="min-w-0">
              <p className="font-semibold" style={{ fontSize: v(9) }}>
                Para hacer
              </p>
              <div className="grid grid-cols-3" style={{ gap: v(8), marginTop: v(6) }}>
                <div className="rounded-adm-lg bg-eco-pomelo-soft" style={{ padding: v(10) }}>
                  <p className="font-semibold tracking-[0.08em] text-eco-pomelo-ink uppercase" style={{ fontSize: v(6.5) }}>
                    Primero esto
                  </p>
                  <p className={cn(NUM, "tnum")} style={{ fontSize: v(24), marginTop: v(6) }}>
                    1
                  </p>
                  <p className="font-semibold" style={{ fontSize: v(8.5) }}>
                    Pedido por confirmar
                  </p>
                  <span className="inline-flex items-center rounded-adm bg-eco-ink font-medium whitespace-nowrap text-white" style={{ marginTop: v(7), height: v(18), gap: v(4), paddingInline: v(6), fontSize: v(7) }}>
                    Confirmar pedidos
                    <ArrowRight strokeWidth={1.75} style={{ width: v(8), height: v(8) }} />
                  </span>
                </div>
                {[
                  { n: "2", t: "Para preparar y despachar", d: "Confirmados que todavía no salieron." },
                  { n: "2", t: "Pagos sin acreditar", d: `${formatMoney(SAMPLE_TOTAL + 49500)} por cobrar.` },
                ].map((c) => (
                  <div key={c.t} className={PANEL_CARD} style={{ padding: v(10) }}>
                    <p className={cn(NUM, "tnum")} style={{ fontSize: v(18) }}>
                      {c.n}
                    </p>
                    <p className="font-semibold" style={{ fontSize: v(8.5), marginTop: v(4) }}>
                      {c.t}
                    </p>
                    <p className="tnum text-adm-fg-muted" style={{ fontSize: v(7.5), marginTop: v(2) }}>
                      {c.d}
                    </p>
                  </div>
                ))}
              </div>
              <div className={PANEL_CARD} style={{ marginTop: v(10) }}>
                <p className="flex items-center justify-between border-b border-adm-border font-semibold" style={{ padding: `${v(8)} ${v(10)}`, fontSize: v(9) }}>
                  Últimos pedidos
                  <span className="font-medium text-eco-azul" style={{ fontSize: v(7.5) }}>
                    Ver todos
                  </span>
                </p>
                {ORDERS.map((o) => (
                  <p key={o.n} className="flex items-center border-b border-adm-border last:border-0" style={{ gap: v(8), padding: `${v(5)} ${v(10)}` }}>
                    <span className="flex shrink-0 items-center justify-center rounded-full bg-adm-surface-2 font-semibold text-adm-fg-muted" style={{ width: v(18), height: v(18), fontSize: v(6.5) }}>
                      {o.who
                        .split(" ")
                        .map((w) => w[0])
                        .join("")}
                    </span>
                    <span className="min-w-0 flex-1 truncate" style={{ fontSize: v(8.5) }}>
                      <span className="tnum font-semibold">#{o.n}</span> {o.who}
                    </span>
                    <Pill tone={o.status[1]}>{o.status[0]}</Pill>
                    <Pill tone={o.pay[1]}>{o.pay[0]}</Pill>
                    <span className="tnum text-right font-semibold" style={{ width: v(58), fontSize: v(8.5) }}>
                      {formatMoney(o.total)}
                    </span>
                  </p>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <div className={PANEL_CARD} style={{ padding: v(10) }}>
                <p className="flex items-center justify-between font-semibold" style={{ fontSize: v(9) }}>
                  Tu tienda
                  <Pill tone="green">Online</Pill>
                </p>
                <div className="overflow-hidden rounded-adm border border-adm-border" style={{ marginTop: v(8), aspectRatio: "4 / 3" }}>
                  <StoreMock />
                </div>
                <p className="flex items-center justify-between" style={{ marginTop: v(7), fontSize: v(8) }}>
                  <span className="font-semibold">{LUNA.name}</span>
                  <span className="text-adm-fg-muted" style={{ fontSize: v(7) }}>
                    Estilo Atelier
                  </span>
                </p>
              </div>
              <div className={PANEL_CARD} style={{ marginTop: v(10) }}>
                <p className="border-b border-adm-border font-semibold" style={{ padding: `${v(8)} ${v(10)}`, fontSize: v(9) }}>
                  Stock bajo
                </p>
                {[
                  { name: "Remera básica de algodón", variant: "Negro / M · LU-RE01-NEG-M", left: 2 },
                  { name: "Buzo canguro de frisa", variant: "Negro / M · LU-BU01-NEG-M", left: 2 },
                ].map((s) => (
                  <p key={s.name} className="flex items-center justify-between border-b border-adm-border last:border-0" style={{ gap: v(6), padding: `${v(6)} ${v(10)}` }}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium" style={{ fontSize: v(8) }}>
                        {s.name}
                      </span>
                      <span className="block truncate text-adm-fg-muted" style={{ fontSize: v(6.5) }}>
                        {s.variant}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full font-medium" style={{ paddingInline: v(6), height: v(14), lineHeight: v(14), fontSize: v(7), background: "var(--adm-badge-amber-bg)", color: "var(--adm-badge-amber-fg)" }}>
                      Quedan {s.left}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PanelCanvas>
  );
}

/** Productos del panel: una fila por producto con foto, precio y stock. */
const PRODUCT_ROWS: { name: string; sku: string; category: string; price: number; stock: number; color: string }[] = [
  { name: SAMPLE_ORDER.items[0].name, sku: "LU-RE07", category: "Remeras", price: SAMPLE_ORDER.items[0].total, stock: 14, color: "#1B1A18" },
  { name: SAMPLE_ORDER.items[1].name, sku: "LU-PA07", category: "Pantalones", price: SAMPLE_ORDER.items[1].total, stock: 3, color: "#D8C7A8" },
  { name: "Remera básica de algodón", sku: "LU-RE01", category: "Remeras", price: 26000, stock: 34, color: "#F4F2EE" },
  { name: "Buzo canguro de frisa", sku: "LU-BU01", category: "Buzos y camperas", price: 68000, stock: 48, color: "#A3A09B" },
  { name: "Vestido camisero de lino", sku: "LU-VE01", category: "Vestidos", price: 89000, stock: 17, color: "#EAE2D2" },
  { name: "Pantalón ancho de lino", sku: "LU-PA02", category: "Pantalones", price: 62000, stock: 40, color: "#1B1A18" },
  { name: "Tapado de paño largo", sku: "LU-CA03", category: "Buzos y camperas", price: 158000, stock: 0, color: "#857B72" },
  { name: "Camisa de lino holgada", sku: "LU-CM01", category: "Camisas", price: 58000, stock: 42, color: "#A9C6DD" },
  { name: "Musculosa acanalada", sku: "LU-RE04", category: "Remeras", price: 24000, stock: 50, color: "#B1593A" },
];

export function PanelProductsScene() {
  const cols = "grid-cols-[minmax(0,2.6fr)_0.8fr_1.3fr_0.8fr_0.5fr]";
  return (
    <PanelCanvas width={760} label={`Productos del panel de ${LUNA.name}: cada prenda en una fila con su precio, su stock y su estado`}>
      <Sidebar active="productos" />
      <div className="absolute inset-y-0 right-0" style={{ left: v(150) }}>
        <TopBar />
        <div style={{ paddingInline: v(18) }}>
          <p className="flex items-center font-semibold tracking-[0.08em] text-adm-fg-muted uppercase" style={{ gap: v(4), fontSize: v(6.5) }}>
            <span className="rounded-full bg-eco-azul" style={{ width: v(4), height: v(4) }} />
            Catálogo
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className={DISPLAY} style={{ fontSize: v(19), marginTop: v(2) }}>
                Productos
              </p>
              <p className="tnum text-adm-fg-muted" style={{ fontSize: v(8) }}>
                32 activos · 0 en borrador · 1 sin stock
              </p>
            </div>
            <span className="flex items-center rounded-adm bg-eco-ink font-medium text-white" style={{ height: v(20), gap: v(4), paddingInline: v(8), fontSize: v(8) }}>
              <Plus strokeWidth={2} style={{ width: v(9), height: v(9) }} />
              Nuevo producto
            </span>
          </div>
          <p className="flex" style={{ gap: v(5), marginTop: v(10) }}>
            {[
              ["Todos", "32"],
              ["Activos", "32"],
              ["Borradores", "0"],
              ["Archivados", "0"],
            ].map(([t, n], k) => (
              <span
                key={t}
                className={cn("flex items-center rounded-full font-medium", k === 0 ? "bg-eco-ink text-white" : "bg-adm-surface")}
                style={{ height: v(18), gap: v(4), paddingInline: v(8), fontSize: v(8), boxShadow: k === 0 ? undefined : "0 0 0 1px var(--adm-border)" }}
              >
                {t}
                <span className="tnum opacity-70">{n}</span>
              </span>
            ))}
          </p>
          <div className={cn(PANEL_CARD, "overflow-hidden")} style={{ marginTop: v(10) }}>
            <p className={cn("grid items-center border-b border-adm-border text-adm-fg-muted", cols)} style={{ gap: v(8), padding: `${v(6)} ${v(10)}`, fontSize: v(7.5) }}>
              <span>Producto</span>
              <span>Estado</span>
              <span>Categoría</span>
              <span className="text-right">Precio</span>
              <span className="text-right">Stock</span>
            </p>
            {PRODUCT_ROWS.map((r) => (
              <p key={r.sku} className={cn("grid items-center border-b border-adm-border", cols)} style={{ gap: v(8), padding: `${v(5)} ${v(10)}` }}>
                <span className="flex min-w-0 items-center" style={{ gap: v(7) }}>
                  <span className="shrink-0" style={{ width: v(20), height: v(25), background: r.color, borderRadius: v(3), boxShadow: "inset 0 0 0 1px rgb(16 22 47 / 0.08)" }} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium" style={{ fontSize: v(8.5) }}>
                      {r.name}
                    </span>
                    <span className="block font-[family-name:var(--eco-font-mono)] text-adm-fg-muted" style={{ fontSize: v(6.5) }}>
                      {r.sku}
                    </span>
                  </span>
                </span>
                <span>{r.stock > 0 ? <Pill tone="green">Activo</Pill> : <Pill tone="neutral">Sin stock</Pill>}</span>
                <span className="truncate text-adm-fg-muted" style={{ fontSize: v(8) }}>
                  {r.category}
                </span>
                <span className="tnum text-right font-semibold" style={{ fontSize: v(8.5) }}>
                  {formatMoney(r.price)}
                </span>
                <span className={cn("tnum text-right", r.stock <= 3 && "font-semibold text-adm-warning")} style={{ fontSize: v(8.5) }}>
                  {r.stock}
                </span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </PanelCanvas>
  );
}

/** Pedidos en el celular: tarjetas con la acción que sigue y la barra de abajo al alcance del pulgar. */
export function PanelOrdersPhoneScene() {
  const tabs: [LucideIcon, string, number?][] = [
    [LayoutGrid, "Inicio"],
    [Receipt, "Pedidos", 2],
    [Package, "Productos"],
    [Share2, "Compartir"],
    [MenuIcon, "Menú"],
  ];
  return (
    <PanelCanvas width={270} label={`Pedidos del panel de ${LUNA.name} en el celular, con la acción que sigue en cada uno`} className="bg-eco-ink">
      <div className="absolute inset-0 bg-eco-ink">
        <p className="flex items-center" style={{ gap: v(7), padding: `${v(24)} ${v(18)} ${v(10)}` }}>
          <Mark size={22} />
          <span className="flex min-w-0 flex-1 items-center rounded-full bg-eco-ink-2 text-white" style={{ height: v(24), gap: v(6), paddingInline: v(5) }}>
            <span className="flex shrink-0 items-center justify-center rounded-full bg-eco-mist font-semibold text-eco-ink" style={{ width: v(15), height: v(15), fontSize: v(7) }}>
              L
            </span>
            <span className="truncate font-semibold" style={{ fontSize: v(9) }}>
              {LUNA.name}
            </span>
          </span>
          <Search className="text-white" strokeWidth={1.75} style={{ width: v(13), height: v(13) }} />
        </p>
        <div className="absolute inset-x-0 bottom-0 bg-adm-bg" style={{ top: v(56), borderRadius: `${v(16)} ${v(16)} 0 0`, padding: `${v(12)} ${v(10)}` }}>
          <p className="flex items-center font-semibold tracking-[0.08em] text-adm-fg-muted uppercase" style={{ gap: v(4), fontSize: v(7) }}>
            <span className="rounded-full bg-eco-pomelo" style={{ width: v(4), height: v(4) }} />
            Ventas
          </p>
          <p className={DISPLAY} style={{ fontSize: v(18), marginTop: v(2) }}>
            Pedidos
          </p>
          <p className="tnum text-adm-fg-muted" style={{ fontSize: v(8) }}>
            1 pendiente · 2 por preparar · 11 en total
          </p>
          <p className="flex" style={{ gap: v(5), marginTop: v(10) }}>
            {[
              ["Todos", "11"],
              ["Pendientes", "1"],
              ["Por preparar", "2"],
            ].map(([t, n], k) => (
              <span
                key={t}
                className={cn("flex shrink-0 items-center rounded-full font-medium", k === 0 ? "bg-eco-ink text-white" : "bg-adm-surface")}
                style={{ height: v(20), gap: v(4), paddingInline: v(8), fontSize: v(8), boxShadow: k === 0 ? undefined : "0 0 0 1px var(--adm-border)" }}
              >
                {t}
                <span className={cn("tnum", k > 0 && "flex items-center justify-center rounded-full bg-eco-pomelo text-eco-ink")} style={k > 0 ? { width: v(12), height: v(12), fontSize: v(6.5) } : undefined}>
                  {n}
                </span>
              </span>
            ))}
          </p>
          {ORDERS.slice(0, 4).map((o) => (
            <div key={o.n} className={PANEL_CARD} style={{ marginTop: v(8), padding: v(9) }}>
              <p className="flex items-baseline justify-between" style={{ gap: v(6) }}>
                <span className="tnum font-semibold" style={{ fontSize: v(10) }}>
                  #{o.n}
                </span>
                <span className="tnum font-semibold" style={{ fontSize: v(10) }}>
                  {formatMoney(o.total)}
                </span>
              </p>
              <p style={{ fontSize: v(8.5), marginTop: v(1) }}>{o.who}</p>
              <p className="flex" style={{ gap: v(4), marginTop: v(5) }}>
                <Pill tone={o.status[1]}>{o.status[0]}</Pill>
                <Pill tone={o.pay[1]}>{o.pay[0]}</Pill>
              </p>
              <p className="text-adm-fg-muted" style={{ fontSize: v(7.5), marginTop: v(4) }}>
                {o.detail}
              </p>
              {o.action ? (
                <p className="flex justify-end" style={{ marginTop: v(6) }}>
                  <span className="inline-flex items-center rounded-adm border border-adm-border bg-adm-surface font-medium" style={{ height: v(20), gap: v(4), paddingInline: v(8), fontSize: v(8) }}>
                    {o.action}
                    <ArrowRight strokeWidth={1.75} style={{ width: v(8), height: v(8) }} />
                  </span>
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <p className="absolute flex items-center justify-around rounded-full bg-eco-ink text-eco-mist" style={{ left: v(8), right: v(8), bottom: v(10), height: v(40), boxShadow: "0 10px 24px -12px rgb(16 22 47 / 0.7)" }}>
          {tabs.map(([Icon, label, badge]) => (
            <span key={label} className={cn("relative flex flex-col items-center", label === "Pedidos" && "rounded-full bg-eco-ink-3 text-white")} style={{ gap: v(2), padding: `${v(4)} ${v(8)}`, fontSize: v(6.5) }}>
              <Icon strokeWidth={1.75} style={{ width: v(12), height: v(12) }} />
              {label}
              {badge ? (
                <span className="absolute flex items-center justify-center rounded-full bg-eco-pomelo font-semibold text-eco-ink" style={{ top: v(0), right: v(6), width: v(10), height: v(10), fontSize: v(6) }}>
                  {badge}
                </span>
              ) : null}
            </span>
          ))}
        </p>
      </div>
    </PanelCanvas>
  );
}

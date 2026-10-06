"use client";

import { Minus, Plus, RotateCcw, Store, Truck } from "lucide-react";
import { useId, useState, type CSSProperties, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { buildOrderMessage } from "@/lib/store/whatsapp";

import { TweenInt, TweenMoney } from "./Tween";

/*
 * Demos del panel con las que se puede jugar (BRAND §8, nivel 1). Son islas
 * cliente chicas, con la tipografía del panel (stack del sistema) y su kit
 * (`Badge`), y la lógica real donde existe (`buildOrderMessage` arma el mismo
 * mensaje de WhatsApp que la tienda). Los datos son de ejemplo.
 */

const PANEL_FONT = "font-[family-name:var(--eco-font-text)]";

/** Ventana del panel: superficie blanca, radio 16 y barra con la ruta. */
export function PanelWindow({ path, children, className }: { path: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-adm-lg bg-adm-surface text-adm-fg shadow-[0_0_0_1px_var(--eco-line),0_24px_48px_-28px_rgb(16_22_47/0.4)]", PANEL_FONT, className)}>
      <div className="flex h-9 items-center gap-1.5 border-b border-adm-border bg-adm-surface-2 px-3">
        <span className="size-2 rounded-full bg-eco-line" />
        <span className="size-2 rounded-full bg-eco-line" />
        <span className="ml-2 truncate text-[12px] text-adm-fg-muted">{path}</span>
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-adm bg-adm-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 rounded-[8px] px-3 text-[13px] font-medium transition-[background-color,box-shadow,color] duration-[140ms] max-sm:min-h-11",
            o.value === value ? "bg-adm-surface text-adm-fg shadow-[0_1px_2px_rgb(16_22_47/0.12),0_0_0_1px_var(--eco-line)]" : "text-adm-fg-muted hover:text-adm-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Precios masivos con vista previa y Deshacer                          */
/* ------------------------------------------------------------------ */

const PRICE_ROWS = [
  { name: "Remera oversize negra", price: 17500 },
  { name: "Pantalón wide beige", price: 24540 },
  { name: "Buzo de frisa gris", price: 30000 },
  { name: "Vestido de lino", price: 27590 },
];
type Rounding = "none" | "10" | "100";
const ROUNDING: { value: Rounding; label: string }[] = [
  { value: "none", label: "Sin redondeo" },
  { value: "10", label: "A $ 10" },
  { value: "100", label: "A $ 100" },
];

function applyChange(price: number, pct: number, dir: "up" | "down", rounding: Rounding): number {
  const raw = price * (1 + ((dir === "up" ? 1 : -1) * pct) / 100);
  if (rounding === "none") return Math.round(raw);
  const step = Number(rounding);
  return Math.ceil(raw / step) * step;
}

export function PricesDemo() {
  const id = useId();
  const [base, setBase] = useState(() => PRICE_ROWS.map((r) => r.price));
  const [history, setHistory] = useState<number[][]>([]);
  const [pct, setPctRaw] = useState(8);
  const [dir, setDirRaw] = useState<"up" | "down">("up");
  const [rounding, setRoundingRaw] = useState<Rounding>("100");
  /** Recién aplicado: la tabla muestra antes → ahora hasta que se toque un control. */
  const [applied, setApplied] = useState(false);
  const [flash, setFlash] = useState(0);
  const next = base.map((p) => applyChange(p, pct, dir, rounding));
  const before = applied ? (history[history.length - 1] ?? base) : base;
  const after = applied ? base : next;

  // Tocar un control vuelve a la vista previa.
  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setApplied(false);
    };
  const setPct = edit(setPctRaw);
  const setDir = edit(setDirRaw);
  const setRounding = edit(setRoundingRaw);

  const apply = () => {
    setHistory((h) => [...h, base]);
    setBase(next);
    setApplied(true);
    setFlash((n) => n + 1);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setBase(prev);
    setHistory((h) => h.slice(0, -1));
    setApplied(false);
    setFlash((n) => n + 1);
  };

  return (
    <PanelWindow path="Catálogo › Precios › Cambiar precios">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Subir o bajar"
            value={dir}
            onChange={setDir}
            options={[
              { value: "up", label: "Subir" },
              { value: "down", label: "Bajar" },
            ]}
          />
          <span className="text-[13px] text-adm-fg-muted">en</span>
          <span className="inline-flex h-9 items-center rounded-adm border border-adm-input-border px-3 text-[13px] font-medium">Ropa de mujer · 64 variantes</span>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${id}-pct`} className="text-[13px] font-medium">
              Porcentaje
            </label>
            <output htmlFor={`${id}-pct`} className="tnum text-[20px] font-semibold">
              {pct} %
            </output>
          </div>
          <input
            id={`${id}-pct`}
            type="range"
            min={1}
            max={30}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="lp-range"
            style={{ "--lp-fill": `${((pct - 1) / 29) * 100}%`, "--lp-track": "var(--eco-niebla-2)" } as CSSProperties}
          />
        </div>
        <Segmented label="Redondeo" value={rounding} onChange={setRounding} options={ROUNDING} />
      </div>
      <table className="w-full text-[13px]">
        <caption className="sr-only">Vista previa de los precios nuevos</caption>
        <thead>
          <tr className="border-y border-adm-border bg-adm-table-head text-left text-[12px] text-adm-fg-muted">
            <th scope="col" className="px-4 py-2 font-medium">
              Producto
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium max-sm:hidden">
              {applied ? "Antes" : "Ahora"}
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              {applied ? "Ahora" : "Queda en"}
            </th>
          </tr>
        </thead>
        <tbody>
          {PRICE_ROWS.map((r, i) => (
            <tr key={`${r.name}-${flash}`} className={cn("border-b border-adm-border last:border-b-0", flash > 0 && "lp-flash")}>
              <th scope="row" className="max-w-0 truncate px-4 py-2.5 text-left font-normal">
                {r.name}
              </th>
              <td className={cn("tnum px-2 py-2.5 text-right whitespace-nowrap text-adm-fg-muted max-sm:hidden", applied && "line-through")}>
                <TweenMoney value={before[i]} />
              </td>
              <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                <TweenMoney value={after[i]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-border bg-adm-surface-2 px-4 py-3">
        <p className="text-[13px] text-adm-fg-muted" aria-live="polite">
          {applied ? (
            <span className="text-adm-fg">Precios actualizados en 64 variantes.</span>
          ) : (
            "Vista previa: todavía no cambió nada."
          )}
        </p>
        <div className="flex gap-2">
          {history.length ? (
            <button
              type="button"
              onClick={undo}
              className="inline-flex h-9 items-center gap-1.5 rounded-adm border border-adm-input-border bg-adm-surface px-3 text-[13px] font-medium hover:bg-adm-hover max-sm:min-h-11"
            >
              <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
              Deshacer
            </button>
          ) : null}
          <button
            type="button"
            onClick={apply}
            className="inline-flex h-9 items-center rounded-adm bg-adm-accent px-3.5 text-[13px] font-medium text-adm-accent-fg hover:bg-adm-accent-hover max-sm:min-h-11"
          >
            Aplicar a 64 variantes
          </button>
        </div>
      </div>
    </PanelWindow>
  );
}

/* ------------------------------------------------------------------ */
/* Catálogo: variantes y stock                                          */
/* ------------------------------------------------------------------ */

const SIZES = ["S", "M", "L", "XL"] as const;
const COLORS = [
  { id: "negro", label: "Negro", swatch: "#1d1d1f" },
  { id: "blanco", label: "Blanco", swatch: "#f4f4f2" },
  { id: "arena", label: "Arena", swatch: "#d9c7a7" },
] as const;
type ColorId = (typeof COLORS)[number]["id"];
const INITIAL_STOCK: Record<ColorId, number[]> = { negro: [2, 8, 5, 0], blanco: [4, 3, 3, 1], arena: [0, 6, 2, 4] };

function stockBadge(n: number) {
  if (n === 0) return <Badge tone="red">Agotado</Badge>;
  if (n <= 3) return <Badge tone="amber">Quedan {n}</Badge>;
  return <Badge tone="green">En stock</Badge>;
}

export function CatalogDemo() {
  const [color, setColor] = useState<ColorId>("negro");
  const [stock, setStock] = useState(INITIAL_STOCK);
  const total = Object.values(stock).flat().reduce((a, b) => a + b, 0);
  const row = stock[color];
  const colorLabel = COLORS.find((c) => c.id === color)?.label ?? "";

  const bump = (i: number, delta: number) =>
    setStock((s) => ({ ...s, [color]: s[color].map((n, j) => (j === i ? Math.max(0, Math.min(99, n + delta)) : n)) }));

  return (
    <PanelWindow path="Catálogo › Productos › Remera básica de algodón">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">Remera básica de algodón</p>
          <p className="tnum text-[12px] text-adm-fg-muted">
            {formatMoney(12900)} · 12 variantes · <TweenInt value={total} /> u. en stock
          </p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Color" className="flex gap-2 px-4 pt-3">
        {COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === color}
            onClick={() => setColor(c.id)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors duration-[140ms] max-sm:min-h-11",
              c.id === color ? "border-adm-fg bg-adm-fg text-white" : "border-adm-input-border hover:bg-adm-hover",
            )}
          >
            <span aria-hidden className="size-3 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.18)]" style={{ background: c.swatch }} />
            {c.label}
          </button>
        ))}
      </div>
      <ul className="mt-3 border-t border-adm-border">
        {SIZES.map((size, i) => (
          <li key={size} className="flex items-center gap-3 border-b border-adm-border px-4 py-2 last:border-b-0">
            <span className="w-16 text-[13px] font-medium">
              Talle {size}
            </span>
            <span className="flex-1">{stockBadge(row[i])}</span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => bump(i, -1)}
                disabled={row[i] === 0}
                className="flex size-9 items-center justify-center rounded-adm border border-adm-input-border hover:bg-adm-hover disabled:opacity-40 max-sm:size-11"
              >
                <Minus className="size-3.5" strokeWidth={2} aria-hidden />
                <span className="sr-only">
                  Restar 1 al talle {size} {colorLabel}
                </span>
              </button>
              <TweenInt value={row[i]} className="w-8 text-center text-[14px] font-semibold" />
              <button
                type="button"
                onClick={() => bump(i, 1)}
                className="flex size-9 items-center justify-center rounded-adm border border-adm-input-border hover:bg-adm-hover max-sm:size-11"
              >
                <Plus className="size-3.5" strokeWidth={2} aria-hidden />
                <span className="sr-only">
                  Sumar 1 al talle {size} {colorLabel}
                </span>
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-adm-border bg-adm-surface-2 px-4 py-3">
        <p className="text-[12px] text-adm-fg-muted">Así lo ve tu cliente en la ficha</p>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-live="polite">
          {SIZES.map((size, i) => (
            <span
              key={size}
              className={cn(
                "inline-flex h-8 min-w-10 items-center justify-center rounded-[8px] border px-2 text-[13px] font-medium",
                row[i] === 0 ? "border-dashed border-adm-input-border text-adm-fg-subtle line-through" : "border-adm-fg bg-adm-surface",
              )}
            >
              {size}
              <span className="sr-only">{row[i] === 0 ? " (agotado)" : ""}</span>
            </span>
          ))}
          {row.some((n) => n > 0 && n <= 3) ? (
            <span className="ml-1 self-center text-[12px] text-adm-fg-muted">
              Últimas unidades en {SIZES.filter((_, i) => row[i] > 0 && row[i] <= 3).join(", ")}
            </span>
          ) : null}
        </div>
      </div>
    </PanelWindow>
  );
}

/* ------------------------------------------------------------------ */
/* Checkout que termina en el mensaje de WhatsApp                       */
/* ------------------------------------------------------------------ */

const CART = [
  { name: "Remera oversize negra", variantTitle: "M", qty: 1, total: 18900 },
  { name: "Pantalón wide beige", variantTitle: "38", qty: 1, total: 26500 },
];
const DELIVERY = {
  ship: { label: "Envío a domicilio", detail: "CABA · 24 a 48 h", price: 3200, line: "Envío a Av. Corrientes 4120, CABA" },
  pickup: { label: "Retiro en el local", detail: "Thames 1580, Palermo", price: 0, line: "Retiro en el local: Thames 1580, Palermo" },
} as const;
const PAYMENT = {
  transfer: { label: "Transferencia", detail: "10 % de descuento", pct: 10 },
  agree: { label: "Acordar con el vendedor", detail: "Lo hablan por WhatsApp", pct: 0 },
} as const;

function Choice({ name, checked, onChange, title, detail, aside }: { name: string; checked: boolean; onChange: () => void; title: string; detail: string; aside?: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2 transition-colors duration-[140ms] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-eco-azul",
        checked ? "border-adm-fg bg-adm-surface" : "border-adm-border bg-adm-surface hover:border-adm-input-border",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="size-4 accent-[var(--eco-ink)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="block text-[12px] text-adm-fg-muted">{detail}</span>
      </span>
      {aside ? <span className="tnum text-[13px]">{aside}</span> : null}
    </label>
  );
}

export function CheckoutDemo({ storeName, orderUrl }: { storeName: string; orderUrl: string }) {
  const id = useId();
  const [delivery, setDelivery] = useState<keyof typeof DELIVERY>("ship");
  const [payment, setPayment] = useState<keyof typeof PAYMENT>("transfer");
  const [customer, setCustomer] = useState("Rosa Quiroga");
  const [number, setNumber] = useState(1042);
  const [sent, setSent] = useState(false);

  const subtotal = CART.reduce((a, i) => a + i.total, 0);
  const discount = Math.round((subtotal * PAYMENT[payment].pct) / 100);
  const total = subtotal - discount + DELIVERY[delivery].price;
  const message = buildOrderMessage({
    number,
    storeName,
    customerName: customer.trim() || "Rosa",
    items: CART,
    total,
    delivery: DELIVERY[delivery].line,
    url: orderUrl,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PanelWindow path={`${storeName} › Finalizar compra`}>
        <div className="space-y-3 p-4">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-adm-fg-muted uppercase">Entrega</legend>
            {(Object.keys(DELIVERY) as (keyof typeof DELIVERY)[]).map((k) => (
              <Choice
                key={k}
                name={`${id}-delivery`}
                checked={delivery === k}
                onChange={() => setDelivery(k)}
                title={DELIVERY[k].label}
                detail={DELIVERY[k].detail}
                aside={DELIVERY[k].price ? formatMoney(DELIVERY[k].price) : "Gratis"}
              />
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-adm-fg-muted uppercase">Pago</legend>
            {(Object.keys(PAYMENT) as (keyof typeof PAYMENT)[]).map((k) => (
              <Choice key={k} name={`${id}-payment`} checked={payment === k} onChange={() => setPayment(k)} title={PAYMENT[k].label} detail={PAYMENT[k].detail} />
            ))}
          </fieldset>
          <div>
            <label htmlFor={`${id}-name`} className="text-[12px] font-semibold tracking-[0.06em] text-adm-fg-muted uppercase">
              Tu nombre
            </label>
            <input
              id={`${id}-name`}
              value={customer}
              maxLength={40}
              onChange={(e) => setCustomer(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-[12px] border border-adm-input-border bg-adm-surface px-3 text-[14px] focus:border-eco-azul focus:outline-none focus-visible:ring-2 focus-visible:ring-eco-azul/30"
            />
          </div>
          <div className="flex items-center justify-between border-t border-adm-border pt-3">
            <span className="text-[13px] text-adm-fg-muted">
              Total{discount ? <span className="tnum"> (− {formatMoney(discount)})</span> : null}
            </span>
            <TweenMoney value={total} className="text-[18px] font-semibold" />
          </div>
          <button
            type="button"
            onClick={() => {
              setNumber((n) => (sent ? n + 1 : n));
              setSent(true);
            }}
            className="flex h-11 w-full items-center justify-center rounded-full bg-eco-ink text-[14px] font-semibold text-white transition-transform duration-[140ms] active:scale-[0.98]"
          >
            Confirmar pedido
          </button>
        </div>
      </PanelWindow>

      <div className="lp-rings flex min-w-0 flex-col rounded-adm-lg bg-eco-niebla-2 p-3 shadow-[0_0_0_1px_var(--eco-line)] [--lp-rings-at:100%_100%]">
        <p className="flex items-center gap-2 px-1 pb-2 text-[12px] font-medium text-eco-ink">
          <span className="flex size-7 items-center justify-center rounded-full bg-eco-durazno text-[11px] font-semibold text-eco-ink">RQ</span>
          <span>
            {customer.trim() || "Rosa"}
            <span className="block text-[11px] font-normal text-eco-text-muted">en tu WhatsApp</span>
          </span>
        </p>
        <div className="flex-1 space-y-2" aria-live="polite">
          <div key={number} className={cn("eco-bubble w-[94%] bg-eco-paper px-3 py-2 text-[12.5px] leading-snug text-eco-ink shadow-[0_6px_16px_-10px_rgb(16_22_47/0.4)]", sent && "eco-pop")}>
            <p className="whitespace-pre-line break-words">{message}</p>
            <p className="mt-1 text-right text-[11px] text-eco-text-muted">{sent ? "ahora" : "vista previa"}</p>
          </div>
        </div>
        {sent ? (
          <p className="eco-pop mt-2 flex items-center gap-1.5 px-1 text-[12px] text-eco-ink">
            <Badge tone="amber">Pendiente</Badge> Pedido #{number} registrado en tu panel.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Zonas de envío dibujadas en el mapa                                  */
/* ------------------------------------------------------------------ */

const ZONES = [
  { id: "caba", label: "CABA", price: 3200, eta: "24 a 48 h", d: "M200 100 L262 92 L266 150 L214 160 L196 132 Z", at: [228, 134] },
  { id: "norte", label: "GBA Norte", price: 4800, eta: "48 a 72 h", d: "M110 20 L258 12 L262 92 L200 100 L150 82 L120 60 Z", at: [196, 54] },
  { id: "oeste", label: "GBA Oeste", price: 4800, eta: "48 a 72 h", d: "M30 80 L120 60 L150 82 L200 100 L196 132 L170 180 L40 172 Z", at: [108, 126] },
  { id: "sur", label: "GBA Sur", price: 5200, eta: "48 a 72 h", d: "M170 180 L196 132 L214 160 L266 150 L272 252 L120 252 Z", at: [212, 212] },
] as const;
type ZoneId = (typeof ZONES)[number]["id"];

export function ZonesDemo() {
  const [zone, setZone] = useState<ZoneId>("caba");
  const [pickup, setPickup] = useState(true);
  const current = ZONES.find((z) => z.id === zone) ?? ZONES[0];

  return (
    <PanelWindow path="Configuración › Envíos › Zonas">
      <div className="grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="relative min-h-[220px] border-adm-border bg-eco-niebla-2 max-sm:border-b sm:border-r">
          <svg viewBox="0 0 360 260" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
            <path d="M258 0 H360 V260 H272 C268 220 270 180 266 150 C264 120 262 100 262 92 Z" fill="var(--eco-azul-soft)" />
            <text x="314" y="140" textAnchor="middle" fontSize="10" fill="var(--eco-azul-dark)" fontStyle="italic">
              Río de la Plata
            </text>
            {ZONES.map((z) => {
              const on = z.id === zone;
              return (
                <g key={z.id} onClick={() => setZone(z.id)} className="lp-zone">
                  <path
                    d={z.d}
                    fill={on ? "var(--eco-pomelo-soft)" : "var(--eco-paper)"}
                    stroke={on ? "var(--eco-pomelo-ink)" : "var(--eco-bruma)"}
                    strokeWidth={on ? 2.5 : 1}
                    strokeLinejoin="round"
                  />
                  <text x={z.at[0]} y={z.at[1]} textAnchor="middle" fontSize="11" fontWeight={on ? 700 : 500} fill="var(--eco-ink)">
                    {z.label}
                  </text>
                </g>
              );
            })}
            {pickup ? (
              <g transform="translate(250 106)">
                <circle r="8" fill="var(--eco-ink)" />
                <circle r="3" fill="var(--eco-pomelo)" />
              </g>
            ) : null}
          </svg>
        </div>
        <div className="flex flex-col">
          <ul className="flex-1">
            {ZONES.map((z) => (
              <li key={z.id} className="border-b border-adm-border">
                <button
                  type="button"
                  aria-pressed={z.id === zone}
                  onClick={() => setZone(z.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition-colors duration-[140ms]",
                    z.id === zone ? "bg-adm-accent-2-soft" : "hover:bg-adm-hover",
                  )}
                >
                  <span>
                    <span className="font-medium">{z.label}</span>
                    <span className="block text-[12px] text-adm-fg-muted">{z.eta}</span>
                  </span>
                  <span className="tnum">{formatMoney(z.price)}</span>
                </button>
              </li>
            ))}
          </ul>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-[13px]">
            <span className="flex items-center gap-2">
              <Store className="size-4 text-adm-fg-muted" strokeWidth={1.75} aria-hidden />
              Retiro en el local
            </span>
            <input type="checkbox" role="switch" checked={pickup} onChange={(e) => setPickup(e.target.checked)} className="size-4 accent-[var(--eco-ink)]" />
          </label>
        </div>
      </div>
      <p className="flex items-center gap-2 border-t border-adm-border bg-adm-surface-2 px-4 py-3 text-[13px]" aria-live="polite">
        <Truck className="size-4 shrink-0 text-adm-fg-muted" strokeWidth={1.75} aria-hidden />
        <span>
          En el checkout: <span className="font-medium">Envío a {current.label}</span> ·{" "}
          <TweenMoney value={current.price} className="font-semibold" /> · llega en {current.eta}
          {pickup ? " · o retiro gratis" : ""}
        </span>
      </p>
    </PanelWindow>
  );
}

import { ArrowRight, Banknote, ClipboardCheck, Clock, PackageMinus, Truck, Undo2, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/money";

import { DrawnCheck } from "./DrawnCheck";

import "./dashboard.css";

export type TodoKey = "confirm" | "ship" | "unpaid" | "expiring" | "withdrawals" | "stock";

export interface TodoItem {
  key: TodoKey;
  count: number;
  label: string;
  /** Para el resumen del encabezado ("3 por confirmar"). */
  short: string;
  hint: string;
  href: string;
  /** Texto del destino ("Ver pedidos"). */
  go: string;
}

const ICONS: Record<TodoKey, LucideIcon> = {
  confirm: ClipboardCheck,
  ship: Truck,
  unpaid: Banknote,
  expiring: Clock,
  withdrawals: Undo2,
  stock: PackageMinus,
};

/**
 * "Para hacer" (DESIGN §7.8): sólo lo que tiene pendientes, en orden de
 * urgencia. La primera es la burbuja pomelo (lo que hay que resolver ya); el
 * resto, tarjetas chicas con el número grande. Cada una lleva a la vista ya
 * filtrada: un toque desde el inicio (BRAND §11).
 */
export function TodoBoard({ items }: { items: TodoItem[] }) {
  const [first, ...rest] = items;
  return (
    <section aria-labelledby="para-hacer">
      <h2 id="para-hacer" className="mb-2.5 text-[15px] font-semibold text-adm-fg">
        Para hacer
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {first ? (
          <li className={cn("col-span-2", rest.length ? "lg:col-span-1 lg:row-span-2" : "lg:col-span-3")}>
            <FeaturedTodo item={first} wide={!rest.length} />
          </li>
        ) : null}
        {rest.map((t, i) => (
          <li key={t.key} className={cn("min-w-0", rest.length % 2 === 1 && i === rest.length - 1 && "max-lg:col-span-2")}>
            <SmallTodo item={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeaturedTodo({ item, wide }: { item: TodoItem; wide: boolean }) {
  const Icon = ICONS[item.key];
  return (
    <Link
      href={item.href}
      className="dsh-lift eco-bubble group relative flex h-full min-h-40 flex-col overflow-hidden bg-adm-accent-2-soft p-4 [--eco-bubble-r:24px] sm:p-5"
    >
      {/* Arco de marca en la esquina: nítido, plano. */}
      <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute -right-10 -bottom-12 size-40 text-eco-durazno">
        <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="12" />
      </svg>
      <span className="relative flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-adm-accent-2-ink uppercase">
        <Icon aria-hidden className="size-3.5" strokeWidth={2} />
        Primero esto
      </span>
      <span className={cn("relative mt-auto flex gap-x-4 gap-y-1 pt-4", wide ? "flex-wrap items-end" : "flex-col")}>
        <span className="eco-num text-[52px] leading-[0.9] text-adm-fg">{formatNumber(item.count)}</span>
        <span className="min-w-0">
          <span className="block text-[15px] leading-5 font-semibold text-adm-fg">{item.label}</span>
          <span className="mt-0.5 block text-[13px] text-adm-fg">{item.hint}</span>
        </span>
      </span>
      <span className="relative mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-adm-fg px-3 py-1.5 text-[13px] font-medium text-white">
        {item.go}
        <ArrowRight aria-hidden className="dsh-go size-3.5" />
      </span>
    </Link>
  );
}

function SmallTodo({ item }: { item: TodoItem }) {
  const Icon = ICONS[item.key];
  return (
    <Link
      href={item.href}
      className="dsh-lift group flex h-full min-h-24 flex-col rounded-adm-lg border border-adm-border bg-adm-surface p-3.5 shadow-adm-card hover:border-adm-input-border sm:p-4"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="eco-num text-[30px] leading-none text-adm-fg">{formatNumber(item.count)}</span>
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-adm-fg-muted" strokeWidth={1.75} />
      </span>
      <span className="mt-2 flex items-end gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] leading-[18px] font-semibold text-adm-fg">{item.label}</span>
          <span className="mt-0.5 hidden text-xs text-adm-fg-muted sm:block">{item.hint}</span>
        </span>
        <ArrowRight aria-hidden className="dsh-go size-4 shrink-0 text-adm-fg-muted" />
      </span>
    </Link>
  );
}

/** Sin pendientes: el "al día" con un check que se dibuja. */
export function AllClear({ hasOrders }: { hasOrders: boolean }) {
  return (
    <section aria-labelledby="para-hacer" className="flex items-center gap-4 rounded-adm-lg border border-adm-border bg-adm-surface p-4 shadow-adm-card sm:p-5">
      <span aria-hidden className="eco-bubble inline-flex size-14 shrink-0 items-center justify-center bg-eco-durazno text-adm-fg [--eco-bubble-r:20px]">
        <DrawnCheck className="size-7" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <h2 id="para-hacer" className="eco-display text-[20px] leading-6 text-adm-fg">
          Estás al día
        </h2>
        <p className="mt-1 text-[13px] text-adm-fg-muted">
          {hasOrders
            ? "No hay pedidos por confirmar ni por despachar, ni avisos de stock. Buen momento para compartir tu tienda."
            : "Todavía no entró ningún pedido. Compartí el link para que lleguen los primeros."}
        </p>
      </div>
    </section>
  );
}

"use client";

import { Check, ChevronsUpDown, LayoutGrid, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { cn } from "@/lib/cn";
import { setActiveStore } from "@/lib/tenant/actions";

export interface SwitcherStore {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface StoreSwitcherProps {
  stores: SwitcherStore[];
  active: { id: string; name: string; slug: string };
  /** Superadmin operando una tienda ajena. */
  impersonating?: boolean;
  /**
   * - `topbar` (default): pastilla sobre la barra superior tinta de mobile.
   * - `sidebar`: fila de la tarjeta de la tienda en el sidebar (inicial + nombre);
   *   con el sidebar contraído queda sólo la inicial.
   */
  variant?: "topbar" | "sidebar";
}

function Initial({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("eco-display inline-flex shrink-0 items-center justify-center rounded-[10px] bg-eco-mist text-eco-ink", className)}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/**
 * Selector de tienda: tiendas del usuario, "Crear otra tienda" y "Mis
 * tiendas". Cambiar de tienda fija la cookie y recarga el panel. En
 * escritorio vive en la tarjeta de la tienda del sidebar; en mobile, en la
 * barra superior.
 */
export function StoreSwitcher({ stores, active, impersonating, variant = "topbar" }: StoreSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (id: string) => {
    if (id === active.id) return;
    startTransition(async () => {
      const res = await setActiveStore(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.push("/admin");
      router.refresh();
    });
  };

  const adminTag = impersonating ? (
    <span className="rounded-full bg-eco-pomelo/15 px-1.5 text-[10px] font-semibold tracking-[0.04em] text-eco-pomelo uppercase">admin</span>
  ) : null;

  const trigger =
    variant === "sidebar" ? (
      <button
        type="button"
        aria-label={`Tienda activa: ${active.name}. Cambiar de tienda`}
        title={active.name}
        className={cn(
          "flex w-full min-w-0 items-center gap-2.5 rounded-[12px] p-1.5 text-left transition-colors duration-[140ms] hover:bg-white/[0.06] group-data-[collapsed]/sidebar:justify-center group-data-[collapsed]/sidebar:p-0",
          pending && "opacity-60",
        )}
      >
        <Initial name={active.name} className="size-8 text-[15px] group-data-[collapsed]/sidebar:size-9" />
        <span className="flex min-w-0 flex-1 items-center gap-1.5 group-data-[collapsed]/sidebar:hidden">
          <span className="truncate text-sm font-semibold text-white">{active.name}</span>
          {adminTag}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-adm-sidebar-muted group-data-[collapsed]/sidebar:hidden" aria-hidden />
      </button>
    ) : (
      <button
        type="button"
        aria-label={`Tienda activa: ${active.name}. Cambiar de tienda`}
        className={cn(
          "inline-flex h-9 w-full max-w-full min-w-0 items-center gap-2 rounded-full bg-white/[0.07] py-1 pr-2.5 pl-1 text-sm font-semibold text-white ring-1 ring-white/10 transition-colors duration-[140ms] ring-inset hover:bg-white/[0.12] sm:w-auto sm:max-w-[240px] pointer-coarse:h-10",
          pending && "opacity-60",
        )}
      >
        <Initial name={active.name} className="size-7 rounded-full text-[13px] pointer-coarse:size-8" />
        <span className="min-w-0 flex-1 truncate text-left">{active.name}</span>
        {adminTag}
        <ChevronsUpDown className="size-3.5 shrink-0 text-adm-sidebar-muted" aria-hidden />
      </button>
    );

  return (
    <DropdownMenu align="start" width={256} trigger={trigger} triggerClassName={variant === "sidebar" ? "flex w-full" : undefined}>
      <DropdownLabel>Tus tiendas</DropdownLabel>
      {stores.map((s) => (
        <DropdownItem
          key={s.id}
          onSelect={() => choose(s.id)}
          disabled={pending}
          icon={s.id === active.id ? <Check className="!text-adm-link" /> : <span className="size-4" />}
        >
          <span className="flex min-w-0 flex-col">
            <span className={cn("truncate", s.id === active.id && "font-medium")}>{s.name}</span>
            <span className="truncate text-[11px] text-adm-fg-muted">{s.slug}</span>
          </span>
        </DropdownItem>
      ))}
      <DropdownSeparator />
      <DropdownItem href="/app/nueva" icon={<Plus />}>
        Crear otra tienda
      </DropdownItem>
      <DropdownItem href="/app" icon={<LayoutGrid />}>
        Mis tiendas
      </DropdownItem>
    </DropdownMenu>
  );
}

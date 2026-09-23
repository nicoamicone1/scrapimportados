"use client";

import { Check, ChevronsUpDown, LayoutGrid, Plus, Store } from "lucide-react";
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
}

/**
 * Selector de tienda del topbar: tiendas del usuario, "Crear otra tienda" y
 * "Mis tiendas". Cambiar de tienda fija la cookie y recarga el panel.
 */
export function StoreSwitcher({ stores, active, impersonating }: StoreSwitcherProps) {
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

  return (
    <DropdownMenu
      align="start"
      width={248}
      trigger={
        <button
          type="button"
          aria-label={`Tienda activa: ${active.name}. Cambiar de tienda`}
          className={cn(
            "inline-flex h-8 max-w-[200px] items-center gap-1.5 rounded-adm border border-adm-border bg-adm-surface px-2 text-[13px] font-medium text-adm-fg hover:bg-adm-surface-2",
            pending && "opacity-60",
          )}
        >
          <Store className="size-3.5 shrink-0 text-adm-fg-muted" aria-hidden />
          <span className="truncate">{active.name}</span>
          {impersonating ? <span className="rounded-[3px] bg-adm-accent-2-soft px-1 text-[10px] text-adm-accent-2-ink">admin</span> : null}
          <ChevronsUpDown className="size-3.5 shrink-0 text-adm-fg-muted" aria-hidden />
        </button>
      }
    >
      <DropdownLabel>Tus tiendas</DropdownLabel>
      {stores.map((s) => (
        <DropdownItem
          key={s.id}
          onSelect={() => choose(s.id)}
          disabled={pending}
          icon={s.id === active.id ? <Check /> : <span className="size-4" />}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{s.name}</span>
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

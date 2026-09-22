"use client";

import Link from "next/link";
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

/*
 * Menú desplegable accesible (patrón WAI-ARIA "menu button"), sin librería:
 * flechas ↑↓, Home/End, Esc devuelve el foco al disparador, Tab cierra,
 * click afuera cierra. Se posiciona `fixed` respecto del disparador para no
 * quedar recortado dentro de tablas con overflow.
 */

interface MenuContextValue {
  close: () => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

type TriggerProps = HTMLAttributes<HTMLElement> & {
  "aria-haspopup"?: "menu";
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
};

export interface DropdownMenuProps {
  /** Elemento disparador (normalmente un `<Button>`). Se le inyectan onClick y aria-*. */
  trigger: ReactElement<TriggerProps>;
  children: ReactNode;
  align?: "start" | "end";
  width?: number;
  className?: string;
}

export function DropdownMenu({ trigger, children, align = "end", width = 208, className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const triggerEl = () => wrapperRef.current?.firstElementChild as HTMLElement | null;

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerEl()?.focus();
  }, []);

  const place = useCallback(() => {
    const el = triggerEl();
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight ?? 0;
    const below = r.bottom + 4 + menuH <= window.innerHeight || r.top < menuH;
    const left = align === "end" ? r.right - width : r.left;
    setPos({
      top: below ? r.bottom + 4 : r.top - 4 - menuH,
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
    });
  }, [align, width]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
    items?.[0]?.focus();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !wrapperRef.current?.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
    );
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger, {
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? menuId : undefined,
        onClick: (e: React.MouseEvent<HTMLElement>) => {
          trigger.props.onClick?.(e);
          setOpen((o) => !o);
        },
        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
          trigger.props.onKeyDown?.(e);
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        },
      })
    : trigger;

  return (
    <MenuContext.Provider value={{ close: () => close() }}>
      <span ref={wrapperRef} className="inline-flex">
        {triggerNode}
      </span>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
          className={cn(
            "fixed z-50 rounded-adm border border-adm-border bg-adm-surface p-1 text-sm text-adm-fg shadow-[var(--adm-shadow)]",
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </MenuContext.Provider>
  );
}

const itemClass =
  "flex h-8 w-full cursor-pointer items-center gap-2 rounded-[4px] px-2 text-left text-sm outline-none select-none focus:bg-adm-surface-2 hover:bg-adm-surface-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-adm-fg-muted";

export interface DropdownItemProps {
  children: ReactNode;
  onSelect?: () => void;
  href?: string;
  icon?: ReactNode;
  /** Atajo a la derecha (texto o `<Kbd>`). */
  shortcut?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export function DropdownItem({ children, onSelect, href, icon, shortcut, danger, disabled }: DropdownItemProps) {
  const ctx = useContext(MenuContext);
  const cls = cn(itemClass, danger && "text-adm-danger [&_svg]:text-adm-danger");
  const content = (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut ? <span className="text-xs text-adm-fg-muted">{shortcut}</span> : null}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} role="menuitem" tabIndex={-1} className={cls} onClick={() => ctx?.close()}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      className={cls}
      onClick={() => {
        if (disabled) return;
        ctx?.close();
        onSelect?.();
      }}
    >
      {content}
    </button>
  );
}

export function DropdownSeparator() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-adm-border" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-adm-fg-muted uppercase">{children}</div>;
}

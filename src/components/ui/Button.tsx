import { Loader2 } from "lucide-react";
import Link from "next/link";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-adm font-medium select-none transition-[background-color,border-color,color] duration-100 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-adm-accent text-adm-accent-fg hover:bg-adm-accent-hover",
  secondary: "border border-adm-input-border bg-adm-surface text-adm-fg hover:bg-adm-hover",
  ghost: "text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg",
  danger: "bg-adm-danger text-white hover:bg-[#9a1d13]",
  link: "h-auto px-0 text-adm-accent underline-offset-2 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[13px]",
  md: "h-8 px-3 text-sm",
  lg: "h-9 px-3.5 text-sm",
  icon: "size-8",
  "icon-sm": "size-7",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], variant === "link" ? "" : sizes[size], className);
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Muestra spinner y deshabilita. */
  loading?: boolean;
  /** Icono a la izquierda (lucide, 16px). */
  icon?: ReactNode;
  /** Icono a la derecha. */
  iconRight?: ReactNode;
}

export type ButtonProps = CommonProps & ComponentPropsWithoutRef<"button">;

/**
 * Botón del admin. Variantes: primary (acción principal, una por vista),
 * secondary (default), ghost, danger (destructivas), link.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, icon, iconRight, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

export type ButtonLinkProps = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & {
    href: string;
    /** Abre en pestaña nueva (link externo). */
    external?: boolean;
  };

/** Link con apariencia de botón (navegación). */
export function ButtonLink({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  iconRight,
  className,
  children,
  href,
  external,
  ...props
}: ButtonLinkProps) {
  const cls = buttonClass(variant, size, className);
  const content = (
    <>
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...props}>
      {content}
    </Link>
  );
}

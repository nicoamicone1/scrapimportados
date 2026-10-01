import { Loader2 } from "lucide-react";
import Link from "next/link";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

/*
 * Pantallas táctiles (`pointer-coarse`, BRAND §7 y §11): los botones crecen a
 * 44 px (md/lg/icon) o 36 px (sm/icon-sm), y un área invisible (`::before`)
 * lleva el objetivo táctil a ≥ 44 px sin mover el layout. En desktop quedan
 * las densidades de DESIGN §7.2 (28 / 32 / 36 px).
 */
const base =
  "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-adm font-medium select-none transition-[background-color,border-color,color] duration-[120ms] ease-eco-out disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 pointer-coarse:before:absolute pointer-coarse:before:-inset-1 pointer-coarse:before:content-['']";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-adm-accent text-adm-accent-fg shadow-adm-card hover:bg-adm-accent-hover",
  secondary:
    "border border-adm-input-border bg-adm-surface text-adm-fg shadow-adm-card hover:border-adm-input-border-hover hover:bg-adm-hover",
  ghost: "text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg",
  danger: "bg-adm-danger text-white shadow-adm-card hover:bg-adm-danger-hover",
  /** Ámbar: CTAs de onboarding / "empezá por acá". Una por pantalla como mucho. */
  accent: "bg-adm-accent-2 text-adm-accent-2-fg shadow-adm-card hover:bg-adm-accent-2-hover",
  /** Link de texto: pino y subrayado (BRAND §10: pino vs. tinta no llega a 3:1, el color solo no alcanza). */
  link: "h-auto px-0 text-adm-accent underline underline-offset-2 hover:no-underline",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[13px] pointer-coarse:h-9",
  md: "h-8 px-3 text-sm pointer-coarse:h-11 pointer-coarse:px-4",
  lg: "h-9 px-3.5 text-sm pointer-coarse:h-11 pointer-coarse:px-4",
  icon: "size-8 pointer-coarse:size-11",
  "icon-sm": "size-7 pointer-coarse:size-9",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], variant === "link" ? "" : sizes[size], className);
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Muestra spinner y deshabilita. */
  loading?: boolean;
  /** Texto mientras `loading` ("Guardando…"). Si falta, se mantiene el label. */
  loadingText?: ReactNode;
  /** Icono a la izquierda (lucide, 16px). */
  icon?: ReactNode;
  /** Icono a la derecha. */
  iconRight?: ReactNode;
}

export type ButtonProps = CommonProps & ComponentPropsWithoutRef<"button">;

/**
 * Botón del admin. Variantes: primary (pino; acción principal, una por vista),
 * secondary (default), ghost, danger (destructivas), accent (ámbar; CTAs de
 * onboarding), link. Dentro de un `<form>` con server action usá
 * `<SubmitButton>` (pending automático con `useFormStatus`).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    loadingText,
    icon,
    iconRight,
    className,
    children,
    disabled,
    type = "button",
    ...props
  },
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
      {loading && loadingText ? loadingText : children}
      {loading ? null : iconRight}
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
  loadingText,
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
      {loading && loadingText ? loadingText : children}
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

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
/*
 * Movimiento (BRAND §9): color y borde en 140 ms con la curva de la marca;
 * al apretar, el botón se hunde apenas (escala 0,97, sin demorar el clic).
 */
const base =
  "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-adm font-medium select-none transition-[background-color,border-color,color,box-shadow,transform] duration-[140ms] ease-eco-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-busy:cursor-progress [&_svg]:size-4 [&_svg]:shrink-0 pointer-coarse:before:absolute pointer-coarse:before:-inset-1 pointer-coarse:before:content-['']";

const variants: Record<ButtonVariant, string> = {
  /** Tinta: la acción principal de la vista (una por pantalla). */
  primary: "bg-adm-accent text-adm-accent-fg hover:bg-adm-accent-hover",
  /** Blanco con borde suave: el texto identifica el botón; el borde se afirma al hover. */
  secondary:
    "border border-adm-input-border/45 bg-adm-surface text-adm-fg shadow-adm-card hover:border-adm-input-border hover:bg-adm-hover",
  ghost: "text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg",
  /** Carmín: sólo confirmaciones destructivas con el verbo exacto. */
  danger: "bg-adm-danger text-white hover:bg-adm-danger-hover",
  /** Pomelo con texto tinta: "empezá por acá" y "Guardar" de la SaveBar. Uno por pantalla como mucho. */
  accent: "bg-adm-accent-2 font-semibold text-adm-accent-2-fg hover:bg-adm-accent-2-hover",
  /** Link de texto: azul de interacción y subrayado (BRAND §5.3). */
  link: "h-auto px-0 text-adm-link underline decoration-1 underline-offset-[3px] hover:text-adm-link-hover hover:decoration-2 active:scale-100",
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
 * Botón del admin (BRAND §10). Variantes: primary (tinta; acción principal,
 * una por vista), secondary (default), ghost, danger (carmín; destructivas),
 * accent (pomelo con texto tinta; "empezá por acá"), link (azul). Radio 10 px.
 * Dentro de un `<form>` con server action usá
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

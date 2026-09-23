import type { ReactNode } from "react";

import { StoreLink } from "@/components/store/StoreLink";
import { cn } from "@/lib/cn";
import { isDarkTheme, type Theme } from "@/lib/theme";

/**
 * Botón/link del storefront (DESIGN.md §3.4) sobre la clase `.sbtn` de
 * `blocks.css`. `primary` usa el estilo del tema; `secondary` es el
 * siguiente más callado (solid → outline; outline/soft → link subrayado).
 * `onImage`: sobre una foto oscurecida (hero/banner).
 */
export type StoreButtonVariant = "primary" | "secondary" | "onImage" | "solid" | "link";

export function buttonAttrs(theme: Theme, variant: StoreButtonVariant = "primary") {
  const style = theme.buttons.style;
  const dark = isDarkTheme(theme);
  let btn: string;
  switch (variant) {
    case "solid":
      btn = "solid";
      break;
    case "link":
      btn = "link";
      break;
    case "secondary":
      btn = style === "solid" ? "outline" : "link";
      break;
    case "onImage":
      btn = dark ? "solid" : "inverse";
      break;
    default:
      btn = style;
  }
  return {
    "data-btn": btn,
    "data-upper": theme.buttons.uppercase && btn !== "link" ? "" : undefined,
    "data-glow": btn === "solid" && dark && theme.effects.shadows !== "none" ? "" : undefined,
  } as const;
}

function isExternal(href: string) {
  return /^(https?:)?\/\//i.test(href) || /^(mailto|tel):/i.test(href);
}

export function StoreButtonLink({
  theme,
  href,
  variant = "primary",
  className,
  children,
}: {
  theme: Theme;
  href: string;
  variant?: StoreButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  const attrs = buttonAttrs(theme, variant);
  if (isExternal(href)) {
    return (
      <a href={href} className={cn("sbtn", className)} {...attrs} {...(/^https?:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {children}
      </a>
    );
  }
  return (
    <StoreLink href={href || "/"} className={cn("sbtn", className)} {...attrs}>
      {children}
    </StoreLink>
  );
}

/** Link genérico: externo con `<a>`, interno con `StoreLink` (prefijo de la tienda). */
export function SmartLink({ href, className, children, ariaLabel }: { href: string; className?: string; children: ReactNode; ariaLabel?: string }) {
  if (isExternal(href)) {
    return (
      <a href={href} className={className} aria-label={ariaLabel} {...(/^https?:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {children}
      </a>
    );
  }
  return (
    <StoreLink href={href || "/"} className={className} aria-label={ariaLabel}>
      {children}
    </StoreLink>
  );
}

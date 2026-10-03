import type { ReactNode } from "react";

import { ACCOUNT_TITLE, AccountAside, AccountShell, PanelGlimpse } from "@/components/platform/AccountShell";

/**
 * Marco de las pantallas sin sesión del panel. Hoy el ingreso, el registro
 * y el alta viven en el sitio (`/login`, `/registro`, `/app/nueva`, con
 * `AccountShell`); este componente queda por compatibilidad y dibuja lo
 * mismo: formulario a la izquierda y la hoja tinta con la captura real del
 * panel a la derecha (BRAND §4.3, §7.2).
 *
 * - `title` / `subtitle`: encabezado del formulario (opcional: los forms que
 *   ya traen su `<h1>` no lo pasan).
 * - `aside`: dato real debajo de la frase ("699 productos publicados").
 * - `storeName`: nombre de la tienda, como eyebrow de la hoja.
 * - `panelTitle`: reemplaza la frase de la hoja (ej. en el onboarding).
 */
export function AuthLayout({
  title,
  subtitle,
  aside,
  storeName,
  panelTitle,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  storeName?: string;
  panelTitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AccountShell
      aside={
        <AccountAside
          eyebrow={storeName ?? "Panel de tu tienda"}
          title={panelTitle ?? "Catálogo, precios y pedidos en un solo lugar."}
          points={aside ? [aside] : undefined}
          visual={<PanelGlimpse />}
        />
      }
    >
      {title ? (
        <div className="mb-8">
          <h1 className={ACCOUNT_TITLE}>{title}</h1>
          {subtitle ? <p className="mt-3 text-[15px] leading-relaxed text-adm-fg-muted">{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </AccountShell>
  );
}

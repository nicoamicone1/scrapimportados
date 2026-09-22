/**
 * Remitos imprimibles: fuera del grupo `(panel)` para no heredar el shell
 * del admin (sidebar/topbar). Sólo queda el `.admin-root` del layout de
 * /admin (tokens y Toaster). La autorización la hace la página.
 */
export default function PrintLayout({ children }: LayoutProps<"/admin/pedidos/imprimir">) {
  return <div className="remito-root min-h-dvh bg-[#e9e7e2] print:bg-white">{children}</div>;
}

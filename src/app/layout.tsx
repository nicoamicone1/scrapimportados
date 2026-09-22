import type { Metadata } from "next";

import { APP_NAME } from "@/lib/version";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

/** Layout raíz mínimo: el storefront y el admin tienen sus propios layouts. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}

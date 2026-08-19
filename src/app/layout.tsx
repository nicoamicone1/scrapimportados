import type { Metadata } from "next";

import CartDrawer from "../components/CartDrawer";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { CartProvider } from "../lib/cart";
import { BRAND_NAME } from "../lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "Catálogo de productos con precios en efectivo y precio web actualizados.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-page text-ink">
        <CartProvider>
          <Header />

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-8">
            {children}
          </main>

          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}

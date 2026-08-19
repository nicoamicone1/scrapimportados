import type { Metadata } from "next";
import Link from "next/link";

import CartView from "../../components/CartView";

export const metadata: Metadata = {
  title: "Carrito",
  description: "Tu pedido, listo para enviar por WhatsApp.",
};

export default function CarritoPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <nav className="text-xs">
        <Link
          href="/productos/"
          className="font-semibold text-brand-700 underline-offset-4 transition hover:text-brand-900 hover:underline"
        >
          ← Seguir comprando
        </Link>
      </nav>

      <div className="flex items-center gap-2">
        <span
          className="h-7 w-1.5 shrink-0 rounded-full bg-accent-500"
          aria-hidden="true"
        />
        <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          Tu carrito
        </h1>
      </div>

      <CartView variant="page" />
    </div>
  );
}

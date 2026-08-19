import Link from "next/link";

import { formatDateAR } from "../lib/format";
import { BRAND_NAME, whatsappLink } from "../lib/config";
import { getCatalog } from "../lib/products";

/** Server Component: lee el catálogo en build time. */
export default function Footer() {
  const { scrapedAt } = getCatalog();

  return (
    <footer className="mt-10 bg-ink text-white/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-9 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <p className="text-base font-extrabold tracking-tight text-white">
            {BRAND_NAME}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed">
            Catálogo con precio <span className="font-semibold text-white">Efectivo</span>{" "}
            y <span className="font-semibold text-white">Precio web</span>. Armá
            tu pedido y lo cerramos por WhatsApp.
          </p>

          <a
            href={whatsappLink("Hola! Quiero hacer una consulta sobre el catálogo.")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 0 1 12 4zm-3.4 4c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.2.2 1.8 2.9 4.5 4 2.2.9 2.7.7 3.2.7.5 0 1.5-.6 1.7-1.2.2-.6.2-1.2.1-1.3l-.6-.3s-1.4-.7-1.6-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1.1-.4-2-1.3-.8-.7-1.3-1.5-1.4-1.7-.1-.2 0-.4.1-.5l.4-.5.3-.5v-.5l-.8-1.9c-.2-.5-.4-.5-.6-.5z" />
            </svg>
            Escribinos por WhatsApp
          </a>
        </div>

        <nav className="flex flex-col gap-2 text-xs" aria-label="Enlaces del pie">
          <Link href="/" className="transition hover:text-white">
            Inicio
          </Link>
          <Link href="/productos/" className="transition hover:text-white">
            Todos los productos
          </Link>
          <Link href="/carrito/" className="transition hover:text-white">
            Mi carrito
          </Link>
        </nav>

        <div className="text-xs sm:text-right">
          <p>Precios actualizados el {formatDateAR(scrapedAt)}</p>
          <p className="mt-1 font-semibold text-white/90">
            Precios sujetos a confirmación.
          </p>
        </div>
      </div>
    </footer>
  );
}

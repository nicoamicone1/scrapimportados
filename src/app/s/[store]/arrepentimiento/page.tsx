import type { Metadata } from "next";

import { StoreLink } from "@/components/store/StoreLink";
import { requireStore } from "@/lib/store/context";
import { getStoreDisplay } from "@/lib/store/display";
import { buildMetadata } from "@/lib/store/seo";

import { WithdrawalForm } from "./WithdrawalForm";

type Props = PageProps<"/s/[store]/arrepentimiento">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store } = await requireStore(params);
  const { settings } = await getStoreDisplay(store.id);
  return buildMetadata({
    store,
    title: "Botón de arrepentimiento",
    description: `Revocá tu compra en ${settings.name} dentro de los 10 días corridos, sin registrarte.`,
    path: "/arrepentimiento",
    siteName: settings.name,
  });
}

/** Botón de arrepentimiento (Res. SCI 424/2020, P0-14). */
export default async function WithdrawalPage({ params, searchParams }: Props) {
  const { store } = await requireStore(params);
  const [{ settings }, sp] = await Promise.all([getStoreDisplay(store.id), searchParams]);
  const order = typeof sp.pedido === "string" && /^\d{1,10}$/.test(sp.pedido) ? sp.pedido : "";
  return (
    <div className="store-container py-[var(--space-section-sm)]">
      <div className="max-w-[68ch]">
        <h1 className="h-page">Botón de arrepentimiento</h1>
        <p className="mt-3">
          Podés revocar la compra dentro de los <strong>10 días corridos</strong> desde que recibiste el producto o desde que se celebró el contrato, lo
          último que ocurra, sin costo y sin explicar el motivo (art. 34 de la Ley 24.240 y Resolución 424/2020 de la Secretaría de Comercio Interior).
        </p>
        <p className="mt-2 text-fg-muted">
          No hace falta registrarse. Al enviar el formulario te mostramos un código de revocación y {settings.name} te contacta dentro de las 24 horas.
          {settings.policies.returns_md ? (
            <>
              {" "}
              Más información en{" "}
              <StoreLink href="/politicas/cambios-y-devoluciones" className="link">
                Cambios y devoluciones
              </StoreLink>
              .
            </>
          ) : null}
        </p>
      </div>
      <WithdrawalForm defaultOrder={order} />
    </div>
  );
}

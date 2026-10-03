"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { mpPaymentSummary, mpStatusDetailText, mpStatusKind, type MpPaymentDetailView } from "@/lib/store/mercadopago-labels";

import { startOrderPayment } from "../../actions";

const POLL_MS = 4000;
const POLL_MAX_MS = 60_000;

/**
 * Pago con Mercado Pago en la página del pedido (docs/PAYMENTS.md §6).
 * `back` es la vuelta de MP (`?pago=ok|pendiente|error`): sólo orienta el
 * mensaje; el estado real es el del pedido (lo marca el webhook).
 */
export function MercadoPagoPayment({
  token,
  paid,
  cancelled,
  back,
  detail,
  totalLabel,
  installmentsHint,
}: {
  token: string;
  paid: boolean;
  cancelled: boolean;
  back: string | null;
  detail: MpPaymentDetailView | null;
  totalLabel: string;
  installmentsHint: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const kind = mpStatusKind(detail?.status);
  const confirming = !paid && !cancelled && back === "ok" && kind !== "rejected";

  // Volvió de MP aprobado pero el webhook todavía no llegó: refrescar un rato.
  useEffect(() => {
    if (!confirming) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - started > POLL_MAX_MS) {
        window.clearInterval(id);
        setTimedOut(true);
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [confirming, router]);

  const pay = async () => {
    setPending(true);
    setError(null);
    const r = await startOrderPayment(token);
    if (!r.ok) {
      setPending(false);
      setError(r.error);
      return;
    }
    window.location.assign(r.data.paymentUrl);
  };

  if (paid) {
    const summary = detail ? mpPaymentSummary(detail) : null;
    return (
      <section className="mt-6 rounded-lg border border-border bg-surface p-5" aria-labelledby="pago-mp" role="status">
        <h2 id="pago-mp" className="font-body text-base font-semibold tracking-normal normal-case text-success">
          ¡Listo! Tu pago está acreditado
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{summary ? `Pagaste con ${summary}.` : "Pagaste con Mercado Pago."} Te mandamos la confirmación por mail.</p>
      </section>
    );
  }
  if (cancelled) return null;

  const rejected = kind === "rejected" || (back === "error" && kind !== "review");
  const review = !rejected && (kind === "review" || back === "pendiente");
  const reason = rejected || review ? mpStatusDetailText(detail?.statusDetail) : null;

  let title = `Pagá ${totalLabel} con Mercado Pago`;
  let text = installmentsHint ?? "Con tarjeta de crédito, débito o dinero en tu cuenta.";
  if (confirming) {
    title = timedOut ? "Tu pago se está acreditando" : "Estamos confirmando tu pago…";
    text = timedOut
      ? "Mercado Pago está tardando un poco más. Te avisamos por mail apenas se acredite; no hace falta que pagues de nuevo."
      : "Mercado Pago nos avisa en unos segundos. No cierres esta página.";
  } else if (review) {
    title = "Tu pago está en revisión";
    text = reason ?? "Mercado Pago está revisando el pago. Te avisamos por mail cuando se acredite; no hace falta que pagues de nuevo.";
  } else if (rejected) {
    title = "No se pudo cobrar el pago";
    text = reason ?? "Mercado Pago rechazó el pago. Probá con otra tarjeta o en menos cuotas.";
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-5" aria-labelledby="pago-mp">
      <div aria-live="polite">
        <h2 id="pago-mp" className={`font-body text-base font-semibold tracking-normal normal-case ${rejected ? "text-danger" : ""}`}>
          {confirming && !timedOut ? <Loader2 className="mr-2 inline size-4 animate-spin align-[-2px]" aria-hidden /> : null}
          {title}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{text}</p>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {!confirming && !review ? (
        <button type="button" className="btn btn-solid btn-block mt-4" onClick={pay} disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {pending ? "Te llevamos a Mercado Pago…" : rejected ? "Reintentar el pago" : "Pagar con Mercado Pago"}
        </button>
      ) : null}
    </section>
  );
}

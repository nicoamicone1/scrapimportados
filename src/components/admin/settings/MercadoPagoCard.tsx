"use client";

import { CreditCard, ExternalLink } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { disconnectMercadoPago, saveMercadoPagoSettings } from "@/app/admin/(panel)/configuracion/pagos/mercadopago-actions";
import { toast } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, FormSection } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { formatDate } from "@/lib/dates";
import type { MercadoPagoAdminState } from "@/lib/payments/admin";
import { FREE_INSTALLMENT_OPTIONS, installmentLabel } from "@/lib/payments/installments";

/** Tarifas de referencia de Mercado Pago (AR, oct-2026, + IVA). Sólo orientativas. */
const MP_RATES = [
  { term: "Al instante", rate: "6,29 %" },
  { term: "A 10 días", rate: "4,39 %" },
  { term: "A 18 días", rate: "3,39 %" },
  { term: "A 35 días", rate: "1,49 %" },
];

const ERRORS: Record<string, string> = {
  cancelado: "Cancelaste la conexión en Mercado Pago.",
  vencido: "La conexión tardó demasiado o se abrió en otra pestaña. Probá de nuevo.",
  sesion: "Volvé a entrar a Ecommy con tu cuenta y probá de nuevo.",
  solo_duenio: "Sólo el dueño de la tienda, con su cuenta, puede conectar Mercado Pago.",
  no_configurado: "El cobro con Mercado Pago todavía no está habilitado en Ecommy.",
  mercadopago: "Mercado Pago no respondió como esperábamos. Probá de nuevo en unos minutos.",
  guardar: "No pudimos guardar la conexión. Probá de nuevo.",
};

export function MercadoPagoCard({ state, currency, locale }: { state: MercadoPagoAdminState; currency: string; locale: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const shown = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    max_installments: String(state.settings.max_installments),
    free_installments: String(state.settings.free_installments),
    binary_mode: state.settings.binary_mode,
    statement_descriptor: state.settings.statement_descriptor,
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (shown.current) return;
    const mp = params.get("mp");
    if (!mp) return;
    shown.current = true;
    if (mp === "conectado") toast.success("Mercado Pago conectado. Ya podés cobrar con tarjeta.");
    else if (mp === "error") toast.error(ERRORS[params.get("motivo") ?? ""] ?? "No se pudo conectar Mercado Pago.");
    router.replace("/admin/configuracion/pagos", { scroll: false });
  }, [params, router]);

  const account = state.account;
  const connected = account?.status === "connected";
  const free = Number(values.free_installments) || 0;
  const example = installmentLabel(60000, free, { currency, locale });
  const dirty =
    values.max_installments !== String(state.settings.max_installments) ||
    values.free_installments !== String(state.settings.free_installments) ||
    values.binary_mode !== state.settings.binary_mode ||
    values.statement_descriptor !== state.settings.statement_descriptor;

  const save = async () => {
    setSaving(true);
    try {
      const r = await saveMercadoPagoSettings(values);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      setErrors({});
      toast.success("Cuotas guardadas");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-6 max-w-5xl px-5 md:px-6">
      <FormSection
        eyebrow="Cobro online"
        title="Tarjetas y cuotas con Mercado Pago"
        description="Tus clientes pagan con crédito, débito o dinero en cuenta, en cuotas. La plata entra directo a tu cuenta de Mercado Pago."
      >
        {!state.migrated ? (
          <p className="rounded-adm bg-adm-surface-2/60 p-3 text-[13px] text-adm-fg-muted">
            Falta actualizar la base de datos de la tienda (migración 0023). Avisale al soporte de Ecommy.
          </p>
        ) : !state.enabled ? (
          <p className="rounded-adm bg-adm-surface-2/60 p-3 text-[13px] text-adm-fg-muted">
            Muy pronto vas a poder conectar tu cuenta de Mercado Pago desde acá. Si lo necesitás ya, escribinos.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-adm border border-adm-border p-3">
              <span className="inline-flex size-9 items-center justify-center rounded-adm bg-adm-surface-2 text-adm-fg-muted" aria-hidden>
                <CreditCard className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {connected ? "Cuenta conectada" : account?.status === "error" ? "Hay que volver a conectar" : "Sin conectar"}
                  {connected ? <Badge tone="green">Cobrando</Badge> : account?.status === "error" ? <Badge tone="red">Error</Badge> : null}
                  {connected && !account?.liveMode ? <Badge tone="amber">Modo prueba</Badge> : null}
                </div>
                <p className="text-xs text-adm-fg-muted">
                  {connected
                    ? `Cuenta de Mercado Pago #${account?.mpUserId ?? "—"}${account?.connectedAt ? ` · desde el ${formatDate(account.connectedAt)}` : ""}`
                    : account?.status === "error"
                      ? (account.lastError ?? "La conexión dejó de funcionar.")
                      : "Conectás tu cuenta en un paso: Mercado Pago te pide que confirmes y volvés acá."}
                </p>
              </div>
              {state.isOwner ? (
                connected ? (
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                    Desconectar
                  </Button>
                ) : (
                  <a href={state.connectUrl} className={buttonClass("primary", "sm")}>
                    {account?.status === "error" ? "Volver a conectar" : "Conectar Mercado Pago"}
                  </a>
                )
              ) : (
                <span className="text-xs text-adm-fg-muted">Sólo el dueño de la tienda puede {connected ? "desconectarla" : "conectarla"}.</span>
              )}
            </div>

            {state.planFeePercent > 0 ? (
              <p className="text-[13px] text-adm-fg-muted">
                Con tu plan, Ecommy cobra {String(state.planFeePercent).replace(".", ",")} % de cada venta pagada online. Se descuenta en Mercado Pago, aparte de su comisión.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cuotas máximas" hint="Las que puede elegir el comprador en Mercado Pago." error={errors.max_installments?.[0]}>
                <Select value={values.max_installments} onChange={(e) => setValues({ ...values, max_installments: e.target.value })}>
                  {[1, 3, 6, 9, 12, 18, 24].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "Sólo en un pago" : `Hasta ${n} cuotas`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Cuotas sin interés que ofrecés"
                hint={free ? `En la tienda se muestra: «${example}» (ej. en $60.000).` : "No se muestra nada en la tienda."}
                error={errors.free_installments?.[0]}
              >
                <Select value={values.free_installments} onChange={(e) => setValues({ ...values, free_installments: e.target.value })}>
                  {FREE_INSTALLMENT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "No ofrezco" : `${n} cuotas sin interés`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="space-y-2 rounded-adm bg-adm-surface-2/60 p-3 text-[13px]">
              <p className="font-medium">Cómo activar las cuotas sin interés</p>
              <ol className="list-decimal space-y-1 pl-5 text-adm-fg-muted">
                <li>Entrá a tu cuenta de Mercado Pago › <strong className="text-adm-fg">Costos y cuotas</strong>.</li>
                <li>
                  En <strong className="text-adm-fg">Por ofrecer cuotas</strong>, activá <strong className="text-adm-fg">Cuotas sin interés</strong> y elegí
                  cuántas.
                </li>
                <li>Elegí acá el mismo número, así la tienda lo anuncia en cada producto.</li>
              </ol>
              <p className="text-adm-fg-muted">
                El costo de las cuotas sin interés lo pagás vos: Mercado Pago te lo descuenta de cada venta. Muchos comercios lo compensan con un descuento
                por transferencia para quien paga de contado.
              </p>
              <a
                href="https://www.mercadopago.com.ar/costs-section"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-adm-link underline-offset-2 hover:underline"
              >
                Abrir Costos y cuotas <ExternalLink className="size-3" aria-hidden />
              </a>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium">Comisión de Mercado Pago por cobrar con tarjeta de crédito</p>
              <table className="w-full max-w-sm text-[13px]">
                <caption className="sr-only">Comisión según el plazo en que recibís el dinero</caption>
                <tbody>
                  {MP_RATES.map((r) => (
                    <tr key={r.term} className="border-b border-adm-border last:border-b-0">
                      <th scope="row" className="py-1.5 text-left font-normal text-adm-fg-muted">
                        {r.term}
                      </th>
                      <td className="tnum py-1.5 text-right">{r.rate} + IVA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-adm-fg-muted">
                Valores de referencia de Mercado Pago a octubre de 2026; verificá los tuyos en tu cuenta. Para pagar menos comisión, elegí recibir el dinero a
                más días en Costos y cuotas.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nombre en el resumen de la tarjeta"
                hint="Hasta 13 letras o números. Vacío = el nombre de la tienda."
                error={errors.statement_descriptor?.[0]}
              >
                <Input
                  value={values.statement_descriptor}
                  maxLength={13}
                  onChange={(e) => setValues({ ...values, statement_descriptor: e.target.value })}
                  placeholder="MITIENDA"
                />
              </Field>
              <Field label="Sólo pagos aprobados al instante" hint="Evita pagos «en revisión»: o se aprueba o se rechaza en el momento.">
                <div className="flex h-9 items-center">
                  <Switch
                    checked={values.binary_mode}
                    onCheckedChange={(on) => setValues({ ...values, binary_mode: on })}
                    aria-label="Sólo pagos aprobados al instante"
                  />
                </div>
              </Field>
            </div>

            <div className="flex items-center justify-end gap-3">
              {dirty ? <span className="text-xs text-adm-fg-muted">Tenés cambios sin guardar</span> : null}
              <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!dirty}>
                Guardar cuotas
              </Button>
            </div>
          </>
        )}
      </FormSection>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="¿Desconectar Mercado Pago?"
        description={`Tus clientes dejan de poder pagar con tarjeta hasta que la vuelvas a conectar. Los pedidos ya pagados no cambian${
          state.settings.free_installments ? "; la tienda deja de anunciar cuotas sin interés" : ""
        }.`}
        confirmLabel="Desconectar"
        destructive
        onConfirm={async () => {
          const r = await disconnectMercadoPago();
          if (!r.ok) return void toast.error(r.error);
          toast.success("Mercado Pago desconectado");
          router.refresh();
        }}
      />
    </Card>
  );
}


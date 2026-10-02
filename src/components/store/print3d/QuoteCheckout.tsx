"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { useStorePath } from "@/components/store/StoreBase";
import { StoreLink } from "@/components/store/StoreLink";
import { quoteShippingAction, type ShippingQuoteResult } from "@/app/s/[store]/actions";
import { Field, StepShell, type Step } from "@/app/s/[store]/checkout/CheckoutFlow";
import { checkoutPrint3dQuote } from "@/app/s/[store]/impresion-3d/actions";
import { formatMoney, roundMoney } from "@/lib/money";
import { PROVINCE_OPTIONS } from "@/lib/shipping/provinces";
import { waLink } from "@/lib/store/whatsapp";

/*
 * Checkout de una cotización 3D: los mismos 4 pasos y campos que el checkout
 * del carrito (`CheckoutFlow`, del que reusa `Field` y `StepShell`), sin
 * carrito, cupones ni promos. El envío se cotiza con `quoteShippingAction`
 * sobre el total de la cotización; la RPC recalcula todo al confirmar.
 */

interface Method {
  code: string;
  name: string;
  type: string;
  discountPercent: number;
  instructions: string;
}

interface Pickup {
  id: string;
  name: string;
  address: string;
  hours: string;
}

export interface QuoteCheckoutProps {
  token: string;
  /** Total de la cotización (mercadería): base del envío gratis y del descuento por medio de pago. */
  quoteTotal: number;
  paymentMethods: Method[];
  pickups: Pickup[];
  hasZones: boolean;
  requirePhone: boolean;
  notesEnabled: boolean;
  whatsappPhone: string;
  termsHref: string | null;
}

interface Customer {
  name: string;
  email: string;
  phone: string;
  doc: string;
}

interface Address {
  street: string;
  number: string;
  floor: string;
  city: string;
  province: string;
  postal_code: string;
  notes: string;
}

const EMPTY_ADDRESS: Address = { street: "", number: "", floor: "", city: "", province: "", postal_code: "", notes: "" };
/** Mismo guardado local que el checkout del carrito: el comprador no vuelve a tipear sus datos. */
const SAVED_KEY = "ecommy-checkout-v1";

function readSaved(): { customer?: Partial<Customer>; address?: Partial<Address> } {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as { customer?: Partial<Customer>; address?: Partial<Address> }) : {};
  } catch {
    return {};
  }
}

export function QuoteCheckout(props: QuoteCheckoutProps) {
  const { paymentMethods, pickups, hasZones, quoteTotal } = props;
  const router = useRouter();
  const toPath = useStorePath();
  const uid = useId();

  const [step, setStep] = useState<Step>(1);
  const [saved] = useState(readSaved);
  const [customer, setCustomer] = useState<Customer>({ name: "", email: "", phone: "", doc: "", ...saved.customer });
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(hasZones || !pickups.length ? "delivery" : "pickup");
  const [address, setAddress] = useState<Address>({ ...EMPTY_ADDRESS, ...saved.address, notes: "" });
  const [pickupId, setPickupId] = useState<string>(pickups[0]?.id ?? "");
  const [quote, setQuote] = useState<ShippingQuoteResult | null>(null);
  const [quoteKey, setQuoteKey] = useState("");
  const [methodCode, setMethodCode] = useState(paymentMethods[0]?.code ?? "");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  const addressKey = JSON.stringify([address.street, address.number, address.city, address.province, address.postal_code]);
  const quoteValid = fulfillment === "delivery" && quote !== null && quoteKey === addressKey;
  const noCoverage = quoteValid && !quote?.zone;
  const whatsappMethod = paymentMethods.find((m) => m.type === "whatsapp");
  const availableMethods = noCoverage ? paymentMethods.filter((m) => m.type === "whatsapp") : paymentMethods;
  const method = availableMethods.find((m) => m.code === methodCode) ?? availableMethods[0] ?? null;

  const shippingCost = fulfillment === "delivery" && quoteValid && quote?.zone ? quote.cost : 0;
  const totalFor = (m: Method | null) => {
    const discount = m && step >= 3 ? roundMoney((quoteTotal * m.discountPercent) / 100) : 0;
    return { discount, total: roundMoney(quoteTotal - discount + shippingCost) };
  };
  const totals = totalFor(method);
  const shippingLabel =
    fulfillment === "pickup"
      ? "Retiro gratis"
      : quoteValid && quote?.zone
        ? shippingCost === 0
          ? "Gratis"
          : formatMoney(shippingCost)
        : noCoverage
          ? "A coordinar"
          : "Se calcula con tu dirección";

  const validateCustomer = (): boolean => {
    const e: Record<string, string> = {};
    if (customer.name.trim().length < 2) e.name = "Ingresá tu nombre y apellido.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email.trim())) e.email = "Revisá el email: tiene que tener el formato nombre@dominio.com.";
    const digits = customer.phone.replace(/\D/g, "");
    if (props.requirePhone && !digits) e.phone = "Ingresá tu teléfono con código de área.";
    else if (digits && (digits.length < 8 || digits.length > 15)) e.phone = "Revisá el teléfono: tiene que tener código de área (ej. 11 5555 1234).";
    if (customer.doc && !/^\d{7,11}$/.test(customer.doc.replace(/[.\-\s]/g, ""))) e.doc = "Revisá el DNI o CUIT: sólo números (7 a 11).";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const validateAddress = (): boolean => {
    const e: Record<string, string> = {};
    if (address.street.trim().length < 2) e.street = "Ingresá la calle.";
    if (!address.number.trim()) e.number = "Ingresá la altura (o S/N).";
    if (address.city.trim().length < 2) e.city = "Ingresá la ciudad o localidad.";
    if (!address.province) e.province = "Elegí la provincia.";
    if (!/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/.test(address.postal_code.trim())) e.postal_code = "Revisá el código postal: 4 números (ej. 1425).";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const calculateShipping = () => {
    if (!validateAddress()) return;
    setFormError(null);
    startQuote(async () => {
      const res = await quoteShippingAction({ address, subtotal: quoteTotal });
      if (res.ok) {
        setQuote(res.data);
        setQuoteKey(addressKey);
      } else {
        setFormError(res.error);
        if (res.fieldErrors) setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k.replace(/^address\./, ""), v[0]])));
      }
    });
  };

  const confirm = async () => {
    if (!method || submitting) return;
    setSubmitting(true);
    setFormError(null);
    const popup = method.type === "whatsapp" ? window.open("", "_blank") : null;
    const res = await checkoutPrint3dQuote({
      token: props.token,
      customer,
      fulfillment,
      address: fulfillment === "delivery" ? address : null,
      pickupLocationId: fulfillment === "pickup" ? pickupId : null,
      paymentMethodCode: method.code,
      notes,
    });
    if (!res.ok) {
      popup?.close();
      setSubmitting(false);
      setFormError(res.error);
      return;
    }
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify({ customer, address: { ...address, notes: "" } }));
    } catch {
      // sin storage
    }
    if (popup) {
      if (res.data.whatsappUrl) popup.location.href = res.data.whatsappUrl;
      else popup.close();
    }
    router.push(toPath(`/pedido/${res.data.token}?nuevo=1`));
  };

  const set = <K extends keyof Customer>(k: K) => (e: React.ChangeEvent<HTMLInputElement>) => setCustomer((c) => ({ ...c, [k]: e.target.value }));
  const setAddr = <K extends keyof Address>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddress((a) => ({ ...a, [k]: e.target.value }));
  const provinceLabel = PROVINCE_OPTIONS.find((p) => p.value === address.province)?.label ?? address.province;
  const pickup = pickups.find((p) => p.id === pickupId);
  const deliverySummary =
    fulfillment === "pickup"
      ? `Retirás en ${pickup?.name ?? "el local"}${pickup?.address ? ` · ${pickup.address}` : ""}`
      : `${[address.street, address.number, address.floor].filter(Boolean).join(" ")}, ${address.city}, ${provinceLabel} · ${
          quote?.zone ? `${quote.zone.name} · ${shippingLabel}` : "envío a coordinar"
        }`;

  return (
    <div>
      <StepShell n={1} title="Tus datos" step={step} onEdit={() => setStep(1)} summary={`${customer.name} · ${customer.email}${customer.phone ? ` · ${customer.phone}` : ""}`}>
        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (validateCustomer()) setStep(2);
          }}
        >
          <Field id={`${uid}-name`} label="Nombre y apellido" error={errors.name} className="sm:col-span-2">
            {(p) => <input {...p} className="input" autoComplete="name" value={customer.name} onChange={set("name")} />}
          </Field>
          <Field id={`${uid}-email`} label="Email" error={errors.email} help="Te mandamos el pedido y cómo va la impresión." className="sm:col-span-2">
            {(p) => <input {...p} type="email" className="input" autoComplete="email" inputMode="email" value={customer.email} onChange={set("email")} />}
          </Field>
          <Field id={`${uid}-phone`} label={props.requirePhone ? "Teléfono (WhatsApp)" : "Teléfono (opcional)"} error={errors.phone} help="Con código de área, ej. 11 5555 1234.">
            {(p) => <input {...p} type="tel" className="input" autoComplete="tel" inputMode="tel" value={customer.phone} onChange={set("phone")} />}
          </Field>
          <Field id={`${uid}-doc`} label="DNI o CUIT (opcional)" error={errors.doc}>
            {(p) => <input {...p} className="input" inputMode="numeric" value={customer.doc} onChange={set("doc")} />}
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary w-full sm:w-auto">
              Continuar
            </button>
          </div>
        </form>
      </StepShell>

      <StepShell n={2} title="Entrega" step={step} onEdit={() => setStep(2)} summary={deliverySummary}>
        <div className="space-y-3" role="radiogroup" aria-label="Cómo recibís el pedido">
          {hasZones || whatsappMethod || !pickups.length ? (
            <label className="choice">
              <input type="radio" name="fulfillment" value="delivery" checked={fulfillment === "delivery"} onChange={() => setFulfillment("delivery")} />
              <span className="flex-1">
                <span className="block font-medium">Te lo llevamos</span>
                <span className="block text-sm text-fg-muted">
                  {quoteValid && quote?.zone
                    ? `${quote.zone.name}${quote.zone.eta ? `, llega en ${quote.zone.eta} desde que está listo` : ""} · ${shippingLabel}`
                    : "Calculamos el costo con tu dirección"}
                </span>
              </span>
            </label>
          ) : null}
          {pickups.map((p) => (
            <label key={p.id} className="choice">
              <input
                type="radio"
                name="fulfillment"
                value={p.id}
                checked={fulfillment === "pickup" && pickupId === p.id}
                onChange={() => {
                  setFulfillment("pickup");
                  setPickupId(p.id);
                }}
              />
              <span className="flex-1">
                <span className="flex justify-between gap-3">
                  <span className="font-medium">Retirás en {p.name}</span>
                  <span className="text-sm text-success">Gratis</span>
                </span>
                {p.address ? <span className="block text-sm text-fg-muted">{p.address}</span> : null}
                {p.hours ? <span className="block text-xs text-fg-muted">{p.hours}</span> : null}
              </span>
            </label>
          ))}
        </div>

        {fulfillment === "delivery" ? (
          <form
            noValidate
            className="mt-5 grid grid-cols-6 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              calculateShipping();
            }}
          >
            <Field id={`${uid}-street`} label="Calle" error={errors.street} className="col-span-6 sm:col-span-4">
              {(p) => <input {...p} className="input" autoComplete="address-line1" value={address.street} onChange={setAddr("street")} />}
            </Field>
            <Field id={`${uid}-number`} label="Altura" error={errors.number} className="col-span-3 sm:col-span-2">
              {(p) => <input {...p} className="input" inputMode="numeric" value={address.number} onChange={setAddr("number")} />}
            </Field>
            <Field id={`${uid}-floor`} label="Piso / depto (opcional)" className="col-span-3 sm:col-span-2">
              {(p) => <input {...p} className="input" autoComplete="address-line2" value={address.floor} onChange={setAddr("floor")} />}
            </Field>
            <Field id={`${uid}-city`} label="Ciudad o localidad" error={errors.city} className="col-span-6 sm:col-span-4">
              {(p) => <input {...p} className="input" autoComplete="address-level2" value={address.city} onChange={setAddr("city")} />}
            </Field>
            <Field id={`${uid}-province`} label="Provincia" error={errors.province} className="col-span-6 sm:col-span-4">
              {(p) => (
                <select {...p} className="input" autoComplete="address-level1" value={address.province} onChange={setAddr("province")}>
                  <option value="">Elegí la provincia</option>
                  {PROVINCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field id={`${uid}-cp`} label="Código postal" error={errors.postal_code} className="col-span-6 sm:col-span-2">
              {(p) => <input {...p} className="input uppercase" autoComplete="postal-code" value={address.postal_code} onChange={setAddr("postal_code")} />}
            </Field>
            <Field id={`${uid}-addr-notes`} label="Indicaciones para la entrega (opcional)" className="col-span-6">
              {(p) => <input {...p} className="input" placeholder="Timbre, entre calles, horario" value={address.notes} onChange={setAddr("notes")} />}
            </Field>

            {quoteValid ? (
              quote?.zone ? (
                <p className="col-span-6 rounded-md border border-border p-3 text-sm" role="status">
                  <span className="font-medium">Te lo llevamos</span> — {quote.zone.name} · {shippingLabel}
                </p>
              ) : (
                <div className="col-span-6 rounded-md border border-border-strong p-3 text-sm" role="status">
                  <p>Todavía no llegamos a tu zona.</p>
                  {whatsappMethod && props.whatsappPhone ? (
                    <p className="mt-1 text-fg-muted">
                      Podés seguir y acordar el envío por WhatsApp, o{" "}
                      <a
                        className="link"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={waLink(props.whatsappPhone, `Hola. ¿Hacen envíos a ${address.city}, ${provinceLabel} (CP ${address.postal_code})?`)}
                      >
                        escribinos antes
                      </a>
                      .
                    </p>
                  ) : pickups.length ? (
                    <p className="mt-1 text-fg-muted">Podés elegir retirar en el local.</p>
                  ) : null}
                </div>
              )
            ) : null}

            <div className="col-span-6">
              {quoteValid && (quote?.zone || whatsappMethod) ? (
                <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={() => setStep(3)}>
                  Continuar
                </button>
              ) : (
                <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={quoting}>
                  {quoting ? "Calculando envío" : "Calcular envío y continuar"}
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="mt-5">
            <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={() => setStep(3)} disabled={!pickupId}>
              Continuar
            </button>
          </div>
        )}
      </StepShell>

      <StepShell n={3} title="Pago" step={step} onEdit={() => setStep(3)} summary={method ? method.name : undefined}>
        <div className="space-y-3" role="radiogroup" aria-label="Cómo pagás">
          {availableMethods.map((m) => {
            const discount = roundMoney((quoteTotal * m.discountPercent) / 100);
            return (
              <label key={m.code} className="choice">
                <input type="radio" name="payment" value={m.code} checked={method?.code === m.code} onChange={() => setMethodCode(m.code)} />
                <span className="flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{m.type === "whatsapp" ? "Acordás el pago con el taller por WhatsApp" : m.name}</span>
                    {m.discountPercent > 0 ? <span className="tnum text-sm text-accent">−{m.discountPercent}&nbsp;%</span> : null}
                  </span>
                  <span className="tnum block text-sm text-fg-muted">Total {formatMoney(roundMoney(quoteTotal - discount + shippingCost))}</span>
                  {m.instructions ? <span className="block text-xs text-fg-muted">{m.instructions}</span> : null}
                </span>
              </label>
            );
          })}
          {!availableMethods.length ? <p className="text-sm text-danger">La tienda no tiene medios de pago activos. Escribinos por WhatsApp.</p> : null}
          {noCoverage ? <p className="text-sm text-fg-muted">Como el envío se coordina por WhatsApp, el pago también.</p> : null}
        </div>
        <div className="mt-5">
          <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={!method} onClick={() => setStep(4)}>
            Continuar
          </button>
        </div>
      </StepShell>

      <StepShell n={4} title="Revisá y confirmá" step={step} onEdit={() => setStep(4)}>
        <dl className="tnum space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-fg-muted">Impresión</dt>
            <dd>{formatMoney(quoteTotal)}</dd>
          </div>
          {totals.discount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-fg-muted">
                {method?.name} ({method?.discountPercent}&nbsp;%)
              </dt>
              <dd className="text-accent">−{formatMoney(totals.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-fg-muted">Envío</dt>
            <dd className={shippingLabel === "Gratis" ? "text-success" : undefined}>{shippingLabel}</dd>
          </div>
        </dl>
        {props.notesEnabled ? (
          <div className="mt-4">
            <label htmlFor={`${uid}-order-notes`} className="field-label">
              Notas para el taller (opcional)
            </label>
            <textarea id={`${uid}-order-notes`} className="input" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        ) : null}
        {formError ? (
          <p className="mt-4 rounded-md border border-danger p-3 text-sm text-danger" role="alert">
            {formError}
          </p>
        ) : null}
        <p className="tnum mt-5 flex items-baseline justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatMoney(totals.total)}</span>
        </p>
        <button type="button" className="btn btn-solid btn-block mt-3" onClick={confirm} disabled={submitting || !method} aria-busy={submitting || undefined}>
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {submitting ? "Confirmando pedido…" : "Confirmar pedido"}
        </button>
        <p className="mt-2 text-xs text-fg-muted">
          {method?.type === "whatsapp" ? "Al confirmar se abre WhatsApp con tu pedido armado. " : "En el próximo paso te mostramos cómo pagar. "}
          Al confirmar aceptás los{" "}
          {props.termsHref ? (
            <StoreLink href={props.termsHref} className="link" target="_blank">
              Términos y condiciones
            </StoreLink>
          ) : (
            "Términos y condiciones"
          )}
          .
        </p>
      </StepShell>
    </div>
  );
}

"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";

import { CouponForm } from "@/components/store/CouponForm";
import { FreeShippingBar } from "@/components/store/FreeShippingBar";
import { useCartSync } from "@/components/store/useCartSync";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { computeCart, type CartTotals, type Promotion } from "@/lib/pricing";
import { PROVINCE_OPTIONS } from "@/lib/shipping/provinces";
import { trackOnce } from "@/lib/store/analytics";
import { netMerchandiseTotal, toPricingItems } from "@/lib/store/cart-pricing";
import { waLink } from "@/lib/store/whatsapp";

import { createOrder, quoteShippingAction, type ShippingQuoteResult } from "../actions";
import { Notices } from "../carrito/CartView";

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

export interface CheckoutFlowProps {
  storeName: string;
  promotions: Promotion[];
  paymentMethods: Method[];
  pickups: Pickup[];
  hasZones: boolean;
  requirePhone: boolean;
  notesEnabled: boolean;
  minOrderTotal: number;
  freeShippingThreshold: number | null;
  freeShippingPartial: boolean;
  whatsappPhone: string;
  termsHref: string | null;
  currency: string;
  /** Precio sin impuestos nacionales (null = no se muestra). */
  net: { defaultVat: number; label: string } | null;
}

type Step = 1 | 2 | 3 | 4;

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

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

function Field({
  label,
  error,
  help,
  children,
  id,
  className,
}: {
  label: string;
  error?: string;
  help?: string;
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
  id: string;
  className?: string;
}) {
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="field-help">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function StepShell({
  n,
  title,
  step,
  summary,
  onEdit,
  children,
}: {
  n: Step;
  title: string;
  step: Step;
  summary?: ReactNode;
  onEdit: () => void;
  children: ReactNode;
}) {
  const active = step === n;
  const done = step > n;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (active && n > 1) headingRef.current?.focus();
  }, [active, n]);
  return (
    <section className="border-b border-border py-5" aria-labelledby={`paso-${n}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id={`paso-${n}`}
          ref={headingRef}
          tabIndex={-1}
          className={cn("font-body text-base font-semibold tracking-normal normal-case outline-none", !active && !done && "text-fg-muted")}
        >
          {n}. {title}
        </h2>
        {done ? (
          <button type="button" onClick={onEdit} className="link text-sm" aria-label={`Editar ${title.toLowerCase()}`}>
            Editar
          </button>
        ) : null}
      </div>
      {done && summary ? <div className="mt-1.5 text-sm text-fg-muted">{summary}</div> : null}
      {active ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

function Summary({
  totals,
  itemErrors,
  shippingLabel,
  paymentName,
  net,
}: {
  net: { defaultVat: number; label: string } | null;
  totals: CartTotals;
  itemErrors: Record<string, string>;
  shippingLabel: string;
  paymentName: string | null;
}) {
  const { items } = useCart();
  const byVariant = new Map(totals.lines.map((l) => [l.variantId, l]));
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const line = byVariant.get(item.variantId);
          const err = itemErrors[item.variantId];
          return (
            <li key={item.variantId} className="flex gap-3 py-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-bg">
                {item.image ? <Image src={item.image} alt="" fill sizes="56px" className="object-contain p-1" /> : null}
                <span className="tnum absolute -top-0 -right-0 rounded-bl-sm bg-fg px-1 text-[11px] text-bg">{item.qty}</span>
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="line-clamp-2">{item.name}</p>
                {item.variantTitle ? <p className="text-xs text-fg-muted">{item.variantTitle}</p> : null}
                {err ? <p className="mt-0.5 text-xs text-danger">{err}</p> : null}
              </div>
              <p className="tnum shrink-0 text-sm">{formatMoney(line?.lineTotal ?? item.unitPrice * item.qty)}</p>
            </li>
          );
        })}
      </ul>
      <dl className="tnum space-y-1.5 border-t border-border pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-fg-muted">Subtotal</dt>
          <dd>{formatMoney(totals.subtotal)}</dd>
        </div>
        {totals.promoTotal > 0 ? (
          <div className="flex justify-between">
            <dt className="text-fg-muted">Promociones</dt>
            <dd className="text-accent">−{formatMoney(totals.promoTotal)}</dd>
          </div>
        ) : null}
        {totals.coupon?.applied ? (
          <div className="flex justify-between">
            <dt className="text-fg-muted">Cupón {totals.coupon.code}</dt>
            <dd className="text-accent">{totals.coupon.freeShipping ? "Envío gratis" : `−${formatMoney(totals.couponDiscount)}`}</dd>
          </div>
        ) : null}
        {totals.paymentDiscount > 0 ? (
          <div className="flex justify-between">
            <dt className="text-fg-muted">
              {paymentName} ({totals.paymentDiscountPercent}&nbsp;%)
            </dt>
            <dd className="text-accent">−{formatMoney(totals.paymentDiscount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-fg-muted">Envío</dt>
          <dd className={shippingLabel === "Gratis" ? "text-success" : undefined}>{shippingLabel}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2.5 text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatMoney(totals.total)}</dd>
        </div>
        {net && totals.merchandiseTotal > 0 ? (
          <div className="text-xs text-fg-muted">
            {net.label} (productos): {formatMoney(netMerchandiseTotal(totals.lines, items, net.defaultVat, totals.merchandiseTotal))}
          </div>
        ) : null}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flujo
// ---------------------------------------------------------------------------

export function CheckoutFlow(props: CheckoutFlowProps) {
  const { paymentMethods, pickups, hasZones, promotions } = props;
  const router = useRouter();
  const uid = useId();
  const { items, hydrated, coupon, clear } = useCart();
  const { messages, checked } = useCartSync();

  const [step, setStep] = useState<Step>(1);
  // Datos guardados de una compra anterior en este navegador (sólo contacto y dirección).
  // El formulario se renderiza recién con el carrito hidratado, así que leer storage acá no rompe la hidratación.
  const [saved] = useState(readSaved);
  const [customer, setCustomer] = useState<Customer>({ name: "", email: "", phone: "", doc: "", ...saved.customer });
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(hasZones || !pickups.length ? "delivery" : "pickup");
  const [address, setAddress] = useState<Address>({ ...EMPTY_ADDRESS, ...saved.address, notes: "" });
  const [pickupId, setPickupId] = useState<string>(pickups[0]?.id ?? "");
  const [quote, setQuote] = useState<ShippingQuoteResult | null>(null);
  const [quoteKey, setQuoteKey] = useState<string>("");
  const [methodCode, setMethodCode] = useState<string>(paymentMethods[0]?.code ?? "");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [quoting, startQuote] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const cartTotals = computeCart({ items: toPricingItems(items), promotions, coupon });

  useEffect(() => {
    if (!checked || !items.length) return;
    trackOnce(`begin_checkout:${items.map((i) => `${i.variantId}x${i.qty}`).join(",")}`, "begin_checkout", {
      currency: props.currency,
      value: cartTotals.merchandiseTotal,
      coupon: coupon?.code ?? null,
      items: items.map((i) => ({ item_id: i.sku || i.variantId, item_name: i.name, item_variant: i.variantTitle, price: i.unitPrice, quantity: i.qty })),
    });
    // Sólo al terminar la validación inicial del carrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se dispara una vez por contenido de carrito (trackOnce)
  }, [checked]);

  const addressKey = JSON.stringify([address.street, address.number, address.city, address.province, address.postal_code]);
  const quoteValid = fulfillment === "delivery" && quote !== null && quoteKey === addressKey;
  const noCoverage = quoteValid && !quote?.zone;
  const whatsappMethod = paymentMethods.find((m) => m.type === "whatsapp");
  const availableMethods = noCoverage ? paymentMethods.filter((m) => m.type === "whatsapp") : paymentMethods;
  const method = availableMethods.find((m) => m.code === methodCode) ?? availableMethods[0] ?? null;

  const shipping =
    fulfillment === "pickup" ? null : quoteValid && quote?.zone ? { cost: quote.zone.cost, freeOver: quote.zone.freeOver } : null;
  const totals = computeCart({
    items: toPricingItems(items),
    promotions,
    coupon,
    paymentMethod: step >= 3 && method ? { code: method.code, discountPercent: method.discountPercent } : null,
    shipping,
  });
  const shippingLabel =
    fulfillment === "pickup"
      ? "Retiro gratis"
      : quoteValid && quote?.zone
        ? totals.shippingCost === 0
          ? "Gratis"
          : formatMoney(totals.shippingCost)
        : noCoverage
          ? "A coordinar"
          : "Se calcula con tu dirección";

  const belowMin = props.minOrderTotal > 0 && cartTotals.merchandiseTotal < props.minOrderTotal;

  // --- Validaciones por paso -------------------------------------------------
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
      const res = await quoteShippingAction({ address, subtotal: cartTotals.merchandiseTotal });
      if (res.ok) {
        setQuote(res.data);
        setQuoteKey(addressKey);
      } else {
        setFormError(res.error);
        if (res.fieldErrors) setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k.replace(/^address\./, ""), v[0]])));
      }
    });
  };

  const persistContact = () => {
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify({ customer, address: { ...address, notes: "" } }));
    } catch {
      // sin storage
    }
  };

  // --- Confirmar ---------------------------------------------------------------
  const confirm = async () => {
    if (!method || submitting) return;
    setSubmitting(true);
    setFormError(null);
    setItemErrors({});
    // WhatsApp: la ventana se abre en el click (si no, el navegador la bloquea) y se completa después.
    const popup = method.type === "whatsapp" ? window.open("", "_blank") : null;
    const res = await createOrder({
      customer,
      fulfillment,
      address: fulfillment === "delivery" ? address : null,
      pickupLocationId: fulfillment === "pickup" ? pickupId : null,
      paymentMethodCode: method.code,
      couponCode: coupon?.code ?? null,
      notes,
      items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
    });
    if (!res.ok) {
      popup?.close();
      setSubmitting(false);
      setFormError(res.error);
      const fe = res.fieldErrors ?? {};
      const perItem: Record<string, string> = {};
      for (const [k, v] of Object.entries(fe)) if (k.startsWith("items.")) perItem[k.slice(6)] = v[0];
      setItemErrors(perItem);
      setSummaryOpen(true);
      return;
    }
    persistContact();
    if (popup) {
      if (res.data.whatsappUrl) popup.location.href = res.data.whatsappUrl;
      else popup.close();
    }
    clear();
    router.push(`/pedido/${res.data.token}?nuevo=1`);
  };

  // --- Estados vacíos ----------------------------------------------------------
  if (!hydrated) return <div className="mt-6 h-64 rounded-lg bg-surface" aria-hidden />;
  if (!items.length && !submitting) {
    return (
      <div className="mt-6">
        {messages.length ? <Notices messages={messages} /> : null}
        <p className="text-fg-muted">Tu carrito está vacío.</p>
        <Link href="/productos" className="btn btn-primary mt-4">
          Ver todos los productos
        </Link>
      </div>
    );
  }

  const set = <K extends keyof Customer>(k: K) => (e: React.ChangeEvent<HTMLInputElement>) => setCustomer((c) => ({ ...c, [k]: e.target.value }));
  const setAddr = <K extends keyof Address>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setAddress((a) => ({ ...a, [k]: e.target.value }));
  const provinceLabel = PROVINCE_OPTIONS.find((p) => p.value === address.province)?.label ?? address.province;
  const pickup = pickups.find((p) => p.id === pickupId);

  const deliverySummary =
    fulfillment === "pickup"
      ? `Retirás en ${pickup?.name ?? "el local"}${pickup?.address ? ` · ${pickup.address}` : ""}`
      : `${[address.street, address.number, address.floor].filter(Boolean).join(" ")}, ${address.city}, ${provinceLabel} · ${
          quote?.zone ? `${quote.zone.name} · ${shippingLabel}` : "envío a coordinar"
        }`;

  const summary = (
    <Summary totals={totals} itemErrors={itemErrors} shippingLabel={shippingLabel} paymentName={method?.name ?? null} net={props.net} />
  );

  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,560px)_380px] lg:justify-between">
      {/* Resumen mobile: acordeón arriba */}
      <div className="rounded-md border border-border bg-surface lg:hidden">
        <button
          type="button"
          className="tnum flex min-h-12 w-full items-center justify-between px-4 text-sm"
          aria-expanded={summaryOpen}
          aria-controls={`${uid}-summary`}
          onClick={() => setSummaryOpen((o) => !o)}
        >
          <span>{summaryOpen ? "Ocultar resumen" : "Ver resumen"}</span>
          <span className="flex items-center gap-2 font-semibold">
            {formatMoney(totals.total)}
            <ChevronDown className={cn("size-4 transition-transform", summaryOpen && "rotate-180")} aria-hidden />
          </span>
        </button>
        {summaryOpen ? (
          <div id={`${uid}-summary`} className="border-t border-border px-4 pb-4">
            {summary}
          </div>
        ) : null}
      </div>

      <div>
        {messages.length ? <Notices messages={messages} /> : null}
        {belowMin ? (
          <p className="mb-4 rounded-md border border-danger p-3 text-sm text-danger" role="alert">
            El pedido mínimo es de {formatMoney(props.minOrderTotal)}.{" "}
            <Link href="/carrito" className="underline">
              Volvé al carrito
            </Link>{" "}
            para sumar productos.
          </p>
        ) : null}

        {/* 1. Datos */}
        <StepShell
          n={1}
          title="Tus datos"
          step={step}
          onEdit={() => setStep(1)}
          summary={`${customer.name} · ${customer.email}${customer.phone ? ` · ${customer.phone}` : ""}`}
        >
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
            <Field id={`${uid}-email`} label="Email" error={errors.email} help="Te sirve para identificar tu pedido." className="sm:col-span-2">
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

        {/* 2. Entrega */}
        <StepShell n={2} title="Entrega" step={step} onEdit={() => setStep(2)} summary={deliverySummary}>
          <div className="space-y-3" role="radiogroup" aria-label="Cómo recibís el pedido">
            {hasZones || whatsappMethod || !pickups.length ? (
              <label className="choice">
                <input
                  type="radio"
                  name="fulfillment"
                  value="delivery"
                  checked={fulfillment === "delivery"}
                  onChange={() => setFulfillment("delivery")}
                />
                <span className="flex-1">
                  <span className="block font-medium">Te lo llevamos</span>
                  <span className="block text-sm text-fg-muted">
                    {quoteValid && quote?.zone
                      ? `${quote.zone.name}${quote.zone.eta ? `, llega en ${quote.zone.eta}` : ""} · ${shippingLabel}`
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
              <Field id={`${uid}-notes`} label="Indicaciones para la entrega (opcional)" className="col-span-6">
                {(p) => <input {...p} className="input" placeholder="Timbre, entre calles, horario" value={address.notes} onChange={setAddr("notes")} />}
              </Field>

              {quoteValid ? (
                quote?.zone ? (
                  <p className="col-span-6 rounded-md border border-border p-3 text-sm" role="status">
                    <span className="font-medium">Te lo llevamos</span> — {quote.zone.name}
                    {quote.zone.eta ? `, llega en ${quote.zone.eta}` : ""} · {shippingLabel}
                    {quote.zone.freeOver && totals.shippingCost > 0 ? (
                      <span className="block text-fg-muted">Envío gratis desde {formatMoney(quote.zone.freeOver)}.</span>
                    ) : null}
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

              <div className="col-span-6 flex flex-wrap gap-3">
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

        {/* 3. Pago */}
        <StepShell n={3} title="Pago" step={step} onEdit={() => setStep(3)} summary={method ? method.name : undefined}>
          <div className="space-y-3" role="radiogroup" aria-label="Cómo pagás">
            {availableMethods.map((m) => {
              const t = computeCart({
                items: toPricingItems(items),
                promotions,
                coupon,
                paymentMethod: { code: m.code, discountPercent: m.discountPercent },
                shipping,
              });
              return (
                <label key={m.code} className="choice">
                  <input type="radio" name="payment" value={m.code} checked={method?.code === m.code} onChange={() => setMethodCode(m.code)} />
                  <span className="flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{m.type === "whatsapp" ? "Acordás el pago con el vendedor por WhatsApp" : m.name}</span>
                      {m.discountPercent > 0 ? <span className="tnum text-sm text-accent">−{m.discountPercent}&nbsp;%</span> : null}
                    </span>
                    <span className="tnum block text-sm text-fg-muted">Total {formatMoney(t.total)}</span>
                    {m.instructions ? <span className="block text-xs text-fg-muted">{m.instructions}</span> : null}
                  </span>
                </label>
              );
            })}
            {noCoverage ? <p className="text-sm text-fg-muted">Como el envío se coordina por WhatsApp, el pago también.</p> : null}
          </div>
          <div className="mt-5 space-y-4">
            <CouponForm email={customer.email} />
            <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={!method} onClick={() => setStep(4)}>
              Continuar
            </button>
          </div>
        </StepShell>

        {/* 4. Confirmar */}
        <StepShell n={4} title="Revisá y confirmá" step={step} onEdit={() => setStep(4)}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-fg-muted">Tus datos</dt>
              <dd>
                {customer.name} · {customer.email}
                {customer.phone ? ` · ${customer.phone}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted">Entrega</dt>
              <dd>{deliverySummary}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Pago</dt>
              <dd>{method?.type === "whatsapp" ? "Acordás el pago con el vendedor por WhatsApp" : method?.name}</dd>
            </div>
          </dl>
          {props.notesEnabled ? (
            <div className="mt-4">
              <label htmlFor={`${uid}-order-notes`} className="field-label">
                Notas para el vendedor (opcional)
              </label>
              <textarea
                id={`${uid}-order-notes`}
                className="input"
                rows={3}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
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
          <button type="button" className="btn btn-solid btn-block mt-3" onClick={confirm} disabled={submitting || belowMin || !method}>
            {submitting ? "Confirmando pedido" : "Confirmar pedido"}
          </button>
          <p className="mt-2 text-xs text-fg-muted">
            {method?.type === "whatsapp"
              ? "Al confirmar se abre WhatsApp con tu pedido armado. "
              : "En el próximo paso te mostramos cómo pagar. "}
            Al confirmar aceptás los{" "}
            {props.termsHref ? (
              <Link href={props.termsHref} className="link" target="_blank">
                Términos y condiciones
              </Link>
            ) : (
              "Términos y condiciones"
            )}
            .
          </p>
        </StepShell>
      </div>

      {/* Resumen desktop */}
      <aside className="hidden lg:block" aria-label="Resumen del pedido">
        <div className="sticky top-[calc(var(--header-h)+24px)] space-y-4 rounded-lg border border-border bg-surface p-5">
          <p className="font-semibold">Resumen</p>
          {summary}
          <FreeShippingBar threshold={props.freeShippingThreshold} amount={cartTotals.merchandiseTotal} partial={props.freeShippingPartial} />
          <Link href="/carrito" className="link text-sm">
            Editar carrito
          </Link>
        </div>
      </aside>
    </div>
  );
}

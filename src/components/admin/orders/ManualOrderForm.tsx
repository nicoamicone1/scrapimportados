"use client";

import { Minus, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createManualOrder,
  searchCustomersForOrder,
  searchVariantsForOrder,
  type CustomerHit,
  type VariantHit,
} from "@/app/admin/(panel)/pedidos/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Input";
import type { ActionResult } from "@/lib/actions";
import { computeManualTotals, parseAddress, type AddressSnapshot } from "@/lib/admin/order-utils";
import { cn } from "@/lib/cn";
import { formatMoney, formatPercent, parseMoney } from "@/lib/money";

export interface ManualOrderFormProps {
  currency: string;
  methods: { code: string; name: string; discountPercent: number }[];
  pickups: { id: string; name: string; address: string | null }[];
  zones: { id: string; name: string; cost: number }[];
  reservationHours: number;
  inventoryPolicy: "on_order" | "on_paid";
}

interface Line {
  variantId: string;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  listPrice: number;
  unitPrice: string;
  qty: number;
  stock: number;
  trackInventory: boolean;
  allowBackorder: boolean;
}

const EMPTY_ADDRESS: AddressSnapshot = { street: "", number: "", floor: "", city: "", province: "", postal_code: "", notes: "" };

function money(v: number, currency: string) {
  return formatMoney(v, { currency });
}

function num(text: string): number {
  const n = parseMoney(text);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Búsqueda remota con debounce disparada desde el onChange (sin efectos):
 * ignora respuestas viejas si el texto cambió mientras tanto.
 */
function useRemoteSearch<T>(search: (q: string) => Promise<ActionResult<T[]>>, ms = 250) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<T[]>([]);
  const [searched, setSearched] = useState("");
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onChange = (q: string) => {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    const id = ++seq.current;
    if (q.trim().length < 2) {
      setHits([]);
      setSearched("");
      setSearching(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      const res = await search(q);
      if (id !== seq.current) return;
      setSearching(false);
      setHits(res.ok ? res.data : []);
      setSearched(q);
    }, ms);
  };

  const clear = () => onChange("");
  return { query, onChange, hits, searched, searching, clear };
}

/**
 * Pedido manual (venta por WhatsApp o en el local): cliente existente o
 * nuevo, productos con precio editable, entrega, pago y descuento.
 */
export function ManualOrderForm({ currency, methods, pickups, zones, reservationHours, inventoryPolicy }: ManualOrderFormProps) {
  const router = useRouter();

  // ---------- Cliente ----------
  const [customerMode, setCustomerMode] = useState<"search" | "existing" | "new">("search");
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "", doc: "" });
  const customerSearch = useRemoteSearch<CustomerHit>(searchCustomersForOrder);
  const customerQuery = customerSearch.query;
  const customerHits = customerSearch.hits;

  // ---------- Productos ----------
  const [lines, setLines] = useState<Line[]>([]);
  const productSearch = useRemoteSearch<VariantHit>(searchVariantsForOrder);
  const productQuery = productSearch.query;
  const productHits = productSearch.hits;
  const searching = productSearch.searching;
  const productInput = useRef<HTMLInputElement>(null);

  const addVariant = (v: VariantHit) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.variantId === v.variantId);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...ls,
        {
          variantId: v.variantId,
          productName: v.productName,
          variantTitle: v.variantTitle,
          sku: v.sku,
          imageUrl: v.imageUrl,
          listPrice: v.price,
          unitPrice: String(v.price).replace(".", ","),
          qty: 1,
          stock: v.stock,
          trackInventory: v.trackInventory,
          allowBackorder: v.allowBackorder,
        },
      ];
    });
    productSearch.clear();
    productInput.current?.focus();
  };

  const updateLine = (id: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.variantId === id ? { ...l, ...patch } : l)));

  // ---------- Entrega ----------
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(pickups.length && !zones.length ? "pickup" : "delivery");
  const [address, setAddress] = useState<AddressSnapshot>(EMPTY_ADDRESS);
  const [zoneId, setZoneId] = useState("");
  const [shippingCost, setShippingCost] = useState("0");
  const [pickupId, setPickupId] = useState(pickups[0]?.id ?? "");

  // ---------- Pago ----------
  const [methodCode, setMethodCode] = useState(methods[0]?.code ?? "");
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [manualDiscount, setManualDiscount] = useState("0");
  const [markPaid, setMarkPaid] = useState(false);
  const [reserve, setReserve] = useState(false);
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const method = methods.find((m) => m.code === methodCode);
  const totals = computeManualTotals({
    lines: lines.map((l) => ({ listPrice: l.listPrice, unitPrice: num(l.unitPrice), qty: l.qty })),
    shippingCost: fulfillment === "delivery" ? num(shippingCost) : 0,
    manualDiscount: num(manualDiscount),
    paymentDiscountPercent: applyDiscount ? (method?.discountPercent ?? 0) : 0,
  });

  const pickCustomer = (c: CustomerHit) => {
    setCustomer(c);
    setCustomerMode("existing");
    customerSearch.clear();
    const a = parseAddress(c.defaultAddress);
    if (a) setAddress(a);
  };

  const submit = async () => {
    setErrors({});
    const customerInput =
      customerMode === "existing" && customer
        ? { mode: "existing" as const, id: customer.id }
        : customerMode === "new"
          ? { mode: "new" as const, ...newCustomer }
          : null;
    if (!customerInput) {
      toast.error("Elegí un cliente o cargá uno nuevo.");
      return;
    }
    if (!lines.length) {
      toast.error("Agregá al menos un producto.");
      return;
    }
    setSaving(true);
    const res = await createManualOrder({
      customer: customerInput,
      items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty, unitPrice: num(l.unitPrice) })),
      fulfillment,
      shippingAddress: fulfillment === "delivery" ? address : undefined,
      shippingZoneId: fulfillment === "delivery" && zoneId ? zoneId : null,
      shippingCost: fulfillment === "delivery" ? num(shippingCost) : 0,
      pickupLocationId: fulfillment === "pickup" && pickupId ? pickupId : null,
      paymentMethodCode: methodCode,
      applyMethodDiscount: applyDiscount,
      manualDiscount: num(manualDiscount),
      notes,
      internalNotes,
      markPaid,
      reserve,
    });
    if (!res.ok) {
      setSaving(false);
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(`Pedido #${res.data.number} creado.`);
    router.push(`/admin/pedidos/${res.data.id}`);
  };

  const err = (key: string) => errors[key];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {/* Cliente */}
        <Card>
          <CardHeader
            title="Cliente"
            actions={
              customerMode !== "new" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus />}
                  onClick={() => {
                    setCustomerMode("new");
                    setCustomer(null);
                    setNewCustomer((n) => ({ ...n, name: n.name || customerQuery }));
                  }}
                >
                  Cliente nuevo
                </Button>
              ) : (
                <Button size="sm" variant="ghost" icon={<Search />} onClick={() => setCustomerMode("search")}>
                  Buscar existente
                </Button>
              )
            }
          />
          <CardBody>
            {customerMode === "existing" && customer ? (
              <div className="flex items-start justify-between gap-3 rounded-adm border border-adm-border px-3 py-2.5">
                <div className="flex min-w-0 items-start gap-2.5">
                  <UserRound className="mt-0.5 size-4 shrink-0 text-adm-fg-muted" aria-hidden />
                  <div className="min-w-0 text-[13px]">
                    <p className="text-sm font-medium">{customer.name ?? "Sin nombre"}</p>
                    <p className="text-adm-fg-muted">
                      {[customer.email, customer.phone].filter(Boolean).join(" · ") || "Sin contacto"}
                    </p>
                    <p className="text-xs text-adm-fg-muted">
                      {customer.ordersCount} {customer.ordersCount === 1 ? "pedido anterior" : "pedidos anteriores"}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Cambiar cliente"
                  onClick={() => {
                    setCustomer(null);
                    setCustomerMode("search");
                  }}
                >
                  <X />
                </Button>
              </div>
            ) : customerMode === "new" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre" required error={err("customer.name")}>
                  <Input
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer((n) => ({ ...n, name: e.target.value }))}
                    autoComplete="off"
                    autoFocus
                  />
                </Field>
                <Field label="Teléfono" hint="Con código de área, para WhatsApp." error={err("customer.phone")}>
                  <Input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer((n) => ({ ...n, phone: e.target.value }))}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Email" hint="Opcional." error={err("customer.email")}>
                  <Input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer((n) => ({ ...n, email: e.target.value }))}
                    autoComplete="off"
                  />
                </Field>
                <Field label="DNI o CUIT" hint="Opcional." error={err("customer.doc")}>
                  <Input value={newCustomer.doc} onChange={(e) => setNewCustomer((n) => ({ ...n, doc: e.target.value }))} />
                </Field>
              </div>
            ) : (
              <div className="relative">
                <Input
                  leading={<Search />}
                  placeholder="Buscá por nombre, email, teléfono o DNI"
                  aria-label="Buscar cliente"
                  value={customerQuery}
                  onChange={(e) => customerSearch.onChange(e.target.value)}
                />
                {customerHits.length ? (
                  <ul className="mt-1 divide-y divide-adm-border rounded-adm border border-adm-border">
                    {customerHits.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => pickCustomer(c)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-adm-hover"
                        >
                          <span className="min-w-0">
                            <span className="block font-medium">{c.name ?? "Sin nombre"}</span>
                            <span className="block truncate text-adm-fg-muted">
                              {[c.email, c.phone].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-adm-fg-muted">
                            {c.ordersCount} {c.ordersCount === 1 ? "pedido" : "pedidos"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : customerSearch.searched && !customerSearch.searching ? (
                  <p className="mt-2 text-[13px] text-adm-fg-muted">
                    No encontramos clientes con «{customerSearch.searched}». Cargalo como cliente nuevo.
                  </p>
                ) : null}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Productos */}
        <Card>
          <CardHeader title="Productos" description="Buscá por nombre o SKU. El precio se puede editar." />
          <CardBody className="space-y-3">
            <div className="relative">
              <Input
                ref={productInput}
                leading={<Search />}
                placeholder="Ej.: auriculares, AUR-123"
                aria-label="Buscar productos"
                value={productQuery}
                onChange={(e) => productSearch.onChange(e.target.value)}
              />
              {productHits.length ? (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-adm border border-adm-border bg-adm-surface shadow-[var(--adm-shadow)]">
                  {productHits.map((v) => {
                    const out = v.trackInventory && !v.allowBackorder && v.stock <= 0;
                    return (
                      <li key={v.variantId}>
                        <button
                          type="button"
                          disabled={out}
                          onClick={() => addVariant(v)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-adm-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {v.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- miniatura del buscador
                            <img src={v.imageUrl} alt="" className="size-8 shrink-0 rounded-[4px] border border-adm-border object-cover" />
                          ) : (
                            <span aria-hidden className="size-8 shrink-0 rounded-[4px] bg-adm-surface-2" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{v.productName}</span>
                            <span className="block truncate text-xs text-adm-fg-muted">
                              {[v.variantTitle, v.sku].filter(Boolean).join(" · ") || "Sin SKU"}
                            </span>
                          </span>
                          <span className="tnum shrink-0 text-right">
                            <span className="block">{money(v.price, currency)}</span>
                            <span className={cn("block text-xs", out ? "text-adm-danger" : "text-adm-fg-muted")}>
                              {v.trackInventory ? (out ? "Sin stock" : `Stock ${v.stock}`) : "Sin control de stock"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : searching ? (
                <p className="mt-2 text-[13px] text-adm-fg-muted">Buscando…</p>
              ) : null}
            </div>

            {lines.length ? (
              <ul className="divide-y divide-adm-border rounded-adm border border-adm-border">
                {lines.map((l) => {
                  const over = l.trackInventory && !l.allowBackorder && l.qty > l.stock;
                  return (
                    <li key={l.variantId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1 basis-48 text-[13px]">
                        <p className="truncate font-medium">{l.productName}</p>
                        <p className="truncate text-xs text-adm-fg-muted">
                          {[l.variantTitle, l.sku].filter(Boolean).join(" · ") || "Sin SKU"}
                          {over ? <span className="text-adm-danger"> · Quedan {l.stock}</span> : null}
                        </p>
                      </div>
                      <div className="w-32">
                        <label className="sr-only" htmlFor={`price-${l.variantId}`}>
                          Precio unitario
                        </label>
                        <Input
                          id={`price-${l.variantId}`}
                          size="sm"
                          inputMode="decimal"
                          leading="$"
                          value={l.unitPrice}
                          onChange={(e) => updateLine(l.variantId, { unitPrice: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon-sm"
                          aria-label="Restar uno"
                          onClick={() => updateLine(l.variantId, { qty: Math.max(1, l.qty - 1) })}
                        >
                          <Minus />
                        </Button>
                        <label className="sr-only" htmlFor={`qty-${l.variantId}`}>
                          Cantidad
                        </label>
                        <Input
                          id={`qty-${l.variantId}`}
                          size="sm"
                          type="number"
                          min={1}
                          max={999}
                          className="w-14 text-center"
                          value={l.qty}
                          invalid={over}
                          onChange={(e) =>
                            updateLine(l.variantId, { qty: Math.max(1, Math.min(999, Number.parseInt(e.target.value, 10) || 1)) })
                          }
                        />
                        <Button size="icon-sm" aria-label="Sumar uno" onClick={() => updateLine(l.variantId, { qty: l.qty + 1 })}>
                          <Plus />
                        </Button>
                      </div>
                      <div className="tnum w-24 text-right text-sm font-medium">{money(num(l.unitPrice) * l.qty, currency)}</div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Quitar ${l.productName}`}
                        onClick={() => setLines((ls) => ls.filter((x) => x.variantId !== l.variantId))}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-adm-fg-muted">Todavía no agregaste productos.</p>
            )}
            {err("items") ? <p className="text-xs text-adm-danger">{err("items")?.[0]}</p> : null}
          </CardBody>
        </Card>

        {/* Entrega */}
        <Card>
          <CardHeader title="Entrega" />
          <CardBody className="space-y-4">
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">Tipo de entrega</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="fulfillment"
                  checked={fulfillment === "delivery"}
                  onChange={() => setFulfillment("delivery")}
                  className="accent-[var(--adm-accent)]"
                />
                Envío a domicilio
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="fulfillment"
                  checked={fulfillment === "pickup"}
                  onChange={() => setFulfillment("pickup")}
                  className="accent-[var(--adm-accent)]"
                />
                Retira en el local
              </label>
            </fieldset>

            {fulfillment === "delivery" ? (
              <div className="grid gap-3 sm:grid-cols-6">
                <Field label="Calle" required error={err("shippingAddress.street")} className="sm:col-span-3">
                  <Input value={address.street} onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} />
                </Field>
                <Field label="Número" className="sm:col-span-1">
                  <Input value={address.number} onChange={(e) => setAddress((a) => ({ ...a, number: e.target.value }))} />
                </Field>
                <Field label="Piso / depto." className="sm:col-span-2">
                  <Input value={address.floor} onChange={(e) => setAddress((a) => ({ ...a, floor: e.target.value }))} />
                </Field>
                <Field label="Localidad" className="sm:col-span-2">
                  <Input value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} />
                </Field>
                <Field label="Provincia" className="sm:col-span-2">
                  <Input value={address.province} onChange={(e) => setAddress((a) => ({ ...a, province: e.target.value }))} />
                </Field>
                <Field label="Código postal" className="sm:col-span-2">
                  <Input value={address.postal_code} onChange={(e) => setAddress((a) => ({ ...a, postal_code: e.target.value }))} />
                </Field>
                <Field label="Indicaciones" className="sm:col-span-6">
                  <Input
                    value={address.notes}
                    placeholder="Ej.: timbre 3, dejar en portería"
                    onChange={(e) => setAddress((a) => ({ ...a, notes: e.target.value }))}
                  />
                </Field>
                {zones.length ? (
                  <Field label="Zona" hint="Completa el costo con el de la zona." className="sm:col-span-3">
                    <Select
                      value={zoneId}
                      onChange={(e) => {
                        setZoneId(e.target.value);
                        const z = zones.find((x) => x.id === e.target.value);
                        if (z) setShippingCost(String(z.cost).replace(".", ","));
                      }}
                      options={[{ value: "", label: "Sin zona" }, ...zones.map((z) => ({ value: z.id, label: `${z.name} · ${money(z.cost, currency)}` }))]}
                    />
                  </Field>
                ) : null}
                <Field label="Costo de envío" error={err("shippingCost")} className="sm:col-span-3">
                  <Input inputMode="decimal" leading="$" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} />
                </Field>
              </div>
            ) : pickups.length ? (
              <Field label="Punto de retiro">
                <Select
                  value={pickupId}
                  onChange={(e) => setPickupId(e.target.value)}
                  options={pickups.map((p) => ({ value: p.id, label: p.address ? `${p.name} · ${p.address}` : p.name }))}
                />
              </Field>
            ) : (
              <p className="text-[13px] text-adm-fg-muted">
                No hay puntos de retiro cargados. El pedido queda como retiro en el local; podés cargarlos en Envíos.
              </p>
            )}
          </CardBody>
        </Card>

        {/* Notas */}
        <Card>
          <CardHeader title="Notas" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Nota del cliente" hint="La ve el cliente en su pedido y sale en el remito.">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </Field>
            <Field label="Nota interna" hint="Sólo la ve el equipo.">
              <Textarea rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} maxLength={5000} />
            </Field>
          </CardBody>
        </Card>
      </div>

      {/* Resumen */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader title="Pago y total" />
          <CardBody className="space-y-3">
            <Field label="Método de pago" error={err("paymentMethodCode")}>
              <Select
                value={methodCode}
                onChange={(e) => setMethodCode(e.target.value)}
                options={methods.map((m) => ({ value: m.code, label: m.name }))}
              />
            </Field>
            {method && method.discountPercent > 0 ? (
              <Checkbox
                checked={applyDiscount}
                onChange={(e) => setApplyDiscount(e.target.checked)}
                label={`Aplicar ${formatPercent(method.discountPercent)} de descuento`}
              />
            ) : null}
            <Field label="Descuento manual" error={err("manualDiscount")}>
              <Input inputMode="decimal" leading="$" value={manualDiscount} onChange={(e) => setManualDiscount(e.target.value)} />
            </Field>

            <dl className="tnum space-y-1 border-t border-adm-border pt-3 text-[13px]">
              <Row label="Subtotal" value={money(totals.subtotal, currency)} />
              {totals.promoTotal > 0 ? <Row label="Rebaja de precios" value={`− ${money(totals.promoTotal, currency)}`} /> : null}
              {totals.manualDiscount > 0 ? <Row label="Descuento manual" value={`− ${money(totals.manualDiscount, currency)}`} /> : null}
              {totals.paymentDiscount > 0 ? <Row label="Descuento por pago" value={`− ${money(totals.paymentDiscount, currency)}`} /> : null}
              <Row
                label={fulfillment === "pickup" ? "Retiro" : "Envío"}
                value={totals.shippingCost > 0 ? money(totals.shippingCost, currency) : "Sin cargo"}
              />
              <div className="flex justify-between border-t border-adm-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{money(totals.total, currency)}</dd>
              </div>
            </dl>

            <div className="space-y-2 border-t border-adm-border pt-3">
              <Checkbox
                checked={markPaid}
                onChange={(e) => setMarkPaid(e.target.checked)}
                label="Ya está pagado"
                description="Registra un pago por el total."
              />
              {!markPaid && reservationHours > 0 ? (
                <Checkbox
                  checked={reserve}
                  onChange={(e) => setReserve(e.target.checked)}
                  label={`Cancelar si no se paga en ${reservationHours} h`}
                  description="Libera el stock reservado si no registrás el pago."
                />
              ) : null}
              <p className="text-xs text-adm-fg-muted">
                {inventoryPolicy === "on_order" || markPaid
                  ? "El stock se descuenta al crear el pedido."
                  : "La tienda descuenta el stock cuando el pedido queda pagado."}
              </p>
            </div>

            <Button variant="primary" size="lg" className="w-full" onClick={submit} loading={saving} disabled={!lines.length}>
              Crear pedido
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-adm-fg-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

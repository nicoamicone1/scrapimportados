"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { savePaymentsSettings } from "@/app/admin/(panel)/configuracion/actions";
import { useOptionalAdminStore } from "@/components/admin/AdminStoreContext";
import { PlanGate } from "@/components/admin/PlanGate";
import { Badge } from "@/components/ui/Badge";
import { Card, FormSection } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { formatMoney, parseMoney } from "@/lib/money";
import {
  isValidAlias,
  isValidCbu,
  isValidCuit,
  OUT_OF_STOCK_OPTIONS,
  WHATSAPP_BUTTON_VARS,
  WHATSAPP_ORDER_VARS,
  type PaymentsSettingsInput,
} from "@/lib/schemas/settings";
import { buildOrderMessage, buildProductMessage } from "@/lib/store/whatsapp";

import { HeaderSave, SaveBar } from "./SaveBar";
import { SettingsHeader } from "./SettingsHeader";
import { MarkdownField, TemplateTextarea } from "./TemplateInput";
import { useSettingsForm } from "./useSettingsForm";

type Method = PaymentsSettingsInput["methods"][number];

const TYPE_LABEL: Record<Method["type"], string> = {
  transfer: "Transferencia",
  whatsapp: "WhatsApp",
  cash: "Efectivo",
  other: "Otro",
};


interface StoreInfo {
  name: string;
  whatsappPhone: string;
  currency: string;
  locale: string;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value.replace(",", "."));
  return Number.NaN;
}

export function PaymentsForm({ initial, store }: { initial: PaymentsSettingsInput; store: StoreInfo }) {
  const form = useSettingsForm(initial, savePaymentsSettings);
  const { values: v, set, error } = form;
  const money = (n: number) => formatMoney(n, { currency: store.currency, locale: store.locale });
  // URL pública de la tienda activa (subdominio, dominio propio o /s/<slug>) para los ejemplos.
  const site = (useOptionalAdminStore()?.store.url ?? "").replace(/\/+$/, "");

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= v.methods.length) return;
    const next = [...v.methods];
    [next[index], next[target]] = [next[target], next[index]];
    set("methods", next);
  };

  const orderPreview = useMemo(
    () =>
      buildOrderMessage({
        template: v.whatsapp_template,
        number: 1043,
        storeName: store.name,
        customerName: "Lucía Fernández",
        items: [
          { name: "Remera básica", variantTitle: "Negro / M", qty: 2, total: 31000 },
          { name: "Gorra lisa", qty: 1, total: 17500 },
        ],
        total: 48500,
        delivery: "Envío a Av. Santa Fe 3253, CABA",
        payment: "Acordar con el vendedor",
        url: `${site}/pedido/ejemplo`,
        currency: store.currency,
        locale: store.locale,
      }),
    [v.whatsapp_template, store, site],
  );

  const fabPreview = buildProductMessage(v.whatsapp_button.message_template, {
    name: "Remera básica",
    url: `${site}/producto/remera-basica`,
  });

  const transferMethod = v.methods.find((m) => m.type === "transfer");
  const transferDiscount = transferMethod ? asNumber(transferMethod.discount_percent) : 0;
  const reservation = asNumber(v.reservation_hours);
  const threshold = typeof v.free_shipping_bar.threshold === "string" ? parseMoney(v.free_shipping_bar.threshold) : Number.NaN;

  const cbuState = v.transfer.cbu.trim() ? (isValidCbu(v.transfer.cbu) ? "ok" : "bad") : "empty";
  const aliasState = v.transfer.alias.trim() ? (isValidAlias(v.transfer.alias) ? "ok" : "bad") : "empty";
  const cuitState = v.transfer.cuit.trim() ? (isValidCuit(v.transfer.cuit) ? "ok" : "bad") : "empty";

  return (
    <>
      <SettingsHeader
        title="Pagos y checkout"
        description="Cómo te pagan, qué datos pedís al comprar y cuánto tiempo se reserva el stock."
        actions={<HeaderSave dirty={form.dirty} saving={form.saving} onSave={form.save} />}
      />

      <Card className="max-w-5xl px-5 md:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.save();
          }}
          className="divide-y divide-adm-border"
        >
          <FormSection
            title="Métodos de pago"
            description="Se muestran en el checkout en este orden. El descuento se aplica sobre el total de los productos (sin el envío)."
          >
            {error("methods") ? <p className="text-xs text-adm-danger">{error("methods")}</p> : null}
            <ol className="space-y-3">
              {v.methods.map((m, i) => (
                <li key={m.id} className={cn("rounded-adm border border-adm-border", !m.is_active && "bg-adm-surface-2/50")}>
                  <div className="flex items-center gap-3 border-b border-adm-border px-3 py-2">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label={`Subir ${m.name}`}
                        className="inline-flex size-5 items-center justify-center rounded-[4px] text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg disabled:opacity-30"
                      >
                        <ArrowUp className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === v.methods.length - 1}
                        aria-label={`Bajar ${m.name}`}
                        className="inline-flex size-5 items-center justify-center rounded-[4px] text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg disabled:opacity-30"
                      >
                        <ArrowDown className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{m.name || "Sin nombre"}</div>
                      <div className="text-xs text-adm-fg-muted">
                        {TYPE_LABEL[m.type]} · código <span className="font-mono">{m.code}</span>
                      </div>
                    </div>
                    <Badge tone={m.is_active ? "green" : "neutral"}>{m.is_active ? "Activo" : "Inactivo"}</Badge>
                    <Switch
                      checked={m.is_active}
                      onCheckedChange={(on) => set(`methods.${i}.is_active`, on)}
                      aria-label={`${m.is_active ? "Desactivar" : "Activar"} ${m.name}`}
                    />
                  </div>
                  <div className="space-y-4 p-3">
                    <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                      <Field label="Nombre en el checkout" error={error(`methods.${i}.name`)}>
                        <Input value={m.name} onChange={(e) => set(`methods.${i}.name`, e.target.value)} maxLength={60} />
                      </Field>
                      <Field label="Descuento" hint="De 0 a 100." error={error(`methods.${i}.discount_percent`)}>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          inputMode="decimal"
                          value={String(m.discount_percent)}
                          onChange={(e) => set(`methods.${i}.discount_percent`, e.target.value)}
                          trailing="%"
                        />
                      </Field>
                    </div>
                    <Field
                      label="Instrucciones para el cliente"
                      hint="Se muestran en la página del pedido después de comprar."
                      error={error(`methods.${i}.instructions_md`)}
                    >
                      <MarkdownField rows={3} value={m.instructions_md} onChange={(val) => set(`methods.${i}.instructions_md`, val)} maxLength={2000} />
                    </Field>

                    {m.type === "transfer" ? (
                      <div className="space-y-4 rounded-adm bg-adm-surface-2/60 p-3">
                        <p className="text-[13px] font-medium">Datos de la cuenta</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Banco o billetera" error={error("transfer.bank_name")}>
                            <Input value={v.transfer.bank_name} onChange={(e) => set("transfer.bank_name", e.target.value)} placeholder="Banco Nación, Mercado Pago…" />
                          </Field>
                          <Field label="Titular" error={error("transfer.holder")}>
                            <Input value={v.transfer.holder} onChange={(e) => set("transfer.holder", e.target.value)} autoComplete="off" />
                          </Field>
                        </div>
                        <Field
                          label="CBU o CVU"
                          hint={cbuState === "bad" ? "Tiene que tener 22 dígitos y los verificadores correctos." : cbuState === "ok" ? "CBU/CVU válido." : "22 dígitos. Lo validamos con el dígito verificador."}
                          error={error("transfer.cbu")}
                        >
                          <Input
                            value={v.transfer.cbu}
                            onChange={(e) => set("transfer.cbu", e.target.value)}
                            inputMode="numeric"
                            maxLength={26}
                            className="font-mono"
                            invalid={cbuState === "bad" || undefined}
                          />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field
                            label="Alias"
                            hint={aliasState === "bad" ? "Entre 6 y 20 caracteres: letras, números, punto o guion." : "Ej. MI.TIENDA.PAGOS"}
                            error={error("transfer.alias")}
                          >
                            <Input
                              value={v.transfer.alias}
                              onChange={(e) => set("transfer.alias", e.target.value)}
                              maxLength={20}
                              className="font-mono uppercase"
                              invalid={aliasState === "bad" || undefined}
                            />
                          </Field>
                          <Field
                            label="CUIT del titular"
                            hint={cuitState === "bad" ? "Revisá el número: el dígito verificador no coincide." : "Ej. 30-71234567-1"}
                            error={error("transfer.cuit")}
                          >
                            <Input
                              value={v.transfer.cuit}
                              onChange={(e) => set("transfer.cuit", e.target.value)}
                              inputMode="numeric"
                              maxLength={13}
                              className="font-mono"
                              invalid={cuitState === "bad" || undefined}
                            />
                          </Field>
                        </div>
                        <Field label="Aclaraciones" hint="Ej.: Aceptamos transferencias desde cualquier banco o billetera." error={error("transfer.instructions_md")}>
                          <MarkdownField rows={2} value={v.transfer.instructions_md} onChange={(val) => set("transfer.instructions_md", val)} maxLength={2000} />
                        </Field>
                        <div className="rounded-adm border border-adm-border bg-adm-surface p-3">
                          <p className="text-xs font-medium tracking-[0.06em] text-adm-fg-muted uppercase">Así lo ve el cliente</p>
                          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                            <dt className="text-adm-fg-muted">Total a transferir</dt>
                            <dd className="tnum font-medium">
                              {money(100000 * (1 - (Number.isFinite(transferDiscount) ? transferDiscount : 0) / 100))}
                              <span className="ml-1.5 font-normal text-adm-fg-muted">en un pedido de {money(100000)}</span>
                            </dd>
                            <dt className="text-adm-fg-muted">Alias</dt>
                            <dd className="font-mono">{v.transfer.alias.toUpperCase() || "—"}</dd>
                            <dt className="text-adm-fg-muted">CBU/CVU</dt>
                            <dd className="font-mono">{v.transfer.cbu.replace(/\s/g, "") || "—"}</dd>
                            <dt className="text-adm-fg-muted">Titular</dt>
                            <dd>{v.transfer.holder || "—"}</dd>
                            <dt className="text-adm-fg-muted">CUIT</dt>
                            <dd className="font-mono">{v.transfer.cuit || "—"}</dd>
                            <dt className="text-adm-fg-muted">Banco</dt>
                            <dd>{v.transfer.bank_name || "—"}</dd>
                          </dl>
                        </div>
                      </div>
                    ) : null}

                    {m.type === "whatsapp" ? (
                      <div className="space-y-3 rounded-adm bg-adm-surface-2/60 p-3">
                        <Field
                          label="Mensaje del pedido"
                          hint="Es el mensaje que se abre en WhatsApp con el pedido armado. Tocá una variable para insertarla."
                          error={error("whatsapp_template")}
                        >
                          <TemplateTextarea
                            value={v.whatsapp_template}
                            onChange={(val) => set("whatsapp_template", val)}
                            variables={WHATSAPP_ORDER_VARS}
                            maxLength={1000}
                          />
                        </Field>
                        <div className="rounded-adm border border-adm-border bg-adm-surface p-3">
                          <p className="text-xs font-medium tracking-[0.06em] text-adm-fg-muted uppercase">Vista previa</p>
                          <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap">{orderPreview}</p>
                          <p className="mt-2 text-xs text-adm-fg-muted">{orderPreview.length} de 1000 caracteres. Si el pedido es largo, los productos se resumen y queda el link.</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </FormSection>

          <FormSection title="Checkout" description="Qué le pedimos al cliente y desde qué monto puede comprar.">
            <Switch
              checked={v.require_phone}
              onCheckedChange={(on) => set("require_phone", on)}
              label="Pedir teléfono"
              description="Recomendado: es la forma de contactarlo por WhatsApp."
            />
            <Switch
              checked={v.order_notes_enabled}
              onCheckedChange={(on) => set("order_notes_enabled", on)}
              label="Permitir notas en el pedido"
              description="Un campo opcional para aclaraciones (horario de entrega, regalo, etc.)."
            />
            <PlanGate
              feature="marketing.abandoned"
              mode="preview"
              description="Un mail con el carrito a quien dejó el checkout a mitad de camino y aceptó el aviso."
            >
              <Switch
                checked={Boolean(v.abandoned_reminders)}
                onCheckedChange={(on) => set("abandoned_reminders", on)}
                label="Avisar por mail los carritos abandonados"
                description={
                  <>
                    En «Tus datos» aparece «Avisame por mail si dejo el pedido sin terminar», destildado. A quien lo tilda y no
                    confirma le llega un solo mail dentro del día, con su carrito y un botón para terminarlo. Los ves en{" "}
                    <Link href="/admin/pedidos/abandonados" className="text-adm-accent underline-offset-2 hover:underline">
                      Carritos abandonados
                    </Link>
                    .
                  </>
                }
              />
            </PlanGate>
            <Field label="Compra mínima" hint="0 = sin mínimo. Se valida en el carrito y al confirmar el pedido." error={error("min_order_total")}>
              <Input
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={String(v.min_order_total)}
                onChange={(e) => set("min_order_total", e.target.value)}
                leading="$"
                className="max-w-[220px]"
              />
            </Field>
          </FormSection>

          <FormSection
            title="Reserva de stock"
            description="Qué pasa con el stock de un pedido que todavía no se pagó."
          >
            <Field label="Cuándo se descuenta el stock" error={error("inventory_policy")}>
              <Select
                value={v.inventory_policy}
                onChange={(e) => set("inventory_policy", e.target.value)}
                options={[
                  { value: "on_order", label: "Al crear el pedido (reserva el stock)" },
                  { value: "on_paid", label: "Al marcarlo como pagado" },
                ]}
              />
            </Field>
            <Field
              label="Vencimiento de pedidos impagos"
              hint={
                Number.isFinite(reservation) && reservation === 0
                  ? "0 = nunca vence: los pedidos sin pagar quedan pendientes hasta que los canceles a mano (y el stock queda reservado)."
                  : `Si en ${Number.isFinite(reservation) ? reservation : "…"} horas no registrás el pago, el pedido se cancela solo y el stock vuelve al inventario. El cliente ve hasta cuándo le reservás. 0 = nunca vence.`
              }
              error={error("reservation_hours")}
            >
              <Input
                type="number"
                min={0}
                max={720}
                step="1"
                inputMode="numeric"
                value={String(v.reservation_hours)}
                onChange={(e) => set("reservation_hours", e.target.value)}
                trailing="horas"
                className="max-w-[220px]"
              />
            </Field>
          </FormSection>

          <FormSection title="Stock en el catálogo" description="Avisos de stock bajo y qué hacer con los productos agotados.">
            <Field label="Umbral de stock bajo" hint="Cuando una variante llega a esta cantidad o menos, aparece en las alertas. Cada variante puede tener el suyo." error={error("low_stock_threshold")}>
              <Input
                type="number"
                min={0}
                step="1"
                inputMode="numeric"
                value={String(v.low_stock_threshold)}
                onChange={(e) => set("low_stock_threshold", e.target.value)}
                trailing="u."
                className="max-w-[220px]"
              />
            </Field>
            <Field label="Productos sin stock" hint="En la ficha siempre se ve «Sin stock» con la opción de consultar por WhatsApp." error={error("out_of_stock_display")}>
              <Select value={v.out_of_stock_display} onChange={(e) => set("out_of_stock_display", e.target.value)} options={OUT_OF_STOCK_OPTIONS.map((o) => ({ ...o }))} />
            </Field>
          </FormSection>

          <FormSection title="Barra de envío gratis" description="En el carrito: «Te faltan $ X para el envío gratis», con una barra de progreso.">
            <Switch
              checked={v.free_shipping_bar.enabled}
              onCheckedChange={(on) => set("free_shipping_bar.enabled", on)}
              label="Mostrar la barra en el carrito"
            />
            <Field
              label="Monto para el envío gratis"
              hint={
                Number.isFinite(threshold) && threshold > 0
                  ? `Desde ${money(threshold)} el envío es gratis.`
                  : "Si lo dejás vacío, se usa el menor «envío gratis desde» de tus zonas de envío y se aclara «en zonas seleccionadas»."
              }
              error={error("free_shipping_bar.threshold")}
            >
              <Input
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={String(v.free_shipping_bar.threshold ?? "")}
                onChange={(e) => set("free_shipping_bar.threshold", e.target.value)}
                leading="$"
                placeholder="Según las zonas"
                disabled={!v.free_shipping_bar.enabled}
                className="max-w-[220px]"
              />
            </Field>
            <p className="text-[13px] text-adm-fg-muted">
              Los montos por zona se configuran en{" "}
              <Link href="/admin/envios" className="text-adm-accent underline-offset-2 hover:underline">
                Envíos
              </Link>
              .
            </p>
          </FormSection>

          <FormSection title="Botón flotante de WhatsApp" description="Un botón fijo en la tienda para consultas. No aparece en el checkout ni en la página del pedido.">
            {!store.whatsappPhone ? (
              <p className="rounded-adm bg-adm-danger-soft px-3 py-2 text-[13px] text-adm-danger">
                Falta el número de WhatsApp de la tienda.{" "}
                <Link href="/admin/configuracion/tienda" className="font-medium underline underline-offset-2">
                  Cargalo en Tienda
                </Link>
                .
              </p>
            ) : null}
            <Switch
              checked={v.whatsapp_button.enabled}
              onCheckedChange={(on) => set("whatsapp_button.enabled", on)}
              label="Mostrar el botón"
              description={store.whatsappPhone ? `Abre un chat con +${store.whatsappPhone}.` : undefined}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Posición" error={error("whatsapp_button.position")}>
                <Select
                  value={v.whatsapp_button.position}
                  onChange={(e) => set("whatsapp_button.position", e.target.value)}
                  options={[
                    { value: "right", label: "Abajo a la derecha" },
                    { value: "left", label: "Abajo a la izquierda" },
                  ]}
                />
              </Field>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <Switch checked={v.whatsapp_button.show_on_mobile} onCheckedChange={(on) => set("whatsapp_button.show_on_mobile", on)} label="En celulares" />
                <Switch checked={v.whatsapp_button.show_on_desktop} onCheckedChange={(on) => set("whatsapp_button.show_on_desktop", on)} label="En computadoras" />
              </div>
            </div>
            <Field
              label="Mensaje inicial"
              hint="En la ficha de un producto podés usar {product} y {url}. Si no los usás, en la ficha se manda «Hola, consulto por *Producto* link»."
              error={error("whatsapp_button.message_template")}
            >
              <TemplateTextarea
                rows={3}
                value={v.whatsapp_button.message_template}
                onChange={(val) => set("whatsapp_button.message_template", val)}
                variables={WHATSAPP_BUTTON_VARS}
                maxLength={500}
              />
            </Field>
            <p className="text-[13px] text-adm-fg-muted">
              <span className="font-medium text-adm-fg">Desde una ficha:</span> {fabPreview}
            </p>
          </FormSection>
          <button type="submit" hidden />
        </form>
      </Card>
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onDiscard={form.discard} errorCount={Object.keys(form.errors).length} />
    </>
  );
}

"use client";

import { Download } from "lucide-react";
import { useState, type ReactNode } from "react";

import { PlanGate } from "@/components/admin/PlanGate";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { formatNumber } from "@/lib/money";

interface Counts {
  products: number;
  variants: number;
  orders: number;
  customers: number;
}

function ExportRow({
  title,
  description,
  meta,
  href,
  children,
}: {
  title: string;
  description: string;
  meta: string;
  href: string;
  children?: ReactNode;
}) {
  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <h2 className="text-sm font-medium text-adm-fg">{title}</h2>
          <p className="mt-0.5 text-[13px] text-adm-fg-muted">{description}</p>
          <p className="tnum mt-1 text-xs text-adm-fg-muted">{meta}</p>
        </div>
        {/* Link de descarga directa: el navegador baja el archivo del route handler. */}
        <a href={href} download className={buttonClass("secondary", "md")}>
          <Download aria-hidden />
          Descargar CSV
        </a>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </li>
  );
}

export function ExportPanel({ counts }: { counts: Counts }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");

  const orderParams = new URLSearchParams();
  if (from) orderParams.set("desde", from);
  if (to) orderParams.set("hasta", to);
  if (status) orderParams.set("estado", status);
  if (payment) orderParams.set("pago", payment);
  const orderQs = orderParams.toString();

  return (
    <PlanGate
      feature="orders.export"
      mode="preview"
      className="max-w-4xl"
      description="Descargá productos, inventario, pedidos y clientes en CSV para tu contador o para editarlos en una planilla."
    >
      <Card className="max-w-4xl">
        <ul className="divide-y divide-adm-border">
          <ExportRow
            title="Productos y variantes"
            description="Una fila por variante con categorías, opciones, SKU, precios, costo, stock, imagen y SEO. Es el mismo formato que acepta el importador CSV, así que podés editarlo y volver a subirlo."
            meta={`${formatNumber(counts.products)} productos · ${formatNumber(counts.variants)} variantes`}
            href="/admin/api/export/productos.csv"
          />
          <ExportRow
            title="Inventario"
            description="SKU, producto, variante, stock, umbral de stock bajo, si se controla el stock y costo."
            meta={`${formatNumber(counts.variants)} variantes`}
            href="/admin/api/export/inventario.csv"
          />
          <ExportRow
            title="Pedidos"
            description="Columnas contables: fecha, cliente con DNI o CUIT, subtotal, descuentos, envío, total, método y estado de pago, entrega y seguimiento."
            meta={`${formatNumber(counts.orders)} pedidos en total`}
            href={`/admin/api/export/pedidos.csv${orderQs ? `?${orderQs}` : ""}`}
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Desde">
                <Input type="date" size="sm" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="Hasta">
                <Input type="date" size="sm" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </Field>
              <Field label="Estado">
                <Select
                  size="sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  options={[
                    { value: "", label: "Todos" },
                    { value: "pending", label: "Pendiente" },
                    { value: "confirmed", label: "Confirmado" },
                    { value: "preparing", label: "En preparación" },
                    { value: "shipped", label: "Enviado" },
                    { value: "delivered", label: "Entregado" },
                    { value: "cancelled", label: "Cancelado" },
                  ]}
                />
              </Field>
              <Field label="Pago">
                <Select
                  size="sm"
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                  options={[
                    { value: "", label: "Todos" },
                    { value: "pending", label: "Sin pagar" },
                    { value: "partial", label: "Pago parcial" },
                    { value: "paid", label: "Pagado" },
                    { value: "refunded", label: "Reintegrado" },
                  ]}
                />
              </Field>
            </div>
          </ExportRow>
          <ExportRow
            title="Clientes"
            description="Email, nombre, teléfono, documento, cantidad de pedidos, total gastado, etiquetas y fecha de alta."
            meta={`${formatNumber(counts.customers)} clientes`}
            href="/admin/api/export/clientes.csv"
          />
        </ul>
        <p className="border-t border-adm-border px-4 py-3 text-xs text-adm-fg-muted">
          Las fechas van en formato ISO (UTC) y los montos sin separador de miles, con punto decimal. Cada descarga queda registrada en la auditoría.
        </p>
      </Card>
    </PlanGate>
  );
}

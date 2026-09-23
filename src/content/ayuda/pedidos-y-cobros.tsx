import Link from "next/link";

import { Callout } from "@/components/platform/ArticleCallout";
import { ArticleTable } from "@/components/platform/ArticleTable";

import type { HelpArticleMeta } from "../types";

export const meta: HelpArticleMeta = {
  slug: "pedidos-y-cobros",
  title: "Cómo te llegan los pedidos y cómo cobrás",
  description: "Qué ve tu cliente al comprar, cómo te enterás del pedido, cómo cobrás por transferencia o WhatsApp y qué pasa con el stock reservado si nadie paga.",
  section: "pedidos",
  publishedAt: "2026-09-23",
  updatedAt: "2026-09-23",
  readingMinutes: 3,
  panel: { href: "/admin/pedidos", label: "Pedidos" },
  related: ["primeros-pasos"],
};

export const body = (
  <>
    <p>
      Tu tienda no tiene pasarela de pago: el cliente te paga a vos, por transferencia o como lo acuerden por WhatsApp. Lo que sí hace la
      tienda es registrar cada pedido antes de que se hable de plata, con productos, total, envío y datos del cliente.
    </p>

    <h2 id="cliente">Qué ve tu cliente al comprar</h2>
    <p>
      En el checkout completa <strong>Tus datos</strong>, elige la <strong>Entrega</strong> (envío con el costo de su zona o retiro en el local)
      y en <strong>Pago</strong> elige cómo paga. Con <strong>Confirmar pedido</strong> el pedido queda registrado y después:
    </p>
    <ul>
      <li>
        <strong>Transferencia</strong>: ve el monto a transferir con el descuento aplicado, tu alias, titular, banco y CBU con{" "}
        <strong>Copiar todos los datos</strong>, y el botón <strong>Enviar comprobante por WhatsApp</strong>.
      </li>
      <li>
        <strong>Acordar por WhatsApp</strong>: se abre el chat con tu número y el pedido armado. Coordinan pago y entrega por ahí.
      </li>
    </ul>
    <p>
      En los dos casos, el cliente se queda con el link de su pedido para ver el estado, los pagos y el seguimiento. Los métodos, el descuento
      (se aplica sobre los productos, sin el envío) y los datos bancarios se configuran en <strong>Configuración › Pagos y checkout</strong>.
    </p>

    <h2 id="aviso">Cómo te enterás</h2>
    <ul>
      <li>
        <strong>Pedidos</strong>, en el menú, muestra un contador con los pedidos que todavía no abriste.
      </li>
      <li>
        En el <strong>Dashboard</strong>, <strong>Avisarme de pedidos nuevos</strong> activa las notificaciones del navegador mientras el panel
        está abierto.
      </li>
      <li>
        Si cargaste el <strong>Email de contacto</strong> en <strong>Configuración › Tienda</strong>, también te llega un mail por cada pedido.
      </li>
    </ul>

    <h2 id="estados">Del pedido nuevo al entregado</h2>
    <p>
      En <strong>Pedidos</strong>, las pestañas <strong>Pendientes</strong> y <strong>Por preparar</strong> son tu lista del día. En el detalle
      de cada pedido, el botón principal siempre propone el paso siguiente:
    </p>
    <ArticleTable
      head={["Estado", "Botón para avanzar"]}
      rows={[
        ["Pendiente", "Confirmar"],
        ["Confirmado", "Pasar a preparación"],
        ["En preparación", "Marcar enviado (o Listo para retirar)"],
        ["Enviado", "Marcar entregado (o Marcar retirado)"],
      ]}
    />
    <p>
      Al marcar enviado cargás el transporte, el número y el link de seguimiento: el cliente los ve en la página de su pedido. En{" "}
      <strong>Más acciones</strong> podés volver a otro estado o <strong>Cancelar pedido</strong> con un motivo; si había descontado stock, las
      unidades vuelven al inventario.
    </p>

    <h2 id="cobrar">Marcar pagado</h2>
    <p>
      El pago es independiente del estado. Cuando ves la transferencia en tu cuenta, en la tarjeta <strong>Pagos</strong> del pedido tocás{" "}
      <strong>Marcar pagado</strong>: se registra un pago por el saldo, con el método del pedido. Si te pagan en partes o querés guardar el
      comprobante, usá <strong>Registrar pago</strong> (monto, método, referencia, fecha y un link o un archivo de hasta 10 MB). Un pago mal
      cargado se anula con <strong>Anular pago</strong>. Desde la lista también podés seleccionar varios pedidos y usar{" "}
      <strong>Marcar pagados</strong>.
    </p>

    <h2 id="reserva">Reserva de stock y vencimiento</h2>
    <p>
      En <strong>Configuración › Pagos y checkout › Reserva de stock</strong> decidís <strong>Cuándo se descuenta el stock</strong>: al crear el
      pedido (reserva el stock) o al marcarlo como pagado. Si lo reservás al crear, fijá el <strong>Vencimiento de pedidos impagos</strong> en
      horas: si pasa ese plazo sin que registres el pago, el pedido se cancela solo y el stock vuelve. Con 0, nunca vence.
    </p>
    <p>
      El cliente ve hasta cuándo le guardás el stock. Vos ves «Vence en 5 h» en la lista, y el Dashboard junta las{" "}
      <strong>Reservas que vencen pronto</strong>. Si el cliente te avisa que paga mañana, en el detalle del pedido tocás{" "}
      <strong>Extender 24 h</strong>.
    </p>
    <Callout>
      <p>
        ¿Vendiste por WhatsApp o en el local? Cargalo con <strong>Crear pedido</strong> en Pedidos: descuenta stock y queda en tus números igual
        que una venta de la tienda. Para imprimir o pasarle los pedidos a tu contador, mirá{" "}
        <Link href="/ayuda/remitos-y-exportar">Imprimir remitos y exportar a CSV</Link>.
      </p>
    </Callout>
  </>
);

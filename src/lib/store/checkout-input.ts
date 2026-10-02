import { z } from "zod";

/*
 * Validación de los datos del comprador y la dirección, compartida por el
 * checkout del carrito (`createOrder`) y el de cotizaciones 3D
 * (`checkoutPrint3dQuote`). Vive fuera de los archivos "use server" porque
 * ésos sólo pueden exportar funciones async.
 */

export const addressSchema = z.object({
  street: z.string().trim().min(2, "Ingresá la calle").max(120),
  number: z.string().trim().min(1, "Ingresá la altura").max(12),
  floor: z.string().trim().max(40).optional().default(""),
  city: z.string().trim().min(2, "Ingresá la ciudad o localidad").max(80),
  province: z.string().trim().min(1, "Elegí la provincia").max(60),
  postal_code: z
    .string()
    .trim()
    .regex(/^([A-Za-z]?\d{4}[A-Za-z]{0,3})$/, "Revisá el código postal: 4 números (ej. 1425) o CPA (ej. C1425ABC)."),
  notes: z.string().trim().max(300).optional().default(""),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre y apellido").max(120),
  email: z.string().trim().toLowerCase().email("Revisá el email: tiene que tener el formato nombre@dominio.com").max(160),
  phone: z.string().trim().max(40).optional().default(""),
  doc: z.string().trim().max(20).optional().default(""),
});

/** Chequeos de teléfono y DNI/CUIT (para `superRefine` con el cliente en `path`). */
export function customerIssues(customer: { phone: string; doc: string }): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  const digits = customer.phone.replace(/\D/g, "");
  if (customer.phone && (digits.length < 8 || digits.length > 15)) {
    issues.push({ path: "phone", message: "Revisá el teléfono: tiene que tener código de área (ej. 11 5555 1234)." });
  }
  if (customer.doc && !/^\d{7,11}$/.test(customer.doc.replace(/[.\-\s]/g, ""))) {
    issues.push({ path: "doc", message: "Revisá el DNI o CUIT: sólo números (7 a 11)." });
  }
  return issues;
}

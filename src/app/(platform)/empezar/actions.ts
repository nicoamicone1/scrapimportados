"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { fail, ok, type ActionResult } from "@/lib/actions";
import { isEmail, platformFrom, sendEmail, wasSent } from "@/lib/email/send";
import { platformOrigin } from "@/lib/tenant/urls";
import { platformWhatsappHref } from "@/components/platform/site";

import { platformMailto } from "../_lib/public-site";
import { catalogRequestEmail, catalogRequestSchema, catalogRequestSubject, catalogWhatsappText, createRateLimiter, type CatalogFormValues } from "./lead";

/*
 * Pedido de carga de catálogo (/empezar). Acción PÚBLICA: no pide sesión ni
 * escribe en la base. Manda un aviso a `PLATFORM_EMAIL` y devuelve el link
 * para seguir por WhatsApp (`PLATFORM_WHATSAPP`) con el mensaje armado.
 *
 * Nunca rompe: sin mail configurado, si Resend falla o si se pasó del cupo,
 * la pantalla de éxito igual ofrece seguir por WhatsApp (o por mail) con los
 * datos escritos, y `notified: false` le pide al comercio que mande ese
 * mensaje para que el pedido no se pierda.
 *
 * Anti-abuso: honeypot (`website`: si viene con algo se responde "listo" sin
 * mandar nada), cupo por IP en memoria (hash de la IP, no se guarda) y clave
 * de idempotencia por usuario y día (el doble clic no manda dos mails).
 */

export type CatalogRequestState =
  | { ok: true; data: { handle: string; whatsappUrl: string | null; mailtoUrl: string; notified: boolean } }
  | (Extract<ActionResult<never>, { ok: false }> & { values: CatalogFormValues })
  | null;

/** 5 pedidos por IP por hora. */
const limiter = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

async function withinQuota(): Promise<boolean> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
    if (!ip) return true;
    return limiter.hit(createHash("sha256").update(`empezar|${ip}`).digest("hex").slice(0, 32));
  } catch {
    return true;
  }
}

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export async function requestCatalogLoad(_prev: CatalogRequestState, formData: FormData): Promise<CatalogRequestState> {
  const values: CatalogFormValues = {
    instagram: field(formData, "instagram"),
    whatsapp: field(formData, "whatsapp"),
    products: field(formData, "products"),
    kind: field(formData, "kind"),
  };
  const parsed = catalogRequestSchema.safeParse({ ...values, website: field(formData, "website") || undefined });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[String(issue.path[0] ?? "_")] ??= []).push(issue.message);
    return { ...fail("Revisá los campos marcados.", fieldErrors), values };
  }

  const { website, ...lead } = parsed.data;
  const subject = catalogRequestSubject(lead);
  const whatsappText = catalogWhatsappText(lead);
  const followUp = {
    handle: lead.instagram,
    whatsappUrl: platformWhatsappHref(process.env.PLATFORM_WHATSAPP, whatsappText),
    mailtoUrl: platformMailto(subject, `${whatsappText}\nMi WhatsApp: ${lead.whatsapp}\n`),
  };

  // Honeypot: un bot que completa todo ve lo mismo que una persona.
  if (website?.trim()) return ok({ ...followUp, notified: true });

  const to = process.env.PLATFORM_EMAIL?.trim();
  if (!isEmail(to) || !(await withinQuota())) {
    if (!isEmail(to)) console.info(`[empezar] ${subject} (sin PLATFORM_EMAIL: no sale el aviso)`);
    return ok({ ...followUp, notified: false });
  }

  const requestedAt = new Date().toISOString();
  const result = await sendEmail({
    to,
    from: platformFrom(),
    ...catalogRequestEmail(lead, { platformUrl: platformOrigin(), requestedAt }),
    tags: [{ name: "kind", value: "catalog_request" }],
    idempotencyKey: `catalog-request/${lead.instagram}/${requestedAt.slice(0, 10)}`,
  });
  const notified = wasSent(result);
  if (!notified) console.info(`[empezar] ${subject} (el aviso no salió)`);
  return ok({ ...followUp, notified });
}

"use client";

import Link from "next/link";

import { saveStoreSettings } from "@/app/admin/(panel)/configuracion/actions";
import { Card, FormSection } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import {
  CURRENCIES,
  isValidE164,
  LOCALES,
  normalizePhone,
  SOCIAL_KEYS,
  TIMEZONES,
  type SocialKey,
  type StoreSettingsInput,
} from "@/lib/schemas/settings";

import { HeaderSave, SaveBar } from "./SaveBar";
import { SettingsHeader } from "./SettingsHeader";
import { useSettingsForm } from "./useSettingsForm";

const SOCIAL_LABELS: Record<SocialKey, { label: string; placeholder: string }> = {
  instagram: { label: "Instagram", placeholder: "https://instagram.com/tutienda" },
  facebook: { label: "Facebook", placeholder: "https://facebook.com/tutienda" },
  tiktok: { label: "TikTok", placeholder: "https://tiktok.com/@tutienda" },
  x: { label: "X (Twitter)", placeholder: "https://x.com/tutienda" },
  youtube: { label: "YouTube", placeholder: "https://youtube.com/@tutienda" },
};

function waHint(raw: string) {
  const digits = normalizePhone(raw);
  if (!digits) return "Con código de país y área, sin 0 ni 15. Ej. para un celular de CABA: 54 9 11 2345 6789.";
  if (!isValidE164(digits)) return "Tiene que tener código de país y área. Ej.: 54 9 11 2345 6789.";
  return `Los clientes te van a escribir a wa.me/${digits}.`;
}

export function StoreForm({ initial }: { initial: StoreSettingsInput }) {
  const form = useSettingsForm(initial, saveStoreSettings);
  const { values: v, set, error } = form;

  return (
    <>
      <SettingsHeader
        title="Tienda"
        description="Los datos que ven tus clientes en la tienda, los pedidos y los mensajes."
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
          <FormSection title="Identidad" description="El nombre aparece en el encabezado, en los títulos de las páginas y en los mensajes de WhatsApp.">
            <Field label="Nombre de la tienda" required error={error("name")}>
              <Input value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} autoComplete="organization" />
            </Field>
            <Field label="Bajada" hint="Una frase corta que describe qué vendés. Opcional." error={error("tagline")}>
              <Input value={v.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} maxLength={140} />
            </Field>
            <p className="text-[13px] text-adm-fg-muted">
              El logo y el favicon se cambian en{" "}
              <Link href="/admin/apariencia" className="text-adm-accent underline-offset-2 hover:underline">
                Apariencia
              </Link>
              .
            </p>
          </FormSection>

          <FormSection title="Contacto" description="WhatsApp es el canal principal: ahí llegan las consultas y los pedidos que se coordinan con vos.">
            <Field label="WhatsApp" hint={waHint(v.whatsapp_phone)} error={error("whatsapp_phone")}>
              <Input
                value={v.whatsapp_phone}
                onChange={(e) => set("whatsapp_phone", e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="5491123456789"
                leading="+"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email de contacto" error={error("contact_email")}>
                <Input type="email" value={v.contact_email} onChange={(e) => set("contact_email", e.target.value)} autoComplete="email" />
              </Field>
              <Field label="Teléfono" hint="Fijo o celular, como querés que se muestre." error={error("contact_phone")}>
                <Input value={v.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} autoComplete="tel" />
              </Field>
            </div>
            <Field label="Dirección" hint="Si tenés local o showroom. Se muestra en el pie de la tienda y en las políticas." error={error("address")}>
              <Textarea rows={2} value={v.address ?? ""} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" />
            </Field>
          </FormSection>

          <FormSection title="Región" description="Cómo se muestran los precios y las fechas en la tienda y en el panel.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Moneda" hint="Una sola moneda por tienda." error={error("currency")}>
                <Select value={v.currency} onChange={(e) => set("currency", e.target.value)} options={CURRENCIES.map((c) => ({ ...c }))} />
              </Field>
              <Field label="Idioma y formato" error={error("locale")}>
                <Select value={v.locale} onChange={(e) => set("locale", e.target.value)} options={LOCALES.map((c) => ({ ...c }))} />
              </Field>
            </div>
            <Field label="Zona horaria" hint="Se usa en las fechas de los pedidos, los vencimientos y las exportaciones." error={error("timezone")}>
              <Select value={v.timezone} onChange={(e) => set("timezone", e.target.value)} options={TIMEZONES.map((c) => ({ ...c }))} />
            </Field>
          </FormSection>

          <FormSection title="Redes sociales" description="Links completos. Las que dejes vacías no se muestran.">
            <div className="grid gap-4 sm:grid-cols-2">
              {SOCIAL_KEYS.map((key) => (
                <Field key={key} label={SOCIAL_LABELS[key].label} error={error(`social.${key}`)}>
                  <Input
                    type="url"
                    value={v.social[key]}
                    onChange={(e) => set(`social.${key}`, e.target.value)}
                    placeholder={SOCIAL_LABELS[key].placeholder}
                  />
                </Field>
              ))}
            </div>
          </FormSection>
          <button type="submit" hidden />
        </form>
      </Card>
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onDiscard={form.discard} errorCount={Object.keys(form.errors).length} />
    </>
  );
}

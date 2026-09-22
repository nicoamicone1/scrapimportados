"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createPage } from "@/app/admin/(panel)/paginas/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { toast } from "@/components/ui";
import { PAGE_TEMPLATES_META } from "@/lib/blocks/defaults";
import { cn } from "@/lib/cn";
import { PAGE_TYPE_LABELS, pageSlugError, type PageTemplateId } from "@/lib/schemas/page";
import { slugify } from "@/lib/slug";

export function NewPageDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [type, setType] = useState<"landing" | "legal" | "custom">("custom");
  const [template, setTemplate] = useState<PageTemplateId>("blank");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const slugError = slug ? pageSlugError(slug) : null;

  const reset = () => {
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setType("custom");
    setTemplate("blank");
    setErrors({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const r = await createPage({ title, slug, type, template });
    setPending(false);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      toast.error(r.error);
      return;
    }
    toast.success("Página creada");
    setOpen(false);
    reset();
    router.push(`/admin/paginas/${r.data.id}`);
  };

  return (
    <>
      <Button variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>
        Nueva página
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
        title="Nueva página"
        size="lg"
        dismissable={!pending}
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="new-page-form" loading={pending} disabled={!title.trim() || !slug || Boolean(slugError)}>
              Crear página
            </Button>
          </>
        }
      >
        <form id="new-page-form" onSubmit={submit} className="space-y-4">
          <Field label="Título" required error={errors.title}>
            <Input
              autoFocus
              value={title}
              maxLength={120}
              placeholder="Ciber Lunes"
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Dirección" required error={errors.slug?.[0] ?? slugError} hint={slug ? `Se va a ver en /${slug}` : "Se completa sola a partir del título."}>
            <Input
              value={slug}
              leading="/"
              className="font-mono"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value.replace(/\s+/g, "-")) + (/-$/.test(e.target.value) ? "-" : ""));
              }}
              onBlur={() => setSlug(slugify(slug))}
              spellCheck={false}
            />
          </Field>
          <Field label="Tipo">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              options={(["landing", "legal", "custom"] as const).map((t) => ({ value: t, label: PAGE_TYPE_LABELS[t] }))}
            />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-adm-fg">Empezar desde</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PAGE_TEMPLATES_META.map((t) => (
                <label
                  key={t.id}
                  className={cn(
                    "flex cursor-pointer gap-2.5 rounded-adm border p-3 text-sm",
                    template === t.id ? "border-adm-accent bg-adm-accent-soft" : "border-adm-border hover:bg-adm-hover",
                  )}
                >
                  <input
                    type="radio"
                    name="template"
                    checked={template === t.id}
                    onChange={() => {
                      setTemplate(t.id);
                      setType(t.type);
                    }}
                    className="mt-0.5 accent-[var(--adm-accent)]"
                  />
                  <span>
                    <span className="block font-medium text-adm-fg">{t.label}</span>
                    <span className="mt-0.5 block text-xs text-adm-fg-muted">{t.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </form>
      </Dialog>
    </>
  );
}

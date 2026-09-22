"use client";

import { useId } from "react";

import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { slugify } from "@/lib/slug";

/*
 * Campos SEO compartidos (A: productos y categorías · E: páginas · H: SEO global).
 * Controlado y sin estado propio: el padre guarda los valores.
 *
 *   <SeoFields
 *     value={{ title, description, slug }}
 *     onChange={(patch) => setSeo((s) => ({ ...s, ...patch }))}
 *     fallbackTitle={name}
 *     fallbackDescription={shortDescription}
 *     pathPrefix="/producto/"
 *   />
 *
 * - Si no pasás `slug` en `value`, no se muestra el campo de URL.
 * - El slug se normaliza con `slugify` al salir del campo (mientras escribís
 *   se permite el guion final para no pelear con el cursor).
 * - La vista previa usa el fallback cuando el título o la descripción SEO
 *   están vacíos (lo mismo que debería hacer el storefront).
 */

export const SEO_TITLE_LIMIT = 70;
export const SEO_DESCRIPTION_LIMIT = 160;

export interface SeoValue {
  title: string;
  description: string;
  slug?: string;
}

export interface SeoFieldsProps {
  value: SeoValue;
  onChange: (patch: Partial<SeoValue>) => void;
  /** Título usado si `value.title` está vacío (ej. el nombre del producto). */
  fallbackTitle?: string;
  /** Descripción usada si `value.description` está vacía (ej. descripción corta). */
  fallbackDescription?: string;
  /** Prefijo de la URL pública: "/producto/", "/categoria/", "/". */
  pathPrefix?: string;
  /** Origen para la vista previa (default: NEXT_PUBLIC_SITE_URL o el del navegador). */
  siteUrl?: string;
  /** Nombre de la tienda que se agrega al título en la vista previa (" | Tienda"). */
  siteName?: string;
  /** Errores por campo (ej. `fieldErrors` de una action): title, description, slug. */
  errors?: Partial<Record<"title" | "description" | "slug", string | string[] | undefined>>;
  /** Deshabilita la edición del slug (ej. la home). */
  slugDisabled?: boolean;
  /** Texto de ayuda del slug. */
  slugHint?: string;
  className?: string;
}

function hostOf(siteUrl: string | undefined): string {
  const raw = siteUrl || process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  try {
    return new URL(raw).host;
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span className={cn("tnum", length > max ? "text-adm-danger" : "text-adm-fg-muted")}>
      {length}/{max}
    </span>
  );
}

export function SeoFields({
  value,
  onChange,
  fallbackTitle = "",
  fallbackDescription = "",
  pathPrefix = "/",
  siteUrl,
  siteName,
  errors,
  slugDisabled,
  slugHint,
  className,
}: SeoFieldsProps) {
  const previewId = useId();
  const slugId = useId();
  const slugError = Array.isArray(errors?.slug) ? errors?.slug[0] : errors?.slug;
  const host = hostOf(siteUrl);
  const shownTitle = value.title.trim() || fallbackTitle.trim() || "Título de la página";
  const titleWithSite = siteName && !value.title.trim() ? `${shownTitle} | ${siteName}` : shownTitle;
  const shownDescription =
    value.description.trim() ||
    fallbackDescription.trim() ||
    "Agregá una descripción para que Google muestre un resumen claro de esta página.";
  const path = `${pathPrefix}${value.slug ?? ""}`.replace(/\/+/g, "/");
  const crumbs = path.split("/").filter(Boolean);
  const showSlug = value.slug !== undefined;

  return (
    <div className={cn("space-y-4", className)}>
      <div
        id={previewId}
        aria-label="Vista previa en Google"
        className="rounded-adm border border-adm-border bg-adm-surface px-4 py-3"
      >
        <p className="mb-1 text-[11px] font-medium tracking-wide text-adm-fg-muted uppercase">Vista previa en Google</p>
        <p className="truncate text-xs text-adm-fg-muted">
          {host}
          {crumbs.length ? ` › ${crumbs.join(" › ")}` : ""}
        </p>
        <p className="mt-0.5 truncate text-[17px] leading-snug text-adm-info">{truncate(titleWithSite, 65)}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-adm-fg-muted">{truncate(shownDescription, 165)}</p>
      </div>

      <Field
        label="Título para buscadores"
        hint={fallbackTitle ? `Si lo dejás vacío se usa «${truncate(fallbackTitle, 50)}».` : "Lo que aparece como título en Google."}
        error={errors?.title}
        aside={<Counter length={value.title.length} max={SEO_TITLE_LIMIT} />}
      >
        <Input
          value={value.title}
          maxLength={SEO_TITLE_LIMIT + 30}
          placeholder={fallbackTitle}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>

      <Field
        label="Descripción para buscadores"
        hint="Una o dos oraciones que inviten a entrar. Evitá repetir el título."
        error={errors?.description}
        aside={<Counter length={value.description.length} max={SEO_DESCRIPTION_LIMIT} />}
      >
        <Textarea
          rows={3}
          value={value.description}
          maxLength={SEO_DESCRIPTION_LIMIT + 60}
          placeholder={fallbackDescription}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>

      {showSlug ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={slugId} className="text-[13px] font-medium text-adm-fg">
            URL
          </label>
          <div className="flex min-w-0">
            <span className="inline-flex h-9 max-w-[45%] shrink-0 items-center truncate rounded-l-adm border border-r-0 border-adm-input-border bg-adm-surface-2 px-2.5 font-mono text-xs text-adm-fg-muted">
              {pathPrefix}
            </span>
            <Input
              id={slugId}
              value={value.slug ?? ""}
              disabled={slugDisabled}
              invalid={Boolean(slugError)}
              aria-describedby={`${slugId}-desc`}
              className="min-w-0 rounded-l-none font-mono text-[13px]"
              onChange={(e) => {
                // Normaliza mientras escribe sin comerse el guion final.
                const raw = e.target.value.replace(/\s+/g, "-");
                const trailing = /-$/.test(raw);
                const clean = slugify(raw);
                onChange({ slug: trailing && clean ? `${clean}-` : clean });
              }}
              onBlur={() => onChange({ slug: slugify(value.slug ?? "") })}
              spellCheck={false}
              autoCapitalize="off"
            />
          </div>
          <p id={`${slugId}-desc`} className={cn("text-xs", slugError ? "text-adm-danger" : "text-adm-fg-muted")}>
            {slugError ?? slugHint ?? "Sólo minúsculas, números y guiones. Si la cambiás, la URL vieja redirige a la nueva."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

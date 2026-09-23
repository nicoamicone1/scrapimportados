import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { StoreLink } from "@/components/store/StoreLink";
import { requireStore } from "@/lib/store/context";
import { getStoreDisplay } from "@/lib/store/display";
import { markdownToHtml, markdownToText } from "@/lib/store/markdown";
import { findPolicy, POLICY_LINKS } from "@/lib/store/policies";
import { buildMetadata } from "@/lib/store/seo";
import { storePath } from "@/lib/tenant/urls";

type Props = PageProps<"/s/[store]/politicas/[tipo]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store } = await requireStore(params);
  const [{ tipo }, { settings }] = await Promise.all([params, getStoreDisplay(store.id)]);
  const policy = findPolicy(tipo);
  if (!policy) return { title: "Página no encontrada" };
  return buildMetadata({
    store,
    title: policy.title,
    description: markdownToText(settings.policies[policy.key]) || `${policy.title} de ${settings.name}.`,
    path: `/politicas/${policy.slug}`,
    siteName: settings.name,
  });
}

/** Políticas (`store_settings.policies.*_md`). Acepta /politicas/terminos y el alias /politicas/terms (301). */
export default async function PolicyPage({ params }: Props) {
  const { store, basePath } = await requireStore(params);
  const [{ tipo }, { settings }] = await Promise.all([params, getStoreDisplay(store.id)]);
  const policy = findPolicy(tipo);
  if (!policy) notFound();
  if (tipo !== policy.slug) permanentRedirect(storePath(`/politicas/${policy.slug}`, basePath));
  const md = settings.policies[policy.key];
  const others = POLICY_LINKS.filter((p) => p.key !== policy.key && settings.policies[p.key]);

  return (
    <div className="store-container py-[var(--space-section-sm)]">
      <article className="max-w-[68ch]">
        <h1 className="h-page">{policy.title}</h1>
        {md ? (
          <div className="prose-store mt-6" dangerouslySetInnerHTML={{ __html: markdownToHtml(md, basePath) }} />
        ) : (
          <p className="mt-4 text-fg-muted">
            Todavía no cargamos esta información.
            {settings.contact_email ? (
              <>
                {" "}
                Si tenés una consulta, escribinos a{" "}
                <a href={`mailto:${settings.contact_email}`} className="link">
                  {settings.contact_email}
                </a>
                .
              </>
            ) : null}
          </p>
        )}
      </article>
      <nav aria-label="Otras políticas" className="mt-10 border-t border-border pt-4 text-sm">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {others.map((p) => (
            <li key={p.key}>
              <StoreLink href={`/politicas/${p.slug}`} className="link-quiet text-fg-muted hover:text-fg">
                {p.label}
              </StoreLink>
            </li>
          ))}
          <li>
            <StoreLink href="/arrepentimiento" className="link-quiet text-fg-muted hover:text-fg">
              Botón de arrepentimiento
            </StoreLink>
          </li>
        </ul>
      </nav>
    </div>
  );
}

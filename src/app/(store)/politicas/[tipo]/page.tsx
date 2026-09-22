import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { getStoreDisplay } from "@/lib/store/display";
import { markdownToHtml, markdownToText } from "@/lib/store/markdown";
import { findPolicy, POLICY_LINKS } from "@/lib/store/policies";
import { buildMetadata } from "@/lib/store/seo";

export async function generateMetadata({ params }: PageProps<"/politicas/[tipo]">): Promise<Metadata> {
  const [{ tipo }, { settings }] = await Promise.all([params, getStoreDisplay()]);
  const policy = findPolicy(tipo);
  if (!policy) return { title: "Página no encontrada" };
  return buildMetadata({
    title: policy.title,
    description: markdownToText(settings.policies[policy.key]) || `${policy.title} de ${settings.name}.`,
    path: `/politicas/${policy.slug}`,
    siteName: settings.name,
  });
}

/** Políticas (`store_settings.policies.*_md`). Acepta /politicas/terminos y el alias /politicas/terms (301). */
export default async function PolicyPage({ params }: PageProps<"/politicas/[tipo]">) {
  const [{ tipo }, { settings }] = await Promise.all([params, getStoreDisplay()]);
  const policy = findPolicy(tipo);
  if (!policy) notFound();
  if (tipo !== policy.slug) permanentRedirect(`/politicas/${policy.slug}`);
  const md = settings.policies[policy.key];
  const others = POLICY_LINKS.filter((p) => p.key !== policy.key && settings.policies[p.key]);

  return (
    <div className="store-container py-[var(--space-section-sm)]">
      <article className="max-w-[68ch]">
        <h1 className="h-page">{policy.title}</h1>
        {md ? (
          <div className="prose-store mt-6" dangerouslySetInnerHTML={{ __html: markdownToHtml(md) }} />
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
              <Link href={`/politicas/${p.slug}`} className="link-quiet text-fg-muted hover:text-fg">
                {p.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/arrepentimiento" className="link-quiet text-fg-muted hover:text-fg">
              Botón de arrepentimiento
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

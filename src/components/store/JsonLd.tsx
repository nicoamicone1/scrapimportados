import { serializeJsonLd, type JsonLd as JsonLdData } from "@/lib/store/seo";

/** `<script type="application/ld+json">` con el JSON escapado (no puede cerrar el tag). */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

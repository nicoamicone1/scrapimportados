import Script from "next/script";
import { Suspense } from "react";

import { platformGa4Id } from "./analytics";
import { PlatformPageViews } from "./PlatformPageViews";

/**
 * GA4 del sitio de la plataforma con `next/script`. El ID viene validado por
 * formato (`platformGa4Id`), así que interpolarlo en el snippet es seguro.
 * `send_page_view: false` porque las vistas las manda `PlatformPageViews`
 * en cada navegación (la inicial incluida): así los cambios de ruta del App
 * Router no quedan sin contar.
 */
export function PlatformAnalytics() {
  const ga4 = platformGa4Id();
  if (!ga4) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />
      <Script id="ecommy-platform-ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga4}',{send_page_view:false});`}
      </Script>
      {/* useSearchParams exige Suspense para no forzar CSR de toda la ruta. */}
      <Suspense fallback={null}>
        <PlatformPageViews id={ga4} />
      </Suspense>
    </>
  );
}

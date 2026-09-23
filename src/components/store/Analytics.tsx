import Script from "next/script";

import { TOKEN_PATH_RE } from "@/lib/store/analytics";
import type { IntegrationSettings } from "@/lib/store/settings";

import { PixelPageViews } from "./PixelPageViews";

/** Mismo patrón que `safePageLocation` (lib/store/analytics), como literal para el snippet. */
const PEDIDO_TOKEN_RE = String(TOKEN_PATH_RE);

/**
 * GA4 / GTM / Meta Pixel por ID (P0-18) con `next/script`. Los IDs vienen
 * validados por formato (`parseIntegrations`), así que interpolarlos en el
 * snippet es seguro. Los eventos los manda `track()` de `lib/store/analytics`.
 *
 * `/pedido/<token>` y `/carrito/recuperar/<token>`: el token da acceso al
 * pedido o al carrito guardado. Si la visita ENTRA por una de esas páginas,
 * GA4 se configura con `page_location` sin el token (sólo ahí: fijarlo
 * siempre congelaría la URL de las navegaciones siguientes); los eventos de
 * `track()` (incluido `purchase`) lo mandan limpio siempre, y la ruta sale con
 * `Referrer-Policy: no-referrer` (next.config.ts). Meta Pixel manda la URL de
 * la página por su cuenta y no se puede cambiar desde acá.
 */
export function StoreAnalytics({ integrations }: { integrations: IntegrationSettings }) {
  const { ga4_id: ga4, gtm_id: gtm, meta_pixel_id: pixel } = integrations;
  if (!ga4 && !gtm && !pixel) return null;
  return (
    <>
      {ga4 ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />
          <Script id="ecommy-ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;window.__ecommyGa4=true;gtag('js',new Date());(function(){var l=location.href,s=l.replace(${PEDIDO_TOKEN_RE},'$1');gtag('config','${ga4}',s!==l?{page_location:s}:{});})();`}
          </Script>
        </>
      ) : null}
      {gtm ? (
        <>
          <Script id="ecommy-gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');window.__ecommyGtm=true;`}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        </>
      ) : null}
      {pixel ? (
        <>
          <Script id="ecommy-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
          </Script>
          <PixelPageViews />
        </>
      ) : null}
    </>
  );
}

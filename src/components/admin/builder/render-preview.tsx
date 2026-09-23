import "server-only";

import type { ReactNode } from "react";

import { renderBlock } from "@/components/blocks/BlockRenderer";
import { BlockDivider, BlockSection, needsDivider } from "@/components/blocks/Section";
import type { BlockContext } from "@/components/blocks/types";
import { resolveBlockData } from "@/lib/blocks/resolve";
import type { Block } from "@/lib/blocks/schema";
import { bestPaymentDiscount } from "@/lib/pricing";
import { getStoreDisplay, transferLabelFor } from "@/lib/store/display";
import type { Theme } from "@/lib/theme";

import type { PreviewDevice } from "../appearance/preview-css";

/*
 * Render de previews del admin en el SERVER (agente E). Las actions de
 * `paginas` y `apariencia` devuelven estos nodos (RSC) al cliente, así el
 * preview usa exactamente los mismos componentes que la tienda
 * (`BlockRenderer`, `ProductCard`…), sin iframe.
 */

export async function previewContext(
  storeId: string,
  device: PreviewDevice,
  themeOverride?: Theme,
): Promise<BlockContext & { storeName: string }> {
  const display = await getStoreDisplay(storeId);
  const theme = themeOverride ?? display.settings.theme;
  const best = bestPaymentDiscount(display.paymentMethods);
  const transferPercent = best && theme.cards.showTransferPrice ? best.discountPercent : 0;
  return {
    storeName: display.settings.name,
    data: { products: {}, categories: {} },
    promotions: display.promotions,
    theme,
    transferPercent,
    timezone: display.settings.timezone,
    device,
    cardProps: {
      transferPercent,
      transferLabel: best ? transferLabelFor(best.name) : "transferencia",
      net:
        display.settings.tax.show_net_price && theme.cards.showNetPrice
          ? { defaultVat: display.settings.tax.default_vat_percent, label: display.settings.tax.label }
          : null,
      whatsappPhone: display.card.whatsappPhone,
    },
  };
}

export interface BlockPreviewNode {
  id: string;
  /** `null` = el bloque no muestra nada en la tienda (sin productos, vacío, vencido…). */
  node: ReactNode | null;
}

/**
 * Cada bloque renderizado por separado (el cliente los envuelve para seleccionarlos).
 * `only`: renderizar (y resolver datos) sólo esos ids; el resto de la lista se
 * usa de contexto (bloque anterior → regla divisoria, título pegado; posición).
 */
export async function renderBlockPreviews(
  storeId: string,
  blocks: Block[],
  device: PreviewDevice,
  only?: ReadonlySet<string>,
): Promise<BlockPreviewNode[]> {
  const ctx = await previewContext(storeId, device);
  // En el preview se muestran también los ocultos (el cliente los atenúa).
  const shown = blocks.map((b) => ({ ...b, style: { ...b.style, hidden: false } }) as Block);
  const targets = only ? shown.filter((b) => only.has(b.id)) : shown;
  ctx.data = await resolveBlockData(storeId, targets, ctx.promotions, { includeHidden: true });
  return shown.flatMap((block, i) => {
    if (only && !only.has(block.id)) return [];
    const content = renderBlock(block, ctx, i);
    if (content === null) return { id: block.id, node: null };
    const divider = ctx.theme.effects.dividers && needsDivider(shown[i - 1], block);
    return {
      id: block.id,
      node: (
        <>
          {divider ? <BlockDivider /> : null}
          <BlockSection block={block} prev={shown[i - 1]}>
            {content}
          </BlockSection>
        </>
      ),
    };
  });
}

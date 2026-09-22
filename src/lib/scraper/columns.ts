/** Columnas del CSV del importador (sin dependencias: se usa también en el cliente). */

/** Columnas del modo "actualizar por SKU". Sólo `sku` es obligatoria. */
export const CSV_UPDATE_COLUMNS = ["sku", "price", "compare_at_price", "cost", "stock", "status"] as const;

/** Columnas del modo "crear productos" (mismo formato que el export de H). */
export const CSV_CREATE_COLUMNS = [
  "handle",
  "name",
  "status",
  "categories",
  "tags",
  "option1_name",
  "option1_value",
  "option2_name",
  "option2_value",
  "option3_name",
  "option3_value",
  "sku",
  "barcode",
  "price",
  "compare_at_price",
  "cost",
  "stock",
  "weight_grams",
  "image_url",
  "seo_title",
  "seo_description",
  "brand",
  "description_html",
] as const;

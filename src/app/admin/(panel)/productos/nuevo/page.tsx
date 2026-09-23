import type { Metadata } from "next";

import { ProductForm } from "@/components/admin/products/ProductForm";
import { listCategoryOptions } from "@/lib/admin/categories";
import { listBrands, listTags } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/store/settings";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  const { store } = await requireAdmin();
  const [categories, brands, tags, siteName] = await Promise.all([
    listCategoryOptions(),
    listBrands(),
    listTags(),
    getSettings(store.id)
      .then((s) => s.name)
      .catch(() => undefined),
  ]);
  return <ProductForm product={null} categories={categories} brands={brands} tags={tags} siteName={siteName} />;
}

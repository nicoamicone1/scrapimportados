import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/admin/products/ProductForm";
import { listCategoryOptions } from "@/lib/admin/categories";
import { getAdminProduct, listBrands, listTags } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/store/settings";

export async function generateMetadata({ params }: PageProps<"/admin/productos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await getAdminProduct(id).catch(() => null);
  return { title: product?.name ?? "Producto" };
}

export default async function EditProductPage({ params }: PageProps<"/admin/productos/[id]">) {
  const { id } = await params;
  const { store } = await requireAdmin();
  const [product, categories, brands, tags, siteName] = await Promise.all([
    getAdminProduct(id),
    listCategoryOptions(),
    listBrands(),
    listTags(),
    getSettings(store.id)
      .then((s) => s.name)
      .catch(() => undefined),
  ]);
  if (!product) notFound();
  // `key`: al navegar entre productos (ej. después de duplicar) el form arranca de cero.
  return <ProductForm key={product.id} product={product} categories={categories} brands={brands} tags={tags} siteName={siteName} />;
}

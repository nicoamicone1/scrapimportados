import type { Metadata } from "next";

import { CategoriesManager } from "@/components/admin/categories/CategoriesManager";
import { listAdminCategories } from "@/lib/admin/categories";

export const metadata: Metadata = { title: "Categorías" };

export default async function CategoriesPage() {
  const categories = await listAdminCategories();
  return <CategoriesManager categories={categories} />;
}

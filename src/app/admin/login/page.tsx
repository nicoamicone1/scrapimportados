import { redirect } from "next/navigation";

/** El login vive en la plataforma (`/login`). Se conserva `next` y `reset`. */
export default async function AdminLoginRedirect({ searchParams }: PageProps<"/admin/login">) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (typeof params.next === "string") qs.set("next", params.next);
  if (params.reset === "1") redirect("/auth/reset");
  redirect(`/login${qs.size ? `?${qs}` : ""}`);
}

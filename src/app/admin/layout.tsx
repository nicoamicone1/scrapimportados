import type { Metadata } from "next";

import { Toaster } from "@/components/ui/Toaster";

import { archivo } from "../_brand/fonts";

import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
  robots: { index: false, follow: false },
};

/** Todo el admin vive dentro de `.admin-root` (tokens `--adm-*`). */
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className={`admin-root ${archivo.variable}`}>
      {children}
      <Toaster />
    </div>
  );
}

import type { Metadata } from "next";

import { Toaster } from "@/components/ui/Toaster";

import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
  robots: { index: false, follow: false },
};

/** Todo el admin vive dentro de `.admin-root` (tokens `--adm-*`). */
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="admin-root">
      {children}
      <Toaster />
    </div>
  );
}

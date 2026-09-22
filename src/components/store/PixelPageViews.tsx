"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** PageView de Meta Pixel en navegaciones del lado del cliente (la primera la manda el snippet). */
export function PixelPageViews() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === "function") fbq("track", "PageView");
  }, [pathname]);
  return null;
}

"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

import { Input, type InputProps } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

/**
 * Contraseña con "Mostrar": el registro pide una sola vez la contraseña (sin
 * "repetila"), así que ver lo que se escribió reemplaza la confirmación y
 * evita la cuenta con un typo. Recibe id y aria-* de `Field`.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type">>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} {...props} type={visible ? "text" : "password"} className={cn("pr-11", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-adm text-adm-fg-muted hover:text-adm-fg"
      >
        {visible ? <EyeOff className="size-4" strokeWidth={1.5} aria-hidden /> : <Eye className="size-4" strokeWidth={1.5} aria-hidden />}
      </button>
    </div>
  );
});

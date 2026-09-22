"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { testCoupon, type CouponTestResult } from "@/app/admin/(panel)/cupones/actions";
import { parseNumberInput } from "@/components/admin/pricing/shared";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/money";

/** "Probar cupón": usa la misma RPC que el checkout (`validate_coupon`). */
export function CouponTester({ code }: { code: string }) {
  const [subtotal, setSubtotal] = useState("50000");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<CouponTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const amount = parseNumberInput(subtotal);
      if (amount == null || amount < 0) {
        setError("Ingresá un subtotal válido.");
        setResult(null);
        return;
      }
      const res = await testCoupon({ code, subtotal: amount, email });
      if (!res.ok) {
        setError(res.fieldErrors?.email?.[0] ?? res.error);
        setResult(null);
        return;
      }
      setError(null);
      setResult(res.data);
    });

  return (
    <Card>
      <CardHeader title="Probar cupón" description="Simula el checkout con la validación real (vigencia, usos, mínimo y alcance). Usa la versión guardada." />
      <CardBody className="space-y-3">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <Field label="Subtotal del carrito">
            <Input type="number" inputMode="decimal" min={0} leading="$" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
          </Field>
          <Field label="Email del cliente" hint="Opcional: para probar usos por cliente y primera compra.">
            <Input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@mail.com" />
          </Field>
          <Button type="submit" loading={pending} className="w-full" size="lg">
            Probar {code}
          </Button>
        </form>
        {error ? <p className="text-[13px] text-adm-danger">{error}</p> : null}
        {result ? (
          <div aria-live="polite" className="rounded-adm border border-adm-border bg-adm-surface-2/60 p-3 text-[13px]">
            {result.valid ? (
              <>
                <p className="flex items-center gap-1.5 font-medium text-adm-success">
                  <CheckCircle2 className="size-4" aria-hidden /> El cupón aplica
                </p>
                <dl className="tnum mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                  {result.freeShipping ? (
                    <>
                      <dt className="text-adm-fg-muted">Envío</dt>
                      <dd className="text-right">Gratis</dd>
                    </>
                  ) : (
                    <>
                      <dt className="text-adm-fg-muted">Subtotal elegible</dt>
                      <dd className="text-right">{formatMoney(result.eligibleSubtotal)}</dd>
                      <dt className="text-adm-fg-muted">Descuento</dt>
                      <dd className="text-right">-{formatMoney(result.discount)}</dd>
                      <dt className="font-medium">Queda</dt>
                      <dd className="text-right font-medium">{formatMoney(result.totalAfter)}</dd>
                    </>
                  )}
                </dl>
                {result.testedWith ? <p className="mt-2 text-xs text-adm-fg-muted">Probado con un producto del alcance: {result.testedWith}.</p> : null}
              </>
            ) : (
              <p className="flex items-start gap-1.5 text-adm-danger">
                <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {result.reason}
              </p>
            )}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

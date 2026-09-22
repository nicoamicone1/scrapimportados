"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { saveCustomer } from "@/app/admin/(panel)/clientes/actions";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import type { AddressSnapshot } from "@/lib/admin/order-utils";

export interface CustomerFormValues {
  id?: string;
  name: string;
  email: string;
  phone: string;
  docNumber: string;
  address: AddressSnapshot;
  notes: string;
  tags: string;
}

const EMPTY: CustomerFormValues = {
  name: "",
  email: "",
  phone: "",
  docNumber: "",
  address: { street: "", number: "", floor: "", city: "", province: "", postal_code: "", notes: "" },
  notes: "",
  tags: "",
};

/** Alta / edición de cliente en un panel lateral. */
export function CustomerDrawer({ initial, mode = "create" }: { initial?: CustomerFormValues; mode?: "create" | "edit" }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CustomerFormValues>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const setAddr = (key: keyof AddressSnapshot, value: string) =>
    setValues((v) => ({ ...v, address: { ...v.address, [key]: value } }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await saveCustomer(values);
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(mode === "edit" ? "Cliente guardado." : "Cliente creado.");
    setOpen(false);
    if (mode === "create") router.push(`/admin/clientes/${res.data.id}`);
    else startTransition(() => router.refresh());
  };

  const formId = `customer-form-${values.id ?? "new"}`;

  return (
    <>
      {mode === "edit" ? (
        <Button
          icon={<Pencil />}
          onClick={() => {
            setValues(initial ?? EMPTY);
            setErrors({});
            setOpen(true);
          }}
        >
          Editar
        </Button>
      ) : (
        <Button
          variant="primary"
          icon={<Plus />}
          onClick={() => {
            setValues(EMPTY);
            setErrors({});
            setOpen(true);
          }}
        >
          Nuevo cliente
        </Button>
      )}
      <Drawer
        open={open}
        onOpenChange={(o) => !saving && setOpen(o)}
        title={mode === "edit" ? "Editar cliente" : "Nuevo cliente"}
        width="w-[480px]"
        dismissable={!saving}
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form={formId} variant="primary" loading={saving}>
              {mode === "edit" ? "Guardar" : "Crear cliente"}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="space-y-3 p-4">
          <Field label="Nombre" required error={errors.name}>
            <Input value={values.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" autoFocus />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" error={errors.email}>
              <Input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Teléfono" hint="Con código de área." error={errors.phone}>
              <Input type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="off" />
            </Field>
          </div>
          <Field label="DNI o CUIT" error={errors.docNumber}>
            <Input value={values.docNumber} onChange={(e) => set("docNumber", e.target.value)} />
          </Field>

          <fieldset className="space-y-3 border-t border-adm-border pt-3">
            <legend className="pt-3 text-[13px] font-medium">Dirección de envío</legend>
            <div className="grid grid-cols-6 gap-3">
              <Field label="Calle" className="col-span-4">
                <Input value={values.address.street} onChange={(e) => setAddr("street", e.target.value)} />
              </Field>
              <Field label="Número" className="col-span-2">
                <Input value={values.address.number} onChange={(e) => setAddr("number", e.target.value)} />
              </Field>
              <Field label="Piso / depto." className="col-span-2">
                <Input value={values.address.floor} onChange={(e) => setAddr("floor", e.target.value)} />
              </Field>
              <Field label="Localidad" className="col-span-4">
                <Input value={values.address.city} onChange={(e) => setAddr("city", e.target.value)} />
              </Field>
              <Field label="Provincia" className="col-span-4">
                <Input value={values.address.province} onChange={(e) => setAddr("province", e.target.value)} />
              </Field>
              <Field label="CP" className="col-span-2">
                <Input value={values.address.postal_code} onChange={(e) => setAddr("postal_code", e.target.value)} />
              </Field>
            </div>
          </fieldset>

          <Field label="Etiquetas" hint="Separadas por coma: mayorista, frecuente." error={errors.tags}>
            <Input value={values.tags} onChange={(e) => set("tags", e.target.value)} />
          </Field>
          <Field label="Notas" error={errors.notes}>
            <Textarea rows={3} value={values.notes} onChange={(e) => set("notes", e.target.value)} maxLength={5000} />
          </Field>
        </form>
      </Drawer>
    </>
  );
}

import { redirect } from "next/navigation";

/** El alta del "primer dueño" ya no existe: cada persona se registra y crea su tienda. */
export default function AdminSetupRedirect() {
  redirect("/registro");
}

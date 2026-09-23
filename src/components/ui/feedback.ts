import { toast } from "sonner";

/**
 * Corre una acción async mostrando al instante un toast "cargando" (feedback
 * en < 100 ms para acciones que se disparan desde menús "…", donde no hay un
 * botón que pueda mostrar spinner). El toast se cierra solo al terminar; los
 * mensajes de éxito/error los sigue mostrando la acción.
 */
export async function withPendingToast<T>(message: string, fn: () => Promise<T>): Promise<T> {
  const id = toast.loading(message);
  try {
    return await fn();
  } finally {
    toast.dismiss(id);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type OperationAccessClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

/**
 * Match operations' management policy: creator or database-defined GC staff.
 * Module access and participant read access do not authorize signature management.
 * This helper accepts a trusted server client; userId must come from verified auth.
 */
export async function requireOperationManager(
  client: OperationAccessClient,
  operationId: string | null,
  userId: string,
): Promise<void> {
  if (!operationId || !userId) throw new Error("Sin permiso para gestionar firmas");
  const [operation, staff] = await Promise.all([
    client.from("operations").select("id, created_by").eq("id", operationId).maybeSingle(),
    client.rpc("is_gc_staff", { _user_id: userId }),
  ]);
  if (operation.error || staff.error) {
    throw new Error("No se pudo verificar el permiso de la operación");
  }
  if (!operation.data || (operation.data.created_by !== userId && staff.data !== true)) {
    throw new Error("Sin permiso para gestionar firmas");
  }
}

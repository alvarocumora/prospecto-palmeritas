// Server fns del panel del proveedor autenticado.
// RLS ya restringe: cada proveedor solo lee sus propias filas.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MySupplier = {
  id: string;
  folio: string;
  legal_name: string;
  country: string;
  contact_name: string;
  phone_e164: string;
  email: string;
  status: string;
  created_at: string;
};

export type MyOffer = {
  id: string;
  product: string;
  status: string;
  tonnage_available_t: number | null;
  grade_value: number | null;
  grade_unit: string | null;
  port_or_delivery: string | null;
  created_at: string;
};

export type MyDocument = {
  id: string;
  doc_type: string;
  review_status: string;
  uploaded_at: string;
  storage_path: string;
};

/** Vincula el registro público (por email) al usuario autenticado si aún no tiene owner. */
export const claimMySupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = authUser?.user?.email?.toLowerCase();
    if (!email) return { linked: 0 };
    const { data, error } = await supabaseAdmin
      .from("suppliers")
      .update({ owner_user_id: context.userId })
      .is("owner_user_id", null)
      .eq("email", email)
      .select("id");
    if (error) throw error;
    return { linked: data?.length ?? 0 };
  });

export const getMySupplier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      supplier: MySupplier | null;
      offers: MyOffer[];
      documents: MyDocument[];
    }> => {
      const { data: supplier } = await context.supabase
        .from("suppliers")
        .select(
          "id, folio, legal_name, country, contact_name, phone_e164, email, status, created_at",
        )
        .eq("owner_user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!supplier) return { supplier: null, offers: [], documents: [] };

      const [{ data: offers }, { data: documents }] = await Promise.all([
        context.supabase
          .from("supplier_offers")
          .select(
            "id, product, status, tonnage_available_t, grade_value, grade_unit, port_or_delivery, created_at",
          )
          .eq("supplier_id", supplier.id)
          .order("created_at", { ascending: false }),
        context.supabase
          .from("supplier_documents")
          .select("id, doc_type, review_status, uploaded_at, storage_path")
          .eq("supplier_id", supplier.id)
          .order("uploaded_at", { ascending: false }),
      ]);
      return {
        supplier: supplier as MySupplier,
        offers: (offers ?? []) as MyOffer[],
        documents: (documents ?? []) as MyDocument[],
      };
    },
  );

import { supabase } from "@/integrations/supabase/client";

export async function upsertInquiry(args: {
  listingId: string;
  userId: string;
  message: string;
  currentStatus?: string | null;
}) {
  return supabase.from("property_deal_inquiries").upsert(
    {
      listing_id: args.listingId,
      inquirer_user_id: args.userId,
      message: args.message.trim(),
      status: args.currentStatus ?? "inquiry",
    },
    { onConflict: "listing_id,inquirer_user_id" },
  );
}

export async function signListingNda(args: {
  listingId: string;
  userId: string;
  signature: string;
}) {
  return supabase.from("property_deal_inquiries").upsert(
    {
      listing_id: args.listingId,
      inquirer_user_id: args.userId,
      nda_signed_at: new Date().toISOString(),
      nda_signature: args.signature,
      status: "nda_signed",
    },
    { onConflict: "listing_id,inquirer_user_id" },
  );
}

/** Sincroniza la etapa del deal tras firmar el NDA (best-effort). */
export async function markNdaStage(inquiryId: string) {
  return supabase.rpc("deal_advance", {
    p_inquiry_id: inquiryId,
    p_stage: "nda_firmado",
    p_note: "NDA firmado en la ficha del proyecto",
  });
}

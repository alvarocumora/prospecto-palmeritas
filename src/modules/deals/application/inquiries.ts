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

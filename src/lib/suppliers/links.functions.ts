// Server fns staff: gestión de enlaces de invitación al portal de proveedores.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InvitationLink = {
  id: string;
  token: string;
  label: string;
  opens_count: number;
  completions_count: number;
  active: boolean;
  created_at: string;
};

function randomToken(len = 8): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

export const listInvitationLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InvitationLink[]> => {
    const { data, error } = await context.supabase
      .from("invitation_links")
      .select("id, token, label, opens_count, completions_count, active, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as InvitationLink[];
  });

export const createInvitationLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ label: z.string().min(1).max(120) }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<InvitationLink> => {
    const token = randomToken(8);
    const { data: row, error } = await context.supabase
      .from("invitation_links")
      .insert({ token, label: data.label, created_by: context.userId, active: true })
      .select("id, token, label, opens_count, completions_count, active, created_at")
      .single();
    if (error) throw error;
    return row as InvitationLink;
  });

export const toggleInvitationLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("invitation_links")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Creates a project invitation row. Email delivery is best-effort (logs link if no email service).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id, email, role } = await req.json();
    if (!project_id || !email || !role) {
      return new Response(JSON.stringify({ error: "project_id, email, role required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use the user's auth so RLS enforces "only owners/admins can invite"
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "invalid user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await userClient
      .from("project_invitations")
      .insert({
        project_id,
        email: email.toLowerCase().trim(),
        role,
        invited_by: user.id,
      })
      .select("id, token, expires_at")
      .single();

    if (error) {
      console.error("invite insert error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build acceptance link — siempre en geocapitals.com, no en el preview.
    const link = `https://geocapitals.com/invitations/${data.token}`;

    // Email delivery placeholder — log for now, plug Resend/Lovable Emails later.
    console.log(`[invite] ${email} → ${link} (expires ${data.expires_at})`);

    return new Response(JSON.stringify({ ok: true, link, invitation_id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-project-invitation error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "@/hooks/useProjects";
import { toast } from "sonner";

export type SignatureEnvelope = {
  id: string;
  project_id: string;
  document_type: "qp_certificate" | "ni43101_report" | "compliance_report";
  document_title: string;
  document_hash: string;
  document_ref_id: string | null;
  status: "pending" | "partial" | "complete" | "rejected" | "expired";
  required_signers: number;
  completed_signers: number;
  created_at: string;
  completed_at: string | null;
};

export type DocumentSignature = {
  id: string;
  envelope_id: string;
  signer_user_id: string;
  signer_name: string;
  signer_email: string | null;
  signer_role: string;
  signing_order: number;
  status: "pending" | "signed" | "rejected";
  signed_at: string | null;
  signature_hmac: string | null;
  signed_document_hash: string | null;
  rejection_reason: string | null;
};

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function useSignatureEnvelopes() {
  const { active } = useProjects();
  const [envelopes, setEnvelopes] = useState<SignatureEnvelope[]>([]);
  const [signatures, setSignatures] = useState<DocumentSignature[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!active) {
      setEnvelopes([]);
      setSignatures([]);
      return;
    }
    setLoading(true);
    const [{ data: envs }, { data: sigs }] = await Promise.all([
      supabase
        .from("signature_envelopes")
        .select("*")
        .eq("project_id", active.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("document_signatures")
        .select("*")
        .eq("project_id", active.id)
        .order("signing_order"),
    ]);
    setEnvelopes((envs ?? []) as SignatureEnvelope[]);
    setSignatures((sigs ?? []) as DocumentSignature[]);
    setLoading(false);
  }, [active]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createEnvelope = useCallback(
    async (input: {
      document_type: SignatureEnvelope["document_type"];
      document_title: string;
      document_payload: string;
      document_ref_id?: string | null;
      signers: Array<{ user_id: string; name: string; role: string; email?: string }>;
    }) => {
      if (!active) return null;
      const document_hash = await sha256Hex(input.document_payload);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-envelope`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          action: "create",
          project_id: active.id,
          document_type: input.document_type,
          document_title: input.document_title,
          document_hash,
          document_ref_id: input.document_ref_id ?? null,
          signers: input.signers,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(`Error creando envelope: ${body.error ?? res.status}`);
        return null;
      }
      toast.success("Envelope de firma creado");
      await refresh();
      return body.envelope as SignatureEnvelope;
    },
    [active, refresh],
  );

  const signEnvelope = useCallback(
    async (envelope_id: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-envelope`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ action: "sign", envelope_id }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(`Error firmando: ${body.error ?? res.status}`);
        return false;
      }
      toast.success("Documento firmado con HMAC-SHA256");
      await refresh();
      return true;
    },
    [refresh],
  );

  const rejectEnvelope = useCallback(
    async (envelope_id: string, reason: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-envelope`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ action: "reject", envelope_id, rejection_reason: reason }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(`Error rechazando: ${body.error ?? res.status}`);
        return false;
      }
      toast.success("Firma rechazada");
      await refresh();
      return true;
    },
    [refresh],
  );

  return { envelopes, signatures, loading, refresh, createEnvelope, signEnvelope, rejectEnvelope };
}

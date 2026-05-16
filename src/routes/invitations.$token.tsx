import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CheckCircle2, AlertTriangle, Mail } from "lucide-react";

export const Route = createFileRoute("/invitations/$token")({
  head: () => ({ meta: [{ title: "Invitación — Trackmin GeoIntel" }] }),
  component: InvitationPage,
});

type Preview = {
  id: string;
  project_id: string;
  project_name: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
};

function InvitationPage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_invitation_preview", { _token: token });
      if (error || !data || data.length === 0) {
        setPreview(null);
      } else {
        setPreview(data[0] as Preview);
      }
      setLoadingPreview(false);
    })();
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    const { data, error } = await supabase.rpc("accept_project_invitation", { _token: token });
    const result = data as { ok?: boolean; error?: string } | null;
    if (error) {
      setResult({ ok: false, msg: error.message });
    } else if (result?.ok) {
      setResult({ ok: true, msg: "¡Bienvenido al proyecto!" });
      setTimeout(() => navigate({ to: "/dashboard" }), 1500);
    } else {
      setResult({ ok: false, msg: result?.error ?? "Error" });
    }
    setAccepting(false);
  };

  if (loading || loadingPreview) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center rounded border border-border bg-bg-secondary p-6">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <div className="font-mono font-semibold">Invitación inválida</div>
          <p className="text-xs text-muted-foreground mt-1">El enlace no existe o expiró.</p>
          <Link to="/" className="mt-4 inline-block text-xs font-mono text-gold underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const expired = new Date(preview.expires_at) < new Date() || preview.status !== "pending";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm w-full rounded border border-border bg-bg-secondary p-6">
        <Mail className="w-8 h-8 text-gold mx-auto mb-3" />
        <div className="text-center">
          <div className="text-[10px] uppercase font-mono text-muted-foreground">
            Invitación al proyecto
          </div>
          <h1 className="text-xl font-bold mt-1">{preview.project_name}</h1>
          <p className="text-xs text-muted-foreground mt-2">
            Te han invitado como <span className="text-gold font-mono">{preview.role}</span>
          </p>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">para {preview.email}</p>
        </div>

        {result ? (
          <div
            className={`mt-4 p-3 rounded text-center text-xs font-mono ${result.ok ? "bg-teal/10 text-teal" : "bg-destructive/10 text-destructive"}`}
          >
            {result.ok && <CheckCircle2 className="w-4 h-4 inline mr-1" />}
            {result.msg}
          </div>
        ) : expired ? (
          <div className="mt-4 p-3 rounded text-center text-xs font-mono bg-destructive/10 text-destructive">
            Esta invitación ya no es válida ({preview.status}).
          </div>
        ) : !user ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-center text-muted-foreground">
              Inicia sesión o regístrate para aceptar.
            </p>
            <Link
              to="/auth"
              className="block text-center px-3 py-2 rounded bg-gold text-bg-secondary text-xs font-mono font-semibold"
            >
              Iniciar sesión
            </Link>
          </div>
        ) : (
          <button
            onClick={accept}
            disabled={accepting}
            className="mt-4 w-full px-3 py-2 rounded bg-gold text-bg-secondary text-xs font-mono font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {accepting && <Loader2 className="w-3 h-3 animate-spin" />}
            Aceptar invitación
          </button>
        )}
      </div>
    </div>
  );
}

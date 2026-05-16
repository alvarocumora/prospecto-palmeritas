import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Restablecer contraseña — Trackmin GeoIntel" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts the token in URL hash on recovery
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setReady(true);
    } else {
      // Also check if we have an active session (already on recovery)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setReady(true);
        else toast.error("Link de recuperación inválido o expirado");
      });
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Contraseña actualizada");
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-xl font-mono font-bold text-foreground text-center">
          Nueva contraseña
        </h1>
        {ready ? (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded border border-border bg-bg-secondary p-6"
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={100}
              className="w-full px-3 py-2 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:border-gold"
              placeholder="Nueva contraseña"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded bg-gold text-background font-mono text-sm font-semibold hover:bg-gold-light disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Actualizar contraseña
            </button>
          </form>
        ) : (
          <p className="text-center text-sm text-muted-foreground font-mono">Validando link…</p>
        )}
      </div>
    </div>
  );
}

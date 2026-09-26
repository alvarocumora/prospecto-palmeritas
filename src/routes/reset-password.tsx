import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { translateAuthError, evaluatePassword } from "@/lib/auth-errors";
import { resetPasswordSchema, zodToFieldErrors } from "@/lib/auth-validation";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Restablecer contraseña — Geocapitals" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<"loading" | "ready" | "expired">("loading");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const pw = evaluatePassword(password);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("error=") || hash.includes("expired")) {
      setReady("expired");
      toast.error("Link de recuperación inválido o expirado");
      return;
    }
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setReady("ready");
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(session ? "ready" : "expired");
      if (!session) toast.error("Link de recuperación inválido o expirado");
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = resetPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      const fe = zodToFieldErrors<"password" | "confirm">(parsed.error);
      setErrors(fe);
      const first = Object.values(fe)[0];
      if (first) toast.error(first);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      const msg = translateAuthError(error).message;
      setErrors({ password: msg });
      toast.error(msg);
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
        {ready === "loading" && (
          <p className="text-center text-sm text-muted-foreground font-mono">Validando link…</p>
        )}
        {ready === "expired" && (
          <div className="rounded border border-border bg-bg-secondary p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              El enlace expiró o no es válido. Solicita uno nuevo desde el inicio de sesión.
            </p>
            <Link to="/auth" className="inline-block text-xs text-gold font-mono hover:underline">
              Ir a inicio de sesión →
            </Link>
          </div>
        )}
        {ready === "ready" && (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-4 rounded border border-border bg-bg-secondary p-6"
          >
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                required
                minLength={8}
                maxLength={100}
                aria-invalid={!!errors.password}
                className={`w-full px-3 py-2 rounded border bg-background text-foreground text-sm focus:outline-none ${
                  errors.password
                    ? "border-red-500/60 focus:border-red-500"
                    : "border-border focus:border-gold"
                }`}
                placeholder="Nueva contraseña"
                autoComplete="new-password"
                autoFocus
              />
              {errors.password && (
                <p role="alert" className="mt-1 text-[11px] font-mono text-red-400">
                  {errors.password}
                </p>
              )}
            </div>
            {password.length > 0 && (
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded ${
                      i <= pw.score
                        ? [
                            "bg-red-500",
                            "bg-orange-500",
                            "bg-yellow-500",
                            "bg-lime-500",
                            "bg-emerald-500",
                          ][pw.score]
                        : "bg-border"
                    }`}
                  />
                ))}
              </div>
            )}
            <div>
              <input
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
                }}
                required
                minLength={8}
                maxLength={100}
                aria-invalid={!!errors.confirm}
                className={`w-full px-3 py-2 rounded border bg-background text-foreground text-sm focus:outline-none ${
                  errors.confirm
                    ? "border-red-500/60 focus:border-red-500"
                    : "border-border focus:border-gold"
                }`}
                placeholder="Confirmar contraseña"
                autoComplete="new-password"
              />
              {errors.confirm && (
                <p role="alert" className="mt-1 text-[11px] font-mono text-red-400">
                  {errors.confirm}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded bg-gold text-background font-mono text-sm font-semibold hover:bg-gold-light disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Actualizar contraseña
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

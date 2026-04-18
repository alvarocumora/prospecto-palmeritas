import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Trackmin GeoIntel" },
      { name: "description", content: "Accede a tu plataforma minera de exploración y catastro." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Redirigiendo…");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bienvenido");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de autenticación";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) return toast.error("Ingresa tu email primero");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Revisa tu email para restablecer la contraseña");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/" className="flex items-center justify-center text-foreground hover:text-gold transition-colors">
          <Logo size={28} />
        </Link>

        <div className="rounded border border-border bg-bg-secondary p-6 space-y-4">
          <div className="flex gap-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-1.5 rounded ${mode === "login" ? "bg-gold/10 text-gold border border-gold/30" : "text-muted-foreground hover:text-foreground"}`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-1.5 rounded ${mode === "signup" ? "bg-gold/10 text-gold border border-gold/30" : "text-muted-foreground hover:text-foreground"}`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="text-[10px] uppercase font-mono text-muted-foreground">Nombre</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:border-gold"
                  placeholder="Tu nombre"
                  maxLength={100}
                />
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase font-mono text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full mt-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:border-gold"
                placeholder="geologo@empresa.com"
                maxLength={255}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono text-muted-foreground">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full mt-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:border-gold"
                placeholder="••••••••"
                maxLength={100}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded bg-gold text-background font-mono text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          {mode === "login" && (
            <button
              type="button"
              onClick={handleReset}
              className="w-full text-xs text-muted-foreground hover:text-gold font-mono"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </div>

        <p className="text-center text-[10px] font-mono text-muted-foreground">
          Geocapitals · catastro · geofísica · sondajes
        </p>
      </div>
    </div>
  );
}

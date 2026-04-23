import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { Loader2, MapPin, Layers, Mountain } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import authHero from "@/assets/auth-hero.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Geocapitals" },
      { name: "description", content: "Plataforma para exploración minera moderna. Catastro, geofísica, sondajes y muestreo." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  // Si ya hay sesión activa, redirigir al dashboard automáticamente.
  // Esto cubre tanto el caso "usuario ya logueado entra a /auth" como
  // "acaba de iniciar sesión y onAuthStateChange propagó el user".
  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Cuenta creada. Revisa tu email para confirmar.");
          setMode("login");
          return;
        }
        toast.success("Cuenta creada. Redirigiendo…");
        // El useEffect de arriba navega cuando user esté disponible.
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("No se pudo iniciar sesión");
        toast.success("Bienvenido");
        // El useEffect navega cuando AuthProvider propague el user.
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
    <div className="min-h-screen bg-background grid lg:grid-cols-[1.1fr_1fr]">
      {/* HERO panel — geological imagery */}
      <aside className="relative hidden lg:block overflow-hidden border-r border-border">
        <img
          src={authHero}
          alt="Prospecto minero andino al atardecer"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Gradient veil */}
        <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/80" />

        {/* Topographic SVG overlay */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.12] mix-blend-screen"
          viewBox="0 0 600 800"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          {Array.from({ length: 14 }).map((_, i) => (
            <path
              key={i}
              d={`M 0 ${120 + i * 45} Q 150 ${80 + i * 50} 300 ${140 + i * 42} T 600 ${110 + i * 48}`}
              stroke="currentColor"
              strokeWidth="0.6"
              className="text-gold"
            />
          ))}
        </svg>

        {/* Coordinate grid */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            color: "hsl(var(--gold))",
          }}
          aria-hidden="true"
        />

        {/* Top metadata strip */}
        <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-gold/70">
          <span>33°53′S · 71°06′W</span>
          <span>UTM 19H · WGS84</span>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-10 space-y-6">
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
              Plataforma de exploración minera
            </p>
            <h1 className="text-4xl font-bold leading-tight text-foreground max-w-md">
              Del afloramiento al{" "}
              <span className="text-gold">target perforable</span>.
            </h1>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Catastro SERNAGEOMIN, geofísica, sondajes, muestreo y QA/QC en una
              sola plataforma diseñada por geólogos.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md pt-4 border-t border-border/50">
            <Stat icon={<MapPin className="w-3 h-3" />} label="Catastro" value="Vivo" />
            <Stat icon={<Layers className="w-3 h-3" />} label="Capas" value="12+" />
            <Stat icon={<Mountain className="w-3 h-3" />} label="Escala" value="1:1k" />
          </div>
        </div>
      </aside>

      {/* FORM panel */}
      <main className="flex items-center justify-center px-6 py-12 relative">
        {/* Mobile-only background hint */}
        <div
          className="lg:hidden absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--gold)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--gold)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
          aria-hidden="true"
        />

        <div className="w-full max-w-sm space-y-8 relative">
          <Link
            to="/"
            className="flex items-center justify-center text-foreground hover:text-gold transition-colors"
          >
            <Logo size={32} />
          </Link>

          <div className="text-center space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
              {mode === "login" ? "Sesión geólogo" : "Nuevo registro"}
            </p>
            <h2 className="text-2xl font-bold text-foreground">
              {mode === "login" ? "Acceso al campo" : "Crear cuenta"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {mode === "login"
                ? "Continúa donde dejaste tu última campaña."
                : "Comienza a mapear, perforar y muestrear."}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-bg-secondary/60 backdrop-blur-sm p-6 space-y-4 shadow-2xl">
            <div className="flex gap-1 text-xs font-mono p-1 bg-background rounded-md border border-border">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 py-2 rounded transition-all ${
                  mode === "login"
                    ? "bg-gold text-background font-semibold shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 py-2 rounded transition-all ${
                  mode === "signup"
                    ? "bg-gold text-background font-semibold shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Crear cuenta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <Field label="Nombre del geólogo">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all"
                    placeholder="Tu nombre"
                    maxLength={100}
                  />
                </Field>
              )}
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full mt-1 px-3 py-2.5 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all"
                  placeholder="geologo@empresa.com"
                  maxLength={255}
                />
              </Field>
              <Field label="Contraseña">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full mt-1 px-3 py-2.5 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all"
                  placeholder="••••••••"
                  maxLength={100}
                />
              </Field>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 rounded bg-gold text-background font-mono text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === "login" ? "Entrar al proyecto" : "Crear cuenta"}
              </button>
            </form>

            {mode === "login" && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full text-xs text-muted-foreground hover:text-gold font-mono transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>

          <p className="text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Catastro · Geofísica · Sondajes · QA/QC
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-gold/70">
        {icon}
        <span className="font-mono text-[9px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="font-mono text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

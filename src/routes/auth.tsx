import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { z } from "zod";
import { Loader2, MapPin, Layers, Mountain, CheckCircle2, X, Mail } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import authHero from "@/assets/auth-hero.jpg";
import { translateAuthError, evaluatePassword } from "@/lib/auth-errors";
import { loginSchema, signupSchema, zodToFieldErrors } from "@/lib/auth-validation";

const authSearch = z.object({
  intent: z.enum(["investor", "owner", "team"]).optional(),
  mode: z.enum(["login", "signup"]).optional(),
  next: z.string().optional(),
});

function safeNext(next: string | undefined): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => authSearch.parse(s),
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Geocapitals" },
      {
        name: "description",
        content:
          "Plataforma para exploración minera moderna. Catastro, geofísica, sondajes y muestreo.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.mode ?? (search.intent ? "signup" : "login"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const pwStrength = evaluatePassword(password);

  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: safeNext(search.next), replace: true });
    }
  }, [authLoading, user, navigate, search.next]);

  const handleResendConfirm = async () => {
    if (!email) return toast.error("Ingresa tu email primero");
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setResending(false);
    if (error) toast.error(translateAuthError(error).message);
    else toast.success("Email de confirmación reenviado. Revisa tu bandeja.");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNeedsConfirm(false);
    setErrors({});

    // Validación zod con mensajes claros por campo
    const schema = mode === "signup" ? signupSchema : loginSchema;
    const parsed = schema.safeParse(
      mode === "signup"
        ? { displayName: displayName.trim(), email: email.trim(), password }
        : { email: email.trim(), password },
    );
    if (!parsed.success) {
      const fieldErrors = zodToFieldErrors<"displayName" | "email" | "password">(parsed.error);
      setErrors(fieldErrors);
      const first = Object.values(fieldErrors)[0];
      if (first) toast.error(first);
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const intentMeta = search.intent
          ? {
              signup_intent: search.intent,
              account_type_hint:
                search.intent === "investor"
                  ? "investor"
                  : search.intent === "owner"
                    ? "mining_owner"
                    : "geocapitals_team",
            }
          : {};
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: displayName || email.split("@")[0], ...intentMeta },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Cuenta creada. Revisa tu email para confirmar.");
          setNeedsConfirm(true);
          setMode("login");
          return;
        }
        toast.success("Cuenta creada. Redirigiendo…");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("No se pudo iniciar sesión");
        toast.success("Bienvenido");
      }
    } catch (err) {
      const t = translateAuthError(err);
      // Mapear errores del servidor al campo correspondiente
      if (t.code === "email_not_confirmed") {
        setNeedsConfirm(true);
        setErrors({ email: t.message });
      } else if (/email|correo/i.test(t.message) && !/contrase/i.test(t.message)) {
        setErrors({ email: t.message });
      } else if (/contrase|password/i.test(t.message)) {
        setErrors({ password: t.message });
      } else {
        setErrors({ form: t.message });
      }
      toast.error(t.message);
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
              Del afloramiento al <span className="text-gold">target perforable</span>.
            </h1>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Catastro SERNAGEOMIN, geofísica, sondajes, muestreo y QA/QC en una sola plataforma
              diseñada por geólogos.
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

          {search.intent === "investor" && (
            <div className="rounded border border-gold/40 bg-gold/5 px-3 py-2 text-[11px] text-gold font-mono text-center">
              ✦ Acceso institucional · KYC/AML post registro
            </div>
          )}

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

            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                try {
                  const result = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (result.error) throw result.error;
                  if (result.redirected) return;
                } catch (err) {
                  toast.error(translateAuthError(err).message);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded border border-border bg-background hover:border-gold text-foreground text-sm font-medium transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar con Google
            </button>

            <div className="relative flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              <div className="h-px flex-1 bg-border" />
              <span>o</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              {mode === "signup" && (
                <Field label="Nombre del geólogo" error={errors.displayName}>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (errors.displayName) setErrors((p) => ({ ...p, displayName: undefined }));
                    }}
                    aria-invalid={!!errors.displayName}
                    aria-describedby={errors.displayName ? "err-displayName" : undefined}
                    className={inputCls(!!errors.displayName)}
                    placeholder="Tu nombre"
                    maxLength={100}
                    autoComplete="name"
                  />
                </Field>
              )}
              <Field label="Email" error={errors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                  }}
                  required
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "err-email" : undefined}
                  className={inputCls(!!errors.email)}
                  placeholder="geologo@empresa.com"
                  maxLength={255}
                  autoComplete="email"
                  inputMode="email"
                />
              </Field>
              <Field label="Contraseña" error={errors.password}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                  }}
                  required
                  minLength={8}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "err-password" : undefined}
                  className={inputCls(!!errors.password)}
                  placeholder="••••••••"
                  maxLength={100}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </Field>
              {mode === "signup" && password.length > 0 && (
                <PasswordStrengthMeter
                  score={pwStrength.score}
                  label={pwStrength.label}
                  checks={pwStrength.checks}
                />
              )}
              {errors.form && (
                <div
                  role="alert"
                  className="rounded border border-red-500/40 bg-red-500/5 px-3 py-2 text-[11px] font-mono text-red-400"
                >
                  {errors.form}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 rounded bg-gold text-background font-mono text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === "login" ? "Entrar al proyecto" : "Crear cuenta"}
              </button>
            </form>

            {needsConfirm && (
              <button
                type="button"
                onClick={handleResendConfirm}
                disabled={resending}
                className="w-full inline-flex items-center justify-center gap-2 text-xs text-gold font-mono border border-gold/40 rounded px-3 py-2 hover:bg-gold/10 disabled:opacity-60"
              >
                <Mail className="w-3.5 h-3.5" />
                {resending ? "Reenviando…" : "Reenviar email de confirmación"}
              </button>
            )}

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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {error && (
        <p
          role="alert"
          id={`err-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
          className="mt-1 text-[11px] font-mono text-red-400"
        >
          {error}
        </p>
      )}
    </label>
  );
}

function inputCls(hasError: boolean) {
  return `w-full mt-1 px-3 py-2.5 rounded border bg-background text-foreground text-sm focus:outline-none focus:ring-1 transition-all ${
    hasError
      ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/30"
      : "border-border focus:border-gold focus:ring-gold/30"
  }`;
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

function PasswordStrengthMeter({
  score,
  label,
  checks,
}: {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  checks: { len: boolean; upper: boolean; lower: boolean; digit: boolean; symbol: boolean };
}) {
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-emerald-500"];
  const items: Array<[keyof typeof checks, string]> = [
    ["len", "8+ caracteres"],
    ["upper", "Mayúscula"],
    ["lower", "Minúscula"],
    ["digit", "Número"],
    ["symbol", "Símbolo"],
  ];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded ${i <= score ? colors[score] : "bg-border"}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-muted-foreground">
          Fortaleza: <span className="text-foreground">{label}</span>
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {items.map(([k, lbl]) => (
          <li key={k} className="flex items-center gap-1 text-[10px] font-mono">
            {checks[k] ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            ) : (
              <X className="w-3 h-3 text-muted-foreground/50" />
            )}
            <span className={checks[k] ? "text-foreground" : "text-muted-foreground/70"}>
              {lbl}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

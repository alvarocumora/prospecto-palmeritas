import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { z } from "zod";
import { Loader2, CheckCircle2, X, Mail, Radio, Cpu, Radar, Fingerprint } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/publicUrl";

import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
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
      { title: "Acceso a GeoCapitals · Inversiones y geointeligencia" },
      {
        name: "description",
        content:
          "Accede a tu espacio GeoCapitals para evaluar proyectos mineros, gestionar inversiones y usar herramientas profesionales.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup";

/* -------------------------------------------------------------------------- */
/*  Cinematic left panel — "Descenso a la mina"                               */
/* -------------------------------------------------------------------------- */

const BOOT_LINES = [
  "[00.00] geocapitals.core :: initializing",
  "[00.12] auth.gateway :: TLSv1.3 handshake OK",
  "[00.24] catastro.stream :: SERNAGEOMIN online",
  "[00.41] seismic.array :: 12 nodes locked",
  "[00.63] elevator.shaft :: winch armed",
  "[00.88] ni43101.vault :: encrypted / QP-signed",
  "[01.05] awaiting operator credentials…",
];

function useTicker(intervalMs: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => v + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return n;
}

function MineDescentPanel() {
  const [boot, setBoot] = useState<string[]>([]);
  const [depth, setDepth] = useState(0);
  const [mounted, setMounted] = useState(false);
  const tick = useTicker(90);

  useEffect(() => setMounted(true), []);

  // Boot log typewriter
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      setBoot((prev) => (i < BOOT_LINES.length ? [...prev, BOOT_LINES[i++]] : prev));
      if (i >= BOOT_LINES.length) clearInterval(id);
    }, 320);
    return () => clearInterval(id);
  }, []);

  // Depth counter loops slowly
  useEffect(() => {
    const id = setInterval(() => setDepth((d) => (d + 3.7) % 2400), 60);
    return () => clearInterval(id);
  }, []);

  // Seismic waveform points
  const wave = Array.from({ length: 64 }).map((_, i) => {
    const x = (i / 63) * 100;
    const y =
      50 +
      Math.sin((i + tick) * 0.35) * 14 +
      Math.sin((i + tick) * 0.11) * 6 +
      Math.sin((i + tick) * 1.73) * 1;
    return `${x},${y}`;
  });

  const lat = (33.8933 + Math.sin(tick * 0.02) * 0.0004).toFixed(6);
  const lng = (-71.1022 + Math.cos(tick * 0.02) * 0.0004).toFixed(6);

  if (!mounted) {
    return (
      <aside
        className="relative hidden lg:flex flex-col overflow-hidden bg-[#05070a] border-r border-white/5"
        aria-hidden="true"
      />
    );
  }

  return (
    <aside className="relative hidden lg:flex flex-col overflow-hidden bg-[#05070a] text-[#c9d4e3] border-r border-white/5">
      {/* Ambient gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(224,167,66,0.10),transparent_55%),radial-gradient(circle_at_80%_90%,rgba(40,120,220,0.10),transparent_55%)]" />

      {/* Coordinate grid */}
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(224,167,66,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(224,167,66,0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
        aria-hidden="true"
      />

      {/* Scanline */}
      <div
        className="pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-[#e0a742]/10 to-transparent animate-[scan_6s_linear_infinite]"
        aria-hidden="true"
      />

      {/* Top HUD */}
      <div className="relative z-10 flex items-center justify-between p-6 font-mono text-[10px] uppercase tracking-[0.28em] text-[#e0a742]/80">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          link seguro · geocapitals/core
        </div>
        <div>
          {lat}°S · {Math.abs(Number(lng)).toFixed(6)}°W
        </div>
      </div>

      {/* Center: shaft + depth */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-10">
        <div className="grid grid-cols-[auto_1fr] gap-8 items-center w-full max-w-lg">
          {/* Shaft SVG */}
          <div className="relative h-[380px] w-24">
            <svg viewBox="0 0 96 380" className="h-full w-full">
              {/* Rails */}
              <line x1="18" y1="0" x2="18" y2="380" stroke="#e0a742" strokeOpacity="0.35" />
              <line x1="78" y1="0" x2="78" y2="380" stroke="#e0a742" strokeOpacity="0.35" />
              {/* Ties */}
              {Array.from({ length: 14 }).map((_, i) => (
                <line
                  key={i}
                  x1="10"
                  x2="86"
                  y1={12 + i * 28}
                  y2={12 + i * 28}
                  stroke="#e0a742"
                  strokeOpacity="0.15"
                />
              ))}
              {/* Cable */}
              <line
                x1="48"
                y1="0"
                x2="48"
                y2="380"
                stroke="#e0a742"
                strokeOpacity="0.5"
                strokeDasharray="2 4"
              />
              {/* Elevator car */}
              <g
                style={{
                  transform: `translateY(${(depth / 2400) * 320}px)`,
                  transition: "transform 60ms linear",
                }}
              >
                <rect x="18" y="4" width="60" height="42" rx="3" fill="#0b0f14" stroke="#e0a742" />
                <rect x="24" y="10" width="48" height="4" fill="#e0a742" opacity="0.9" />
                <rect x="24" y="18" width="48" height="2" fill="#e0a742" opacity="0.4" />
                <rect x="24" y="24" width="30" height="2" fill="#e0a742" opacity="0.4" />
                <rect x="24" y="30" width="40" height="2" fill="#e0a742" opacity="0.25" />
                <circle cx="30" cy="40" r="1.5" fill="#e0a742" />
                <circle cx="66" cy="40" r="1.5" fill="#e0a742" />
              </g>
            </svg>
            <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#e0a742]/40 to-transparent" />
          </div>

          {/* Depth + telemetry */}
          <div className="space-y-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#e0a742]/70">
                Profundidad de acceso
              </div>
              <div className="mt-1 font-mono text-6xl font-bold text-white tabular-nums leading-none">
                {Math.floor(depth).toString().padStart(4, "0")}
                <span className="text-[#e0a742] text-2xl align-top ml-1">m</span>
              </div>
              <div className="mt-2 h-1 rounded bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#e0a742] via-[#f5c56a] to-[#e0a742]"
                  style={{ width: `${(depth / 2400) * 100}%` }}
                />
              </div>
            </div>

            {/* Seismic waveform */}
            <div>
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-[#e0a742]/70">
                <span className="inline-flex items-center gap-1.5">
                  <Radio className="w-3 h-3" /> seismic · ch-07
                </span>
                <span className="text-emerald-400">stable</span>
              </div>
              <svg viewBox="0 0 100 100" className="mt-2 w-full h-16" preserveAspectRatio="none">
                <polyline
                  points={wave.join(" ")}
                  fill="none"
                  stroke="#e0a742"
                  strokeWidth="0.6"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            {/* Boot log */}
            <div className="rounded border border-white/5 bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-emerald-300/80 h-32 overflow-hidden">
              {boot.map((l, i) => (
                <div
                  key={i}
                  className={i === boot.length - 1 ? "text-white" : "text-emerald-300/70"}
                >
                  {l}
                </div>
              ))}
              {boot.length >= BOOT_LINES.length && (
                <div className="text-[#e0a742] animate-pulse">&gt; _</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom brand */}
      <div className="relative z-10 p-8 space-y-3 border-t border-white/5 bg-black/30">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#e0a742]">
          Sala de control · Geocapitals
        </p>
        <h1 className="text-3xl font-bold leading-tight text-white max-w-md">
          Del prospecto al <span className="text-[#e0a742]">deal cerrado</span>.
        </h1>
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5 font-mono text-[10px] uppercase tracking-wider">
          <Metric icon={<Radar className="w-3 h-3" />} label="Catastro" value="LIVE" />
          <Metric icon={<Cpu className="w-3 h-3" />} label="Modelo" value="v.42" />
          <Metric icon={<Fingerprint className="w-3 h-3" />} label="QP" value="Signed" />
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%   { transform: translateY(-10%); }
          100% { transform: translateY(110vh); }
        }
      `}</style>
    </aside>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[#e0a742]/70">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-white text-sm font-semibold tracking-wider">{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Investor journey: clear institutional offer, not an operations login.      */
/* -------------------------------------------------------------------------- */

function InvestorIntroPanel() {
  const steps = [
    ["01", "Evalúa", "Explora proyectos y revisa la evidencia disponible."],
    ["02", "Verifica", "Completa tu identidad y accede a documentos."],
    ["03", "Da seguimiento", "Consulta tickets y posiciones confirmadas."],
  ];
  return (
    <aside className="relative hidden overflow-hidden border-r border-white/10 bg-[#111626] text-white lg:flex lg:flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(50,80,170,0.20),transparent_50%)]"
      />
      <div className="relative flex flex-1 flex-col justify-center px-12 py-20 xl:px-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.27em] text-[#aebce9]">
          Geocapitals · Espacio del inversionista
        </p>
        <h1 className="mt-7 max-w-lg font-serif text-5xl leading-tight">
          De la geología al capital informado.
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-white/70">
          Evalúa oportunidades mineras, consulta documentos y sigue el estado de tus inversiones
          desde un solo lugar.
        </p>
        <ol className="mt-12 max-w-lg divide-y divide-white/10 border-y border-white/10">
          {steps.map(([number, title, description]) => (
            <li key={number} className="flex gap-5 py-5">
              <span className="font-mono text-sm text-[#e0a742]">{number}</span>
              <div>
                <h2 className="text-base font-medium">{title}</h2>
                <p className="mt-1 text-sm text-white/60">{description}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-md text-xs leading-relaxed text-white/50">
          Las simulaciones son referenciales. Las solicitudes no representan posiciones confirmadas
          ni garantías de rentabilidad.
        </p>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*  Auth page                                                                 */
/* -------------------------------------------------------------------------- */

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const search = Route.useSearch();
  const isInvestor = search.intent === "investor";
  const [mode, setMode] = useState<Mode>(search.mode ?? (search.intent ? "signup" : "login"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);
  const [authorizing, setAuthorizing] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const pwStrength = evaluatePassword(password);

  // Re-entering /auth from a different client journey must use its intended mode.
  useEffect(() => {
    setMode(search.mode ?? (search.intent ? "signup" : "login"));
  }, [search.mode, search.intent]);
  const authSteps = useRef([
    "Validando credenciales…",
    "Firmando token QP…",
    "Autorizando acceso a galería…",
    "Abriendo compuertas…",
  ]);

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
      options: { emailRedirectTo: publicUrl(safeNext(search.next)) },
    });
    setResending(false);
    if (error) toast.error(translateAuthError(error).message);
    else toast.success("Email de confirmación reenviado. Revisa tu bandeja.");
  };

  const runAuthorizationSequence = () => {
    let i = 0;
    setAuthorizing(authSteps.current[0]);
    const id = setInterval(() => {
      i++;
      if (i >= authSteps.current.length) {
        clearInterval(id);
        return;
      }
      setAuthorizing(authSteps.current[i]);
    }, 420);
    return () => {
      clearInterval(id);
      setAuthorizing(null);
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNeedsConfirm(false);
    setErrors({});

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
    const stopSequence = runAuthorizationSequence();
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
            emailRedirectTo: publicUrl(safeNext(search.next)),
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
        toast.success("Acceso autorizado. Descendiendo…");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("No se pudo iniciar sesión");
        toast.success("Acceso autorizado. Descendiendo…");
      }
    } catch (err) {
      const t = translateAuthError(err);
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
      stopSequence();
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) return toast.error("Ingresa tu email primero");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: publicUrl("/reset-password"),
    });
    if (error) toast.error(error.message);
    else toast.success("Revisa tu email para restablecer la contraseña");
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-[#c9d4e3] grid lg:grid-cols-[1.15fr_1fr]">
      {isInvestor ? <InvestorIntroPanel /> : <MineDescentPanel />}

      {/* FORM panel */}
      <main className="relative flex items-center justify-center px-6 py-12 overflow-hidden">
        {/* Ambient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(224,167,66,0.08),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#e0a742 1px, transparent 1px), linear-gradient(90deg, #e0a742 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
          aria-hidden="true"
        />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.65))] pointer-events-none" />

        <div className="w-full max-w-sm space-y-6 relative">
          <Link
            to="/"
            className="flex items-center justify-center text-white hover:text-[#e0a742] transition-colors"
          >
            <Logo size={32} />
          </Link>

          <div className="text-center space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#e0a742]">
              {isInvestor ? "Espacio del inversionista" : "Acceso seguro a GeoCapitals"}
            </p>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {isInvestor
                ? mode === "login"
                  ? "Ingresa a tus inversiones"
                  : "Crea tu cuenta de inversión"
                : mode === "login"
                  ? "Ingresa a tu espacio"
                  : "Crea tu cuenta"}
            </h2>
            <p className="text-xs text-[#8a97ab]">
              {isInvestor
                ? mode === "login"
                  ? "Revisa tus solicitudes, documentos y posiciones confirmadas."
                  : "Explora oportunidades y completa la verificación de identidad antes de invertir."
                : mode === "login"
                  ? "Accede a tus proyectos, catastro y herramientas profesionales."
                  : "Crea tus credenciales para acceder a GeoCapitals."}
            </p>
          </div>

          {search.intent === "investor" && (
            <div className="rounded border border-[#e0a742]/40 bg-[#e0a742]/5 px-3 py-2 text-[11px] text-[#e0a742] font-mono text-center">
              Verificación de identidad requerida antes de formalizar una inversión.
            </div>
          )}

          <div className="relative rounded-lg border border-white/10 bg-[#0a0e13]/80 backdrop-blur-sm p-6 space-y-4 shadow-[0_30px_80px_-30px_rgba(224,167,66,0.35)]">
            {/* Corner brackets */}
            <CornerBrackets />

            <div className="flex gap-1 text-xs font-mono p-1 bg-black/60 rounded-md border border-white/5">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 py-2 rounded transition-all ${
                  mode === "login"
                    ? "bg-[#e0a742] text-black font-semibold shadow"
                    : "text-[#8a97ab] hover:text-white"
                }`}
              >
                Ingresar
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 py-2 rounded transition-all ${
                  mode === "signup"
                    ? "bg-[#e0a742] text-black font-semibold shadow"
                    : "text-[#8a97ab] hover:text-white"
                }`}
              >
                Registrar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              {mode === "signup" && (
                <Field label="Nombre completo" error={errors.displayName}>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (errors.displayName) setErrors((p) => ({ ...p, displayName: undefined }));
                    }}
                    aria-invalid={!!errors.displayName}
                    className={inputCls(!!errors.displayName)}
                    placeholder="Tu nombre"
                    maxLength={100}
                    autoComplete="name"
                  />
                </Field>
              )}
              <Field label="Identificador (email)" error={errors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                  }}
                  required
                  aria-invalid={!!errors.email}
                  className={inputCls(!!errors.email)}
                  placeholder={isInvestor ? "tu@correo.com" : "correo@empresa.com"}
                  maxLength={255}
                  autoComplete="email"
                  inputMode="email"
                />
              </Field>
              <Field label="Clave de acceso" error={errors.password}>
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

              {authorizing && (
                <div className="rounded border border-[#e0a742]/40 bg-black/60 px-3 py-2 text-[11px] font-mono text-[#e0a742] flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="truncate">{authorizing}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full py-3 mt-2 rounded bg-[#e0a742] text-black font-mono text-sm font-semibold uppercase tracking-[0.2em] hover:bg-[#f5c56a] transition-colors disabled:opacity-70 inline-flex items-center justify-center gap-2 shadow-[0_0_30px_-5px_rgba(224,167,66,0.6)] overflow-hidden"
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Fingerprint className="w-4 h-4" />
                )}
                <span className="relative">
                  {mode === "login" ? "Ingresar a mi cuenta" : "Crear cuenta"}
                </span>
              </button>
            </form>

            {needsConfirm && (
              <button
                type="button"
                onClick={handleResendConfirm}
                disabled={resending}
                className="w-full inline-flex items-center justify-center gap-2 text-xs text-[#e0a742] font-mono border border-[#e0a742]/40 rounded px-3 py-2 hover:bg-[#e0a742]/10 disabled:opacity-60"
              >
                <Mail className="w-3.5 h-3.5" />
                {resending ? "Reenviando…" : "Reenviar email de confirmación"}
              </button>
            )}

            {mode === "login" && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full text-xs text-[#8a97ab] hover:text-[#e0a742] font-mono transition-colors"
              >
                ¿Olvidaste tu clave de acceso?
              </button>
            )}
          </div>

          <p className="text-center text-[10px] font-mono uppercase tracking-[0.35em] text-[#5f6b7d]">
            {isInvestor
              ? "Proyectos · Verificación · Portafolio · Wallet"
              : "Catastro · Geofísica · Sondajes · QA/QC"}
          </p>
        </div>
      </main>
    </div>
  );
}

function CornerBrackets() {
  const cls = "absolute w-3 h-3 border-[#e0a742]/60 pointer-events-none";
  return (
    <>
      <span className={`${cls} -top-px -left-px border-t border-l`} />
      <span className={`${cls} -top-px -right-px border-t border-r`} />
      <span className={`${cls} -bottom-px -left-px border-b border-l`} />
      <span className={`${cls} -bottom-px -right-px border-b border-r`} />
    </>
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
      <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-[#8a97ab]">
        {label}
      </span>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-[11px] font-mono text-red-400">
          {error}
        </p>
      )}
    </label>
  );
}

function inputCls(hasError: boolean) {
  return `w-full mt-1 px-3 py-2.5 rounded border bg-black/50 text-white text-sm placeholder:text-[#5f6b7d] focus:outline-none focus:ring-1 transition-all ${
    hasError
      ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/30"
      : "border-white/10 focus:border-[#e0a742] focus:ring-[#e0a742]/30"
  }`;
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
            className={`h-1 flex-1 rounded ${i <= score ? colors[score] : "bg-white/10"}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-[#8a97ab]">
          Fortaleza: <span className="text-white">{label}</span>
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {items.map(([k, lbl]) => (
          <li key={k} className="flex items-center gap-1 text-[10px] font-mono">
            {checks[k] ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <X className="w-3 h-3 text-[#5f6b7d]" />
            )}
            <span className={checks[k] ? "text-white" : "text-[#5f6b7d]"}>{lbl}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import heroMining from "@/assets/hero-mining.jpg";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/publicUrl";

import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { translateAuthError, evaluatePassword } from "@/lib/auth-errors";
import { emailSchema, loginSchema, signupSchema, zodToFieldErrors } from "@/lib/auth-validation";

const authSearch = z.object({
  intent: z.enum(["investor", "owner", "team"]).optional(),
  mode: z.enum(["login", "signup"]).optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => authSearch.parse(s),
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Geocapitals" },
      {
        name: "description",
        content: "Inicia sesión o crea tu cuenta de Geocapitals.",
      },
    ],
  }),
  component: AuthPage,
});

function safeAuthNext(next?: string) {
  // Reject backslashes and control characters before either URL parser handles the path.
  // eslint-disable-next-line no-control-regex
  if (!next?.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) {
    return "/dashboard";
  }
  return next;
}

type Mode = "login" | "signup";

function AuthPage() {
  const search = Route.useSearch();
  return (
    <AuthForm key={JSON.stringify([search.mode, search.intent, search.next])} search={search} />
  );
}

function AuthForm({ search }: { search: z.infer<typeof authSearch> }) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const pwStrength = evaluatePassword(password);
  useEffect(() => {
    if (!authLoading && user) {
      navigate({ href: safeAuthNext(search.next), replace: true });
    }
  }, [authLoading, user, navigate, search.next]);

  const getEmail = () => {
    const parsed = emailSchema.safeParse(email);
    if (parsed.success) return parsed.data;
    setErrors((previous) => ({ ...previous, email: parsed.error.issues[0]?.message }));
    emailInput.current?.focus();
  };

  const handleResendConfirm = async () => {
    const address = getEmail();
    if (!address) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: address,
        options: { emailRedirectTo: publicUrl(safeAuthNext(search.next)) },
      });
      if (error) throw error;
      toast.success("Enviamos un nuevo enlace de confirmación.");
    } catch (error) {
      toast.error(translateAuthError(error).message);
    } finally {
      setResending(false);
    }
  };

  const changeMode = (nextMode: Mode) => {
    if (mode === nextMode) return;
    setMode(nextMode);
    setErrors({});
    setPassword("");
    setShowPassword(false);
    setNeedsConfirm(false);
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
      const firstField = Object.keys(fieldErrors)[0];
      if (firstField) e.currentTarget.querySelector<HTMLElement>(`#auth-${firstField}`)?.focus();
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
          email: parsed.data.email,
          password,
          options: {
            emailRedirectTo: publicUrl(safeAuthNext(search.next)),
            data: {
              display_name: displayName.trim() || parsed.data.email.split("@")[0],
              ...intentMeta,
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNeedsConfirm(true);
          setMode("login");
          setPassword("");
          setShowPassword(false);
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password,
        });
        if (error) throw error;
        if (!data.session) throw new Error("No se pudo iniciar sesión");
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
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const address = getEmail();
    if (!address) return;
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: publicUrl("/reset-password"),
      });
      if (error) throw error;
      toast.success("Revisa tu correo para restablecer la contraseña.");
    } catch (error) {
      toast.error(translateAuthError(error).message);
    } finally {
      setResetting(false);
    }
  };

  const busy = loading || resending || resetting;
  const signingUp = mode === "signup";

  return (
    <div className="brand-light min-h-screen bg-surface text-content">
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link to="/" aria-label="Geocapitals, inicio" className="inline-flex">
            <Logo size={30} />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-content-subtle hover:text-accent-brand"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-8 sm:py-12 lg:grid-cols-2 lg:gap-16 lg:py-16">
        <div className="relative hidden h-full min-h-[32rem] overflow-hidden rounded-2xl bg-content lg:block">
          <img src={heroMining} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-6">
            <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
              {signingUp ? "Crea tu cuenta" : "Inicia sesión"}
            </h1>
            <p className="mt-3 text-sm text-content-subtle">
              {search.intent === "investor" && search.next?.startsWith("/terminal/")
                ? "Accede para retomar tu simulación de inversión."
                : signingUp
                  ? "Regístrate con tu correo electrónico."
                  : "Ingresa con el correo de tu cuenta Geocapitals."}
            </p>
          </div>

          <div className="rounded-2xl border border-hairline bg-white p-5 sm:p-7">
            {needsConfirm && (
              <div className="mb-5 rounded-lg bg-accent-brand-subtle p-4 text-sm" role="status">
                <p>Confirma tu cuenta desde el enlace que enviamos a tu correo.</p>
                <button
                  type="button"
                  onClick={handleResendConfirm}
                  disabled={busy}
                  className="mt-2 inline-flex items-center gap-2 font-medium text-accent-brand hover:underline disabled:opacity-60"
                >
                  <Mail className="size-4" aria-hidden="true" />
                  {resending ? "Reenviando…" : "Reenviar correo de confirmación"}
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {signingUp && (
                <Field id="auth-displayName" label="Nombre completo" error={errors.displayName}>
                  <input
                    id="auth-displayName"
                    name="name"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setErrors((previous) => ({ ...previous, displayName: undefined }));
                    }}
                    autoComplete="name"
                    required
                    maxLength={100}
                    aria-invalid={!!errors.displayName}
                    aria-describedby={errors.displayName ? "auth-displayName-error" : undefined}
                    className="brand-input"
                  />
                </Field>
              )}
              <Field id="auth-email" label="Correo electrónico" error={errors.email}>
                <input
                  ref={emailInput}
                  id="auth-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((previous) => ({ ...previous, email: undefined }));
                  }}
                  autoComplete={signingUp ? "email" : "username"}
                  required
                  maxLength={255}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "auth-email-error" : undefined}
                  className="brand-input"
                />
              </Field>
              <Field id="auth-password" label="Contraseña" error={errors.password}>
                <div className="relative">
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((previous) => ({ ...previous, password: undefined }));
                    }}
                    autoComplete={signingUp ? "new-password" : "current-password"}
                    required
                    maxLength={100}
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      [errors.password && "auth-password-error", signingUp && "auth-password-hint"]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                    className="brand-input"
                    style={{ paddingRight: "3rem" }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-content-subtle hover:text-accent-brand"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </Field>
              {signingUp ? (
                <p id="auth-password-hint" className="text-xs text-content-subtle">
                  Usa al menos 8 caracteres, una mayúscula, una minúscula y un número.
                  {password && (
                    <span className="mt-1 block">
                      Seguridad de la contraseña · {pwStrength.label}
                    </span>
                  )}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={busy}
                  className="text-sm font-medium text-accent-brand hover:underline disabled:opacity-60"
                >
                  {resetting ? "Enviando enlace…" : "¿Olvidaste tu contraseña?"}
                </button>
              )}
              {errors.form && (
                <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                  {errors.form}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {loading
                  ? signingUp
                    ? "Creando cuenta…"
                    : "Iniciando sesión…"
                  : signingUp
                    ? "Crear cuenta"
                    : "Iniciar sesión"}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-content-subtle">
            {signingUp ? "¿Ya tienes cuenta?" : "¿Todavía no tienes cuenta?"}{" "}
            <button
              type="button"
              onClick={() => changeMode(signingUp ? "login" : "signup")}
              disabled={busy}
              className="font-semibold text-accent-brand hover:underline disabled:opacity-60"
            >
              {signingUp ? "Inicia sesión" : "Crea una cuenta"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

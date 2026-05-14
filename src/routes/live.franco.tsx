import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { FrancoDashboard } from "@/features/franco/FrancoDashboard";
import { verifyFrancoLiveMapPassword } from "@/lib/live-map.functions";

const STORAGE_KEY = "live_map_franco_token";

export const Route = createFileRoute("/live/franco")({
  head: () => ({
    meta: [
      { title: "Live Map · Prospecto Franco — Geocapitals" },
      {
        name: "description",
        content:
          "Acceso restringido al live map del Prospecto Franco. Ingrese la contraseña compartida para visualizar el borrador pre NI 43-101.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LiveMapFrancoPage,
});

function LiveMapFrancoPage() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) setUnlocked(true);
  }, []);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div>
      <LiveBanner />
      <FrancoDashboard />
    </div>
  );
}

function LiveBanner() {
  return (
    <div className="bg-gold/10 border-b border-gold/30 px-6 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-gold">
        <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
        Live Map · Acceso compartido · Confidencial
      </div>
      <button
        onClick={() => {
          sessionStorage.removeItem(STORAGE_KEY);
          window.location.reload();
        }}
        className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        Cerrar sesión
      </button>
    </div>
  );
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const verify = useServerFn(verifyFrancoLiveMapPassword);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await verify({ data: { password } });
      if (res.ok && res.token) {
        sessionStorage.setItem(STORAGE_KEY, res.token);
        onUnlock();
      } else {
        setError(res.error ?? "Contraseña incorrecta.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de verificación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 font-mono text-xl font-bold text-gold tracking-tight">
            GEOCAPITALS
          </div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
            Centro de Operaciones Mineras
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center">
              <Lock className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-base text-foreground uppercase tracking-wider">
                Live Map · Franco
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Prospecto TRK-FRC-002 · Acceso restringido
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Ingrese la contraseña compartida por el operador para acceder al
            borrador pre NI 43-101 y al tablero de inteligencia geológica.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  maxLength={200}
                  className="w-full px-3 py-2.5 pr-10 bg-bg-secondary border border-border rounded font-mono text-sm text-foreground focus:outline-none focus:border-gold transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Ocultar" : "Mostrar"}
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-alert font-mono uppercase tracking-wider">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Verificando…
                </>
              ) : (
                <>Acceder al Live Map</>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider text-center">
              Sesión limitada al navegador actual
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground font-mono uppercase tracking-wider mt-6">
          © 2026 Geocapitals · Confidencial
        </p>
      </div>
    </div>
  );
}

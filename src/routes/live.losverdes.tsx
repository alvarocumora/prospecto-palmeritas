import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Eye, EyeOff, Loader2, MapPin } from "lucide-react";

import { verifyLosVerdesLiveMapPassword } from "@/lib/live-map.functions";
import { FieldMapPublic } from "@/components/field/FieldMapPublic";

const STORAGE_KEY = "live_map_losverdes_token";

export const Route = createFileRoute("/live/losverdes")({
  head: () => ({
    meta: [
      { title: "Live Field · Distrito Los Verdes — Geocapitals" },
      {
        name: "description",
        content:
          "Live field map del Distrito Cuprífero Los Verdes – Tilama. GPS en tiempo real, revisión de targets y captura de notas de campo.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#0b0a09" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
    links: [{ rel: "manifest", href: "/manifest.losverdes.json" }],
  }),
  component: LiveLosVerdesPage,
});

function LiveLosVerdesPage() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) setUnlocked(true);
  }, []);

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="bg-bg-app min-h-screen">
      <div className="bg-gold/10 border-b border-gold/30 px-4 py-2 flex items-center justify-between gap-4 h-10">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-gold">
          <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          <MapPin className="w-3 h-3" />
          Live Field · Los Verdes · Tilama
        </div>
        <button
          onClick={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            window.location.reload();
          }}
          className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Salir
        </button>
      </div>
      <FieldMapPublic />
    </div>
  );
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const verify = useServerFn(verifyLosVerdesLiveMapPassword);
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
        setError(res.error ?? "Acceso denegado");
      }
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-app flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 p-6 rounded-lg border border-border bg-bg-panel"
      >
        <div className="flex items-center gap-2 text-gold font-mono text-sm">
          <Lock className="w-4 h-4" />
          Acceso restringido
        </div>
        <h1 className="text-lg font-bold text-foreground font-mono">
          Live Field · Los Verdes
        </h1>
        <p className="text-xs text-muted-foreground font-mono leading-relaxed">
          Esta es la PWA de terreno para el Distrito Cuprífero Los Verdes – Tilama.
          Ingrese la contraseña compartida para acceder al mapa, targets y notas de campo.
        </p>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoFocus
            className="w-full min-h-[44px] px-3 pr-10 rounded-md border border-border bg-bg-app text-foreground font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-label="Mostrar contraseña"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {error && <div className="text-xs text-destructive font-mono">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] rounded-md bg-gold text-bg-app font-mono text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Entrar
        </button>
        <p className="text-[10px] text-muted-foreground font-mono">
          Tip: en móvil podrás instalar esta vista como app desde el botón "Instalar app".
        </p>
      </form>
    </div>
  );
}

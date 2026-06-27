// First-login onboarding wizard. Renders inline above the dashboard when the
// authenticated user has not chosen an account_type yet. Persists the choice
// to `profiles.account_type` and marks `onboarding_status` as in_progress.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Briefcase,
  Mountain,
  Gem,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  X,
} from "lucide-react";

type AccountType = "investor" | "mining_owner" | "geocapitals_team";

const OPTIONS: Array<{
  value: AccountType;
  icon: typeof Briefcase;
  title: string;
  desc: string;
  next: { to: string; label: string };
}> = [
  {
    value: "investor",
    icon: Briefcase,
    title: "Inversionista / Fondo",
    desc: "Acceso a deal flow, data rooms, reportes NI 43-101 firmados y watchlist catastral.",
    next: { to: "/dashboard/marketplace", label: "Ver deal flow" },
  },
  {
    value: "mining_owner",
    icon: Mountain,
    title: "Titular / Holder",
    desc: "Monitoreo de concesiones, patentes, alertas catastrales y boletín minero.",
    next: { to: "/dashboard/catastro", label: "Importar mis concesiones" },
  },
  {
    value: "geocapitals_team",
    icon: Gem,
    title: "Equipo técnico / Geólogo",
    desc: "Workspace de proyecto: drilling, QA/QC, satelital, geología 3D, NI 43-101.",
    next: { to: "/dashboard/projects", label: "Crear o unirme a un proyecto" },
  },
];

export function OnboardingWizard({ onComplete }: { onComplete?: () => void }) {
  const { user, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<AccountType | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleSelect = async (value: AccountType) => {
    if (!user) return;
    setSelected(value);
    setSaving(true);
    const now = new Date().toISOString();
    await supabase
      .from("profiles")
      .update({
        account_type: value,
        account_type_selected_at: now,
      })
      .eq("user_id", user.id);
    await supabase
      .from("onboarding_status")
      .upsert(
        {
          user_id: user.id,
          state: "in_progress",
          current_step: "profile_selected",
          metadata: { account_type: value },
        },
        { onConflict: "user_id" },
      );
    await refreshProfile();
    setSaving(false);
    setDone(true);
    onComplete?.();
  };

  const handleSkip = async () => {
    if (!user) return setDismissed(true);
    await supabase
      .from("onboarding_status")
      .upsert(
        { user_id: user.id, state: "in_progress", current_step: "skipped" },
        { onConflict: "user_id" },
      );
    setDismissed(true);
  };

  if (dismissed) return null;

  if (done && selected) {
    const opt = OPTIONS.find((o) => o.value === selected)!;
    return (
      <section className="rounded border border-teal/40 bg-teal/5 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal mt-0.5" />
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono text-teal">
                Bienvenido a Geocapitals
              </div>
              <h3 className="font-semibold text-foreground mt-0.5">
                Perfil configurado: {opt.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Sigamos con el primer paso de tu flujo.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3">
          <Link
            to={opt.next.to}
            className="inline-flex items-center gap-2 rounded bg-gold text-black px-3 py-1.5 text-xs font-mono font-semibold hover:bg-gold/90"
          >
            {opt.next.label} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded border border-gold/40 bg-gradient-to-br from-gold/10 to-bg-panel p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-gold flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Configura tu cuenta
          </div>
          <h2 className="text-lg md:text-xl font-bold mt-1">¿Cuál es tu rol en Geocapitals?</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Personalizamos la plataforma según tu perfil. Puedes cambiarlo después en tu perfil.
          </p>
        </div>
        <button
          onClick={handleSkip}
          className="text-[11px] font-mono text-muted-foreground hover:text-foreground underline"
        >
          Saltar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSel = selected === opt.value;
          return (
            <button
              key={opt.value}
              disabled={saving}
              onClick={() => handleSelect(opt.value)}
              className={`text-left rounded border p-3 transition-all ${
                isSel
                  ? "border-gold bg-gold/10"
                  : "border-border bg-bg-panel hover:border-gold/60 hover:bg-gold/5"
              } disabled:opacity-60`}
            >
              <Icon className="w-5 h-5 text-gold mb-2" />
              <div className="font-semibold text-sm text-foreground">{opt.title}</div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                {opt.desc}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

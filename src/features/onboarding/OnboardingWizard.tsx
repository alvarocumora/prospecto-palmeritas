// First-login onboarding wizard. Step 1 selects account_type; Step 2 captures
// role-specific data and marks onboarding_status as completed.
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
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { notifyInvestorSubmitted } from "@/lib/investors.functions";
import { sha256Hex } from "@/lib/documents/signing";

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
    next: { to: "/dashboard/deals", label: "Ver deal flow" },
  },
  {
    value: "mining_owner",
    icon: Mountain,
    title: "Titular / Holder",
    desc: "Monitoreo de concesiones, patentes, alertas catastrales y boletín minero.",
    next: { to: "/catastro/mapa", label: "Importar mis concesiones" },
  },
  {
    value: "geocapitals_team",
    icon: Gem,
    title: "Equipo técnico / Geólogo",
    desc: "Workspace de proyecto: drilling, QA/QC, satelital, geología 3D, NI 43-101.",
    next: { to: "/dashboard/projects", label: "Crear o unirme a un proyecto" },
  },
];

const COMMODITIES = ["Au", "Au-Cu", "Cu", "Cu-Mo", "Ag", "Pb-Zn", "Li", "Fe", "Otro"];
const STANDARDS = ["NI 43-101", "JORC", "SAMREC", "CRIRSCO"];
const INVESTOR_TYPES: Array<[string, string]> = [
  ["individual", "Persona natural"],
  ["family_office", "Family office"],
  ["fund", "Fondo"],
  ["strategic", "Inversionista estratégico"],
  ["other", "Otro"],
];
const NDA_VERSION = "NCNDA-GC-2026.1";
const NDA_TEXT =
  "Me obligo a mantener confidencial toda la información técnica, legal y comercial recibida a través de Geocapitals, a no usarla con fines distintos a evaluar la inversión y a no contactar ni eludir a titulares, socios o contrapartes presentados por Geocapitals (no elusión) por 24 meses.";
const RISK_TEXT =
  "Entiendo que la inversión en proyectos mineros en explotación es de alto riesgo, que los antecedentes técnicos pueden ser declarados, derivados o interpretados, que no constituyen recursos ni reservas certificados bajo NI 43-101/JORC salvo indicación expresa, y que puedo perder la totalidad de lo invertido.";
const SPECIALTIES = [
  "Geología",
  "Geofísica",
  "Geoquímica",
  "Recursos",
  "Ingeniería de minas",
  "Otro",
];

type Step = "role" | "details" | "done";

export function OnboardingWizard({ onComplete }: { onComplete?: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>("role");
  const [selected, setSelected] = useState<AccountType | null>(null);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Investor form
  const [inv, setInv] = useState({
    full_name: profile?.display_name ?? "",
    company_name: "",
    country: "Chile",
    investor_type: "fund",
    ticket_min_usd: "",
    ticket_max_usd: "",
    commodities: ["Au"] as string[],
    accepted_standards: ["NI 43-101"] as string[],
    website: "",
    tax_id: "",
    is_accredited: false,
    accreditation_basis: "",
    risk_accepted: false,
    nda_signature: "",
    terms_accepted: false,
  });

  // Owner form
  const [own, setOwn] = useState({
    organization: "",
    country: "Chile",
    region: "",
    rut: "",
  });

  // Team form
  const [team, setTeam] = useState({
    specialty: "Geología",
    certifications: "",
    country: "Chile",
  });

  const toggleArr = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const pickRole = async (value: AccountType) => {
    if (!user) return;
    setSelected(value);
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ account_type: value, account_type_selected_at: now })
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    await supabase.from("onboarding_status").upsert(
      {
        user_id: user.id,
        state: "in_progress",
        current_step: "role_selected",
        metadata: { account_type: value },
      },
      { onConflict: "user_id" },
    );
    await refreshProfile();
    setSaving(false);
    setStep("details");
  };

  const finish = async (metadata: Record<string, unknown>) => {
    if (!user || !selected) return;
    const now = new Date().toISOString();
    await supabase.from("onboarding_status").upsert(
      {
        user_id: user.id,
        state: "completed",
        current_step: "completed",
        completed_at: now,
        metadata: { account_type: selected, ...metadata },
      },
      { onConflict: "user_id" },
    );
    setStep("done");
    onComplete?.();
  };

  const submitDetails = async () => {
    if (!user || !selected) return;
    setSaving(true);
    try {
      if (selected === "investor") {
        if (
          !inv.full_name.trim() ||
          (inv.investor_type !== "individual" && !inv.company_name.trim())
        ) {
          toast.error("Nombre y empresa son obligatorios.");
          setSaving(false);
          return;
        }
        if (!inv.terms_accepted) {
          toast.error("Debes aceptar los términos y la política de privacidad.");
          setSaving(false);
          return;
        }
        if (!inv.tax_id.trim()) {
          toast.error("Indica tu RUT o identificación tributaria.");
          setSaving(false);
          return;
        }
        if (!inv.risk_accepted) {
          toast.error("Debes aceptar la declaración de riesgos.");
          setSaving(false);
          return;
        }
        const sig = inv.nda_signature.trim();
        if (sig.toLowerCase() !== inv.full_name.trim().toLowerCase()) {
          toast.error("Para firmar el NCNDA escribe tu nombre completo exactamente igual.");
          setSaving(false);
          return;
        }
        const signedAt = new Date().toISOString();
        const ndaHash = await sha256Hex(
          `${NDA_VERSION}|${NDA_TEXT}|${sig}|${inv.tax_id.trim()}|${user.id}|${signedAt}`,
        );
        const { error } = await supabase.from("investor_profiles").upsert(
          {
            user_id: user.id,
            full_name: inv.full_name.trim(),
            company_name: inv.company_name.trim(),
            country: inv.country,
            investor_type: inv.investor_type,
            ticket_min_usd: inv.ticket_min_usd ? Number(inv.ticket_min_usd) : null,
            ticket_max_usd: inv.ticket_max_usd ? Number(inv.ticket_max_usd) : null,
            commodities: inv.commodities,
            accepted_standards: inv.accepted_standards,
            website: inv.website || null,
            tax_id: inv.tax_id.trim(),
            is_accredited: inv.is_accredited,
            accreditation_basis: inv.is_accredited ? inv.accreditation_basis.trim() || null : null,
            risk_disclosure_accepted_at: signedAt,
            nda_signed_at: signedAt,
            nda_signature_name: sig,
            nda_hash: ndaHash,
            nda_version: NDA_VERSION,
            review_status: "pending_review",
            terms_accepted_at: signedAt,
          },
          { onConflict: "user_id" },
        );
        if (error) throw error;
        await supabase
          .from("profiles")
          .update({
            display_name: inv.full_name.trim(),
            organization: inv.company_name.trim(),
            country: inv.country,
          })
          .eq("user_id", user.id);
        // Dispara welcome + lead interno (no bloqueante)
        try {
          await notifyInvestorSubmitted();
        } catch (e) {
          console.warn("notifyInvestorSubmitted failed", e);
        }
        await finish({ investor_profile_submitted: true });
      } else if (selected === "mining_owner") {
        if (!own.organization.trim()) {
          toast.error("Indica tu empresa u organización.");
          setSaving(false);
          return;
        }
        await supabase
          .from("profiles")
          .update({ organization: own.organization.trim(), country: own.country })
          .eq("user_id", user.id);
        await finish({ holder: { region: own.region, rut: own.rut } });
      } else {
        await supabase
          .from("profiles")
          .update({
            specialty: team.specialty,
            certifications: team.certifications
              ? team.certifications
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : null,
            country: team.country,
          })
          .eq("user_id", user.id);
        await finish({ team: { specialty: team.specialty } });
      }
      await refreshProfile();
      toast.success("Onboarding completado.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al guardar.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
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

  if (step === "done" && selected) {
    const opt = OPTIONS.find((o) => o.value === selected)!;
    return (
      <section className="rounded border border-teal/40 bg-teal/5 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal mt-0.5" />
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono text-teal">
                Onboarding completado
              </div>
              <h3 className="font-semibold text-foreground mt-0.5">{opt.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">Sigamos con tu primer paso.</p>
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

  if (step === "details" && selected) {
    return (
      <section className="rounded border border-gold/40 bg-gradient-to-br from-gold/10 to-bg-panel p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <button
              onClick={() => setStep("role")}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-3 h-3" /> Cambiar rol
            </button>
            <h2 className="text-lg md:text-xl font-bold mt-1">
              {selected === "investor" && "Perfil del inversionista"}
              {selected === "mining_owner" && "Datos del titular"}
              {selected === "geocapitals_team" && "Perfil técnico"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Personaliza tu acceso y desbloquea los módulos relevantes.
            </p>
          </div>
          <button
            onClick={handleSkip}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground underline"
          >
            Saltar
          </button>
        </div>

        {selected === "investor" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nombre completo *">
              <Input value={inv.full_name} onChange={(v) => setInv({ ...inv, full_name: v })} />
            </Field>
            <Field label="Empresa / Fondo *">
              <Input
                value={inv.company_name}
                onChange={(v) => setInv({ ...inv, company_name: v })}
              />
            </Field>
            <Field label="País">
              <Input value={inv.country} onChange={(v) => setInv({ ...inv, country: v })} />
            </Field>
            <Field label="Tipo de inversor">
              <select
                value={inv.investor_type}
                onChange={(e) => setInv({ ...inv, investor_type: e.target.value })}
                className={selectCls}
              >
                {INVESTOR_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ticket mín USD">
              <Input
                type="number"
                value={inv.ticket_min_usd}
                onChange={(v) => setInv({ ...inv, ticket_min_usd: v })}
              />
            </Field>
            <Field label="Ticket máx USD">
              <Input
                type="number"
                value={inv.ticket_max_usd}
                onChange={(v) => setInv({ ...inv, ticket_max_usd: v })}
              />
            </Field>
            <Field label="Commodities" full>
              <Chips
                options={COMMODITIES}
                selected={inv.commodities}
                onToggle={(v) => setInv({ ...inv, commodities: toggleArr(inv.commodities, v) })}
              />
            </Field>
            <Field label="Estándares aceptados" full>
              <Chips
                options={STANDARDS}
                selected={inv.accepted_standards}
                onToggle={(v) =>
                  setInv({ ...inv, accepted_standards: toggleArr(inv.accepted_standards, v) })
                }
              />
            </Field>
            <Field label="Sitio web" full>
              <Input
                value={inv.website}
                onChange={(v) => setInv({ ...inv, website: v })}
                placeholder="https://"
              />
            </Field>
            <Field label="RUT / Tax ID *">
              <Input
                value={inv.tax_id}
                onChange={(v) => setInv({ ...inv, tax_id: v })}
                placeholder="76.xxx.xxx-x"
              />
            </Field>
            <Field label="Inversionista calificado">
              <label className="flex items-center gap-2 text-xs text-muted-foreground h-[34px]">
                <input
                  type="checkbox"
                  checked={inv.is_accredited}
                  onChange={(e) => setInv({ ...inv, is_accredited: e.target.checked })}
                  className="accent-gold"
                />
                Declaro ser inversionista calificado / acreditado
              </label>
            </Field>
            {inv.is_accredited && (
              <Field label="Fundamento de la calificación" full>
                <Input
                  value={inv.accreditation_basis}
                  onChange={(v) => setInv({ ...inv, accreditation_basis: v })}
                  placeholder="Ej.: NCG 216 CMF, patrimonio, inversionista institucional…"
                />
              </Field>
            )}
            <div className="md:col-span-2 rounded border border-border p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                Declaración de riesgos
              </div>
              <p className="text-xs text-muted-foreground">{RISK_TEXT}</p>
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={inv.risk_accepted}
                  onChange={(e) => setInv({ ...inv, risk_accepted: e.target.checked })}
                  className="mt-0.5 accent-gold"
                />
                He leído y acepto la declaración de riesgos.
              </label>
            </div>
            <div className="md:col-span-2 rounded border border-border p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                Acuerdo de confidencialidad y no elusión ({NDA_VERSION})
              </div>
              <p className="text-xs text-muted-foreground">{NDA_TEXT}</p>
              <Field label="Firma: escribe tu nombre completo *" full>
                <Input
                  value={inv.nda_signature}
                  onChange={(v) => setInv({ ...inv, nda_signature: v })}
                  placeholder={inv.full_name || "Nombre completo"}
                />
              </Field>
              <p className="text-[10px] font-mono text-muted-foreground">
                Se registra fecha y hora UTC y una huella SHA-256 de la firma.
              </p>
            </div>
            <label className="md:col-span-2 flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={inv.terms_accepted}
                onChange={(e) => setInv({ ...inv, terms_accepted: e.target.checked })}
                className="mt-0.5 accent-gold"
              />
              <span>
                Acepto los{" "}
                <a href="/legal/terminos" target="_blank" className="text-gold hover:underline">
                  Términos
                </a>
                , la{" "}
                <a href="/legal/privacidad" target="_blank" className="text-gold hover:underline">
                  Política de privacidad
                </a>{" "}
                y el procedimiento <strong>KYC/AML</strong>. Geocapitals cobra una comisión de éxito
                post-cierre y no custodia fondos.
              </span>
            </label>
          </div>
        )}

        {selected === "mining_owner" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Empresa / Organización *" full>
              <Input
                value={own.organization}
                onChange={(v) => setOwn({ ...own, organization: v })}
              />
            </Field>
            <Field label="País">
              <Input value={own.country} onChange={(v) => setOwn({ ...own, country: v })} />
            </Field>
            <Field label="Región">
              <Input
                value={own.region}
                onChange={(v) => setOwn({ ...own, region: v })}
                placeholder="Atacama"
              />
            </Field>
            <Field label="RUT (opcional)" full>
              <Input
                value={own.rut}
                onChange={(v) => setOwn({ ...own, rut: v })}
                placeholder="76.xxx.xxx-x"
              />
            </Field>
          </div>
        )}

        {selected === "geocapitals_team" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Especialidad">
              <select
                value={team.specialty}
                onChange={(e) => setTeam({ ...team, specialty: e.target.value })}
                className={selectCls}
              >
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="País">
              <Input value={team.country} onChange={(v) => setTeam({ ...team, country: v })} />
            </Field>
            <Field label="Certificaciones (separadas por coma)" full>
              <Input
                value={team.certifications}
                onChange={(v) => setTeam({ ...team, certifications: v })}
                placeholder="QP, AusIMM, CIM..."
              />
            </Field>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={submitDetails}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded bg-gold text-black px-4 py-2 text-xs font-mono font-semibold hover:bg-gold/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Completar onboarding
          </button>
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
            Personalizamos la plataforma según tu perfil. Puedes cambiarlo después.
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
              onClick={() => pickRole(opt.value)}
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

const inputCls =
  "w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-gold";
const selectCls = inputCls;

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputCls}
    />
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`px-2 py-1 rounded border text-[11px] font-mono transition-colors ${
              on ? "border-gold bg-gold/10 text-gold" : "border-border hover:border-gold/40"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

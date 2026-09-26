// Wizard público de onboarding para socios (broker/cliente) invitados por
// Geocapitals. 3 pasos: identidad → rol → firma NCNDA. Al aceptar crea el
// usuario, otorga acceso a los proyectos/trades indicados y devuelve al login.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  Building2,
  Handshake,
  TrendingUp,
  FileSignature,
  ExternalLink,
} from "lucide-react";
import {
  getInvitationByToken,
  acceptPartnerInvitation,
  type PartnerInvitationRole,
} from "@/lib/partnerInvitations.functions";

export const Route = createFileRoute("/onboarding/$token")({
  head: () => ({
    meta: [
      { title: "Activar acceso — Geocapitals" },
      {
        name: "description",
        content:
          "Wizard institucional de onboarding: firma NCNDA y activa acceso a data rooms de proyectos mineros y operaciones de commodities.",
      },
    ],
  }),
  component: OnboardingPage,
});

type LoadResult = Awaited<ReturnType<typeof getInvitationByToken>>;

function OnboardingPage() {
  const { token } = Route.useParams();
  const getFn = useServerFn(getInvitationByToken);
  const acceptFn = useServerFn(acceptPartnerInvitation);
  const [data, setData] = useState<LoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [chosenRole, setChosenRole] = useState<PartnerInvitationRole>("both");
  const [signature, setSignature] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getFn({ data: { token } });
        setData(res);
        setFullName(res.invitation.full_name ?? "");
        setCompany(res.invitation.company ?? "");
        if (res.invitation.suggested_role) setChosenRole(res.invitation.suggested_role);
        if (res.invitation.status === "accepted") {
          setDone(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar la invitación");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async () => {
    if (!signature.trim() || signature.trim().length < 3) {
      toast.error("Firma tu nombre completo para aceptar el NCNDA");
      return;
    }
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      await acceptFn({
        data: {
          token,
          chosenRole,
          fullName: fullName.trim(),
          company: company.trim() || undefined,
          signatureName: signature.trim(),
          password,
        },
      });
      setDone(true);
      toast.success("Acceso activado. Ya puedes ingresar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo activar el acceso");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        data-theme="im-light"
        className="min-h-screen flex items-center justify-center bg-surface-page"
      >
        <Loader2 className="w-6 h-6 animate-spin text-accent-brand" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div
        data-theme="im-light"
        className="min-h-screen flex items-center justify-center bg-surface-page p-6"
      >
        <div className="max-w-md text-center space-y-3">
          <div className="text-2xl font-serif text-content-primary">Invitación no válida</div>
          <p className="text-sm text-content-secondary">
            {error ?? "El link no existe, expiró o fue anulado. Contacta a team@geocapitals.com."}
          </p>
        </div>
      </div>
    );
  }

  const inv = data.invitation;

  if (done) {
    return (
      <div
        data-theme="im-light"
        className="min-h-screen flex items-center justify-center bg-surface-page p-6"
      >
        <div className="max-w-lg w-full bg-surface-card border border-hairline p-8 space-y-5 text-center">
          <div className="w-14 h-14 rounded-full bg-accent-brand/10 flex items-center justify-center mx-auto">
            <Check className="w-7 h-7 text-accent-brand" />
          </div>
          <h1 className="text-2xl font-serif text-content-primary">Acceso activado</h1>
          <p className="text-sm text-content-secondary">
            NCNDA firmado y acceso otorgado a {inv.project_ids.length} proyecto(s) y{" "}
            {inv.trade_ids.length} operación(es).
          </p>
          <a
            href="/auth"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-accent-brand text-white text-sm font-medium hover:opacity-90"
          >
            Ingresar a la plataforma <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="im-light" className="min-h-screen bg-surface-page py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-content-secondary">
            Geocapitals · Onboarding institucional
          </div>
          <h1 className="text-3xl font-serif text-content-primary">
            Activa tu acceso, {inv.full_name ?? inv.email}
          </h1>
          <p className="text-sm text-content-secondary max-w-lg mx-auto">
            3 pasos: confirma identidad, elige tu rol y firma el NCNDA. Luego tendrás acceso a los
            data rooms de proyectos y operaciones activas.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 w-16 rounded-full ${step >= i ? "bg-accent-brand" : "bg-hairline"}`}
            />
          ))}
        </div>

        <div className="bg-surface-card border border-hairline p-6 md:p-8">
          {step === 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-content-primary">
                <Building2 className="w-5 h-5 text-accent-brand" />
                <h2 className="text-lg font-semibold">Confirma tu identidad</h2>
              </div>
              <div className="grid gap-4">
                <Field label="Nombre completo" value={fullName} onChange={setFullName} />
                <Field label="Empresa (opcional)" value={company} onChange={setCompany} />
                <Field
                  label="Correo (invitación)"
                  value={inv.email}
                  onChange={() => null}
                  disabled
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setStep(1)}
                  disabled={fullName.trim().length < 2}
                  className="px-5 py-2 bg-accent-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-content-primary">
                <Handshake className="w-5 h-5 text-accent-brand" />
                <h2 className="text-lg font-semibold">¿Cómo trabajarás con nosotros?</h2>
              </div>
              <div className="grid gap-3">
                <RoleOption
                  value="broker"
                  chosen={chosenRole}
                  onChoose={setChosenRole}
                  title="Broker / Intermediario"
                  desc="Acceso a data rooms + comisión trazable en deals que cierres."
                  icon={<Handshake className="w-4 h-4" />}
                />
                <RoleOption
                  value="investor"
                  chosen={chosenRole}
                  onChoose={setChosenRole}
                  title="Cliente / Inversionista"
                  desc="Acceso a data rooms con NDA firmada + portafolio y alertas."
                  icon={<TrendingUp className="w-4 h-4" />}
                />
                <RoleOption
                  value="both"
                  chosen={chosenRole}
                  onChoose={setChosenRole}
                  title="Ambos"
                  desc="Puedo actuar como broker y como cliente/inversionista."
                  icon={<Building2 className="w-4 h-4" />}
                />
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setStep(0)}
                  className="px-4 py-2 border border-hairline text-content-secondary text-sm hover:bg-surface-page"
                >
                  Volver
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-2 bg-accent-brand text-white text-sm font-medium hover:opacity-90"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-content-primary">
                <FileSignature className="w-5 h-5 text-accent-brand" />
                <h2 className="text-lg font-semibold">Firma el NCNDA y crea tu contraseña</h2>
              </div>

              {inv.ncnda_pdf_url ? (
                <a
                  href={inv.ncnda_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-accent-brand hover:underline"
                >
                  Descargar NCNDA · {inv.ncnda_ref} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}

              <div className="border border-hairline bg-surface-page p-4 text-xs text-content-secondary space-y-2 max-h-40 overflow-y-auto">
                <p>
                  <b>NCNDA (Non-Circumvention, Non-Disclosure)</b> — Al firmar aceptas que la
                  información compartida sobre proyectos, contrapartes, precios y estructuras de
                  deal es confidencial por 24 meses; no circunvalarás a Geocapitals ni contactarás
                  directamente a las contrapartes presentadas.
                </p>
                <p>
                  Acceso otorgado a:{" "}
                  <b>{data.projects.map((p) => p.name).join(", ") || "sin proyectos"}</b>
                  {data.trades.length
                    ? ` · Operaciones: ${data.trades.map((t) => `${t.commodity} (${t.reference})`).join(", ")}`
                    : ""}
                </p>
              </div>

              <Field
                label="Firma electrónica (tu nombre completo)"
                value={signature}
                onChange={setSignature}
                placeholder="Ej: Joaquín Belmar"
              />
              <Field
                label="Crea una contraseña (mín. 8 caracteres)"
                value={password}
                onChange={setPassword}
                type="password"
                placeholder="••••••••"
              />

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-hairline text-content-secondary text-sm hover:bg-surface-page"
                >
                  Volver
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-5 py-2 bg-accent-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Firmar y activar acceso
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-content-secondary">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full border border-hairline bg-surface-card px-3 py-2 text-sm text-content-primary disabled:opacity-60"
      />
    </label>
  );
}

function RoleOption({
  value,
  chosen,
  onChoose,
  title,
  desc,
  icon,
}: {
  value: PartnerInvitationRole;
  chosen: PartnerInvitationRole;
  onChoose: (v: PartnerInvitationRole) => void;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  const active = chosen === value;
  return (
    <button
      type="button"
      onClick={() => onChoose(value)}
      className={`text-left p-4 border transition-colors ${
        active
          ? "border-accent-brand bg-accent-brand/5"
          : "border-hairline bg-surface-card hover:border-content-secondary"
      }`}
    >
      <div className="flex items-center gap-2 text-content-primary font-medium text-sm">
        {icon} {title}
      </div>
      <div className="text-xs text-content-secondary mt-1">{desc}</div>
    </button>
  );
}

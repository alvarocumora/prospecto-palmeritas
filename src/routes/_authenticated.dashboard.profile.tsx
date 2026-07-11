import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MessageSquare, Package, ShieldCheck, Store } from "lucide-react";
import { getMyMarketplaceProfile } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  head: () => ({ meta: [{ title: "Mi Perfil — Geocapitals" }] }),
  component: ProfilePage,
});

const SPECIALTIES = ["exploración", "geotécnico", "geofísico", "catastro", "geoquímico", "otro"];
const LANGUAGES = [
  { v: "es", l: "Español" },
  { v: "en", l: "English" },
  { v: "pt", l: "Português" },
];

function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    organization: "",
    specialty: "",
    certifications: "",
    phone: "",
    language: "es",
    country: "",
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name,organization,specialty,certifications,phone,language,country")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setForm({
          display_name: data.display_name ?? "",
          organization: data.organization ?? "",
          specialty: data.specialty ?? "",
          certifications: (data.certifications ?? []).join(", "),
          phone: data.phone ?? "",
          language: data.language ?? "es",
          country: data.country ?? "",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const certs = form.certifications
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name || null,
        organization: form.organization || null,
        specialty: form.specialty || null,
        certifications: certs,
        phone: form.phone || null,
        language: form.language,
        country: form.country || null,
      })
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Perfil actualizado");
      await refreshProfile();
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto pb-20 md:pb-8">
      <header className="mb-6">
        <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          Cuenta
        </div>
        <h1 className="text-xl md:text-2xl font-bold mt-1">Mi Perfil</h1>
        <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>
      </header>

      <MarketplaceIdentity />

      <form
        onSubmit={submit}
        className="space-y-4 rounded border border-border bg-bg-secondary p-4"
      >
        <Field label="Nombre">
          <input
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            className={inp}
          />
        </Field>
        <Field label="Organización">
          <input
            value={form.organization}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            className={inp}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Especialidad">
            <select
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              className={inp}
            >
              <option value="">— elegir —</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Idioma">
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className={inp}
            >
              {LANGUAGES.map((l) => (
                <option key={l.v} value={l.v}>
                  {l.l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Certificaciones (separadas por coma)">
          <input
            value={form.certifications}
            onChange={(e) => setForm({ ...form, certifications: e.target.value })}
            placeholder="QP NI 43-101, JORC CP"
            className={inp}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inp}
            />
          </Field>
          <Field label="País">
            <input
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className={inp}
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full px-3 py-2 rounded bg-gold text-bg-secondary text-xs font-mono font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          Guardar
        </button>
      </form>
    </div>
  );
}

/** Identidad de marketplace: qué eres como comprador y como vendedor. */
function MarketplaceIdentity() {
  const profileFn = useServerFn(getMyMarketplaceProfile);
  const { data } = useQuery({
    queryKey: ["my-marketplace-profile"],
    queryFn: () => profileFn(),
    staleTime: 60_000,
  });

  if (!data) {
    return (
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded border border-border bg-bg-secondary p-4 animate-pulse">
            <div className="h-4 rounded bg-foreground/10 w-1/2 mb-3" />
            <div className="h-3 rounded bg-foreground/10 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  const kyc = data.kycStatus;
  const kycBadge =
    kyc === "approved"
      ? { label: "KYC aprobado", cls: "border-teal/40 bg-teal/10 text-teal" }
      : kyc === "pending_review"
        ? { label: "KYC en revisión", cls: "border-warn/40 bg-warn/10 text-warn" }
        : kyc === "rejected"
          ? { label: "KYC rechazado", cls: "border-danger/40 bg-danger/10 text-danger" }
          : { label: "Sin verificar", cls: "border-border text-muted-foreground" };

  const isSeller = data.lotsTotal > 0 || data.listingsTotal > 0;

  return (
    <div className="grid sm:grid-cols-2 gap-3 mb-6">
      {/* Como comprador */}
      <div className="rounded border border-border bg-bg-secondary p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-gold" /> Como comprador
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${kycBadge.cls}`}>
            {kycBadge.label}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {data.inquiriesSent > 0 ? (
            <>
              <span className="text-foreground font-semibold">{data.inquiriesSent}</span>{" "}
              cotizaciones enviadas ·{" "}
              <span className="text-foreground font-semibold">{data.inquiriesSentOpen}</span> en
              curso
            </>
          ) : kyc === "approved" ? (
            "Listo para consultar lotes del marketplace."
          ) : (
            "Completa tu verificación para consultar lotes."
          )}
        </div>
        <div className="mt-3 flex gap-3">
          {data.inquiriesSent > 0 && (
            <Link
              to="/dashboard/my-inquiries"
              className="inline-flex items-center gap-1 text-[11px] font-mono text-gold hover:underline"
            >
              <MessageSquare className="w-3 h-3" /> Mis cotizaciones →
            </Link>
          )}
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-gold"
          >
            Ver marketplace →
          </Link>
        </div>
      </div>

      {/* Como vendedor */}
      <div className="rounded border border-border bg-bg-secondary p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-gold" /> Como vendedor
          </div>
          {data.inquiriesReceivedNew > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-warn/40 bg-warn/10 text-warn">
              {data.inquiriesReceivedNew} consultas nuevas
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {isSeller ? (
            <>
              <span className="text-foreground font-semibold">{data.lotsPublished}</span>/
              {data.lotsTotal} lotes publicados ·{" "}
              <span className="text-foreground font-semibold">{data.inquiriesReceived}</span>{" "}
              consultas recibidas
              {data.listingsTotal > 0 && (
                <>
                  {" "}
                  · <span className="text-foreground font-semibold">{data.listingsTotal}</span>{" "}
                  listings de proyecto
                </>
              )}
            </>
          ) : (
            "Publica lotes de commodities o listings de proyectos mineros."
          )}
        </div>
        <div className="mt-3 flex gap-3 flex-wrap">
          <Link
            to="/dashboard/commodity-lots"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-gold hover:underline"
          >
            <Package className="w-3 h-3" /> Mis lotes →
          </Link>
          <Link
            to="/dashboard/listings"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-gold"
          >
            Mis listings →
          </Link>
        </div>
      </div>
    </div>
  );
}

const inp =
  "w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-background focus:outline-none focus:border-gold";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  head: () => ({ meta: [{ title: "Mi Perfil — Trackmin GeoIntel" }] }),
  component: ProfilePage,
});

const SPECIALTIES = ["exploración", "geotécnico", "geofísico", "catastro", "geoquímico", "otro"];
const LANGUAGES = [{ v: "es", l: "Español" }, { v: "en", l: "English" }, { v: "pt", l: "Português" }];

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
    const certs = form.certifications.split(",").map((s) => s.trim()).filter(Boolean);
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
        <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Cuenta</div>
        <h1 className="text-xl md:text-2xl font-bold mt-1">Mi Perfil</h1>
        <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>
      </header>

      <form onSubmit={submit} className="space-y-4 rounded border border-border bg-bg-secondary p-4">
        <Field label="Nombre">
          <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className={inp} />
        </Field>
        <Field label="Organización">
          <input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className={inp} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Especialidad">
            <select value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className={inp}>
              <option value="">— elegir —</option>
              {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Idioma">
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={inp}>
              {LANGUAGES.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Certificaciones (separadas por coma)">
          <input value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} placeholder="QP NI 43-101, JORC CP" className={inp} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} />
          </Field>
          <Field label="País">
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inp} />
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

const inp = "w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-background focus:outline-none focus:border-gold";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

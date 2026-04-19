import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { Loader2, ChevronRight, ChevronLeft, Sparkles, MapPin, Mountain, Check } from "lucide-react";
import { toast } from "sonner";

const COMMODITIES = ["Au", "Au-Cu", "Cu", "Cu-Mo", "Ag", "Pb-Zn", "Li", "Fe", "Otro"];

export function OnboardingWizard() {
  const { user } = useAuth();
  const { refresh, setActiveId } = useProjects();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    commodity: "Au-Cu",
    country: "Chile",
    region: "",
    center_lat: "",
    center_lng: "",
    description: "",
  });

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const next = () => setStep((s) => Math.min(s + 1, 2));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      commodity: form.commodity || null,
      country: form.country || null,
      region: form.region || null,
      center_lat: form.center_lat ? Number(form.center_lat) : null,
      center_lng: form.center_lng ? Number(form.center_lng) : null,
      description: form.description || null,
      created_by: user.id,
    };
    const { data, error } = await supabase.from("projects").insert(payload).select().single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("¡Proyecto creado! Bienvenido.");
    await refresh();
    if (data) setActiveId(data.id);
  };

  const stepValid = [
    form.code.trim().length >= 2 && form.name.trim().length >= 2,
    form.commodity.length > 0,
    true,
  ][step];

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/10 text-gold mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold">Bienvenido a Geocapitals</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Crea tu primer proyecto en 3 pasos para comenzar.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-colors ${
              i <= step ? "bg-gold" : "bg-border"
            }`}
          />
        ))}
      </div>

      <form onSubmit={submit} className="rounded border border-border bg-bg-secondary p-5 space-y-4">
        {step === 0 && (
          <>
            <Header icon={<Mountain className="w-4 h-4" />} title="Identidad del proyecto" />
            <Field label="Código (único)" required>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => update("code", e.target.value.toUpperCase())}
                placeholder="TRK-PRJ-001"
                maxLength={50}
                className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-gold font-mono"
              />
            </Field>
            <Field label="Nombre" required>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Prospecto Las Palmeras"
                maxLength={100}
                className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-gold"
              />
            </Field>
            <Field label="Descripción (opcional)">
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-gold"
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Header icon={<Sparkles className="w-4 h-4" />} title="Commodity objetivo" />
            <div className="grid grid-cols-3 gap-2">
              {COMMODITIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => update("commodity", c)}
                  className={`py-2 rounded border text-sm font-mono transition-colors ${
                    form.commodity === c
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border hover:border-gold/40"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Header icon={<MapPin className="w-4 h-4" />} title="Ubicación (opcional)" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="País">
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-gold"
                />
              </Field>
              <Field label="Región">
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => update("region", e.target.value)}
                  placeholder="Atacama"
                  className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-gold"
                />
              </Field>
              <Field label="Latitud">
                <input
                  type="number"
                  step="any"
                  value={form.center_lat}
                  onChange={(e) => update("center_lat", e.target.value)}
                  placeholder="-27.5"
                  className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-gold font-mono"
                />
              </Field>
              <Field label="Longitud">
                <input
                  type="number"
                  step="any"
                  value={form.center_lng}
                  onChange={(e) => update("center_lng", e.target.value)}
                  placeholder="-70.3"
                  className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:border-gold font-mono"
                />
              </Field>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Podrás dibujar el AOI después en el módulo de Catastro.
            </p>
          </>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Atrás
          </button>

          {step < 2 ? (
            <button
              type="button"
              onClick={next}
              disabled={!stepValid}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-gold text-background font-mono text-xs font-semibold disabled:opacity-50"
            >
              Siguiente <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={saving || !stepValid}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-gold text-background font-mono text-xs font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Crear proyecto
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Header({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">
        {label} {required && <span className="text-gold">*</span>}
      </div>
      {children}
    </label>
  );
}

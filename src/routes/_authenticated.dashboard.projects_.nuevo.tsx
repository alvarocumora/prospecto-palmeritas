import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";

export const Route = createFileRoute("/_authenticated/dashboard/projects_/nuevo")({
  head: () => ({
    meta: [
      { title: "Alta de proyecto real — Geocapitals" },
      {
        name: "description",
        content:
          "Formulario de alta de un proyecto minero real: identidad, catastro de pertenencias, muestreo certificado, informe geológico y ronda de inversión.",
      },
      { property: "og:title", content: "Alta de proyecto real — Geocapitals" },
      {
        property: "og:description",
        content:
          "Carga los antecedentes verificables de un activo minero para publicarlo ante inversionistas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NuevoProyectoPage,
});

type ConcesionRow = {
  code: string;
  name: string;
  concession_type: string;
  status: string;
  holder: string;
  area_ha: string;
  region: string;
  commune: string;
  source: string;
};

type MuestraRow = {
  sample_code: string;
  sample_type: string;
  zone: string;
  easting: string;
  northing: string;
  cu_pct: string;
  au_gpt: string;
  ag_gpt: string;
  lab: string;
  certificate: string;
  sampled_at: string;
};

const emptyConcesion: ConcesionRow = {
  code: "",
  name: "",
  concession_type: "pertenencia",
  status: "vigente",
  holder: "",
  area_ha: "",
  region: "",
  commune: "",
  source: "Declarado por el titular",
};

const emptyMuestra: MuestraRow = {
  sample_code: "",
  sample_type: "roca",
  zone: "",
  easting: "",
  northing: "",
  cu_pct: "",
  au_gpt: "",
  ag_gpt: "",
  lab: "",
  certificate: "",
  sampled_at: "",
};

const STEPS = [
  "Identidad",
  "Catastro / pertenencias",
  "Muestreo y laboratorio",
  "Informe geológico",
  "Económicos / ronda",
] as const;

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function NuevoProyectoPage() {
  const { user } = useAuth();
  const { refresh, setActiveId } = useProjects();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [identidad, setIdentidad] = useState({
    code: "",
    name: "",
    commodity: "Cu-Au-Ag",
    country: "Chile",
    region: "",
    description: "",
    center_lat: "",
    center_lng: "",
    status: "exploracion",
  });

  const [concesiones, setConcesiones] = useState<ConcesionRow[]>([{ ...emptyConcesion }]);
  const [muestras, setMuestras] = useState<MuestraRow[]>([{ ...emptyMuestra }]);

  const [brief, setBrief] = useState({
    executive_summary: "",
    petrology_interpretation: "",
    mining_model: "",
    conclusion: "",
    team: "",
    source_documents: "",
    risks: "",
  });

  const [ronda, setRonda] = useState({
    round_size_usd: "",
    min_ticket_usd: "",
    instrument: "Equity SPV",
    equity_offered_pct: "",
    valuation_low_usd: "",
    valuation_high_usd: "",
    valuation_method: "",
    use_of_funds: "",
    milestones: "",
    notes: "",
  });

  const lines = (v: string) =>
    v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  const submit = async () => {
    if (!user) return;
    if (!identidad.code.trim() || !identidad.name.trim()) {
      toast.error("Código y nombre del proyecto son obligatorios");
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      const { data: orgRow } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const { data: project, error: projErr } = await supabase
        .from("projects")
        .insert({
          code: identidad.code.trim().toUpperCase(),
          name: identidad.name.trim(),
          commodity: identidad.commodity || null,
          country: identidad.country || null,
          region: identidad.region || null,
          description: identidad.description || null,
          center_lat: num(identidad.center_lat),
          center_lng: num(identidad.center_lng),
          status: identidad.status,
          created_by: user.id,
          ...(orgRow?.organization_id ? { organization_id: orgRow.organization_id } : {}),
        })
        .select("id")
        .single();
      if (projErr || !project) throw new Error(projErr?.message ?? "No se pudo crear el proyecto");

      const pid = project.id;

      const conc = concesiones.filter((c) => c.code.trim() || c.name.trim());
      if (conc.length) {
        const { error } = await supabase.from("mining_concessions").insert(
          conc.map((c) => ({
            project_id: pid,
            created_by: user.id,
            code: c.code.trim(),
            name: c.name.trim() || c.code.trim(),
            concession_type: c.concession_type,
            status: c.status,
            holder: c.holder || null,
            area_ha: num(c.area_ha),
            region: c.region || identidad.region || null,
            commune: c.commune || null,
            source: c.source || null,
          })),
        );
        if (error) toast.error(`Catastro: ${error.message}`);
      }

      const samples = muestras.filter((m) => m.sample_code.trim());
      if (samples.length) {
        const { error } = await supabase.from("sampling_results").insert(
          samples.map((m) => ({
            project_id: pid,
            created_by: user.id,
            sample_code: m.sample_code.trim(),
            sample_type: m.sample_type || "grab",
            zone: m.zone || null,
            easting: num(m.easting),
            northing: num(m.northing),
            cu_pct: num(m.cu_pct),
            au_gpt: num(m.au_gpt),
            ag_gpt: num(m.ag_gpt),
            lab: m.lab || null,
            certificate: m.certificate || null,
            sampled_at: m.sampled_at || null,
          })),
        );
        if (error) toast.error(`Muestreo: ${error.message}`);
      }

      if (brief.executive_summary || brief.petrology_interpretation || brief.conclusion) {
        const { error } = await supabase.from("project_technical_brief").insert({
          project_id: pid,
          created_by: user.id,
          executive_summary: brief.executive_summary || null,
          petrology_interpretation: brief.petrology_interpretation || null,
          mining_model: brief.mining_model || null,
          conclusion: brief.conclusion || null,
          team: lines(brief.team),
          source_documents: lines(brief.source_documents),
          risks: lines(brief.risks),
        });
        if (error) toast.error(`Informe geológico: ${error.message}`);
      }

      if (ronda.round_size_usd || ronda.valuation_low_usd || ronda.instrument) {
        const { error } = await supabase.from("project_fundraises").insert({
          project_id: pid,
          created_by: user.id,
          round_size_usd: num(ronda.round_size_usd),
          min_ticket_usd: num(ronda.min_ticket_usd),
          instrument: ronda.instrument || null,
          equity_offered_pct: num(ronda.equity_offered_pct),
          valuation_low_usd: num(ronda.valuation_low_usd),
          valuation_high_usd: num(ronda.valuation_high_usd),
          valuation_method: ronda.valuation_method || null,
          use_of_funds: lines(ronda.use_of_funds),
          milestones: lines(ronda.milestones),
          notes: ronda.notes || null,
          status: "draft",
          is_public: false,
        });
        if (error) toast.error(`Ronda: ${error.message}`);
      }

      toast.success("Proyecto real creado con sus antecedentes");
      await refresh();
      setActiveId(pid);
      void navigate({ to: "/dashboard/projects/$projectId", params: { projectId: pid } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear el proyecto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-24">
      <header className="mb-6">
        <Link
          to="/dashboard/projects"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3 h-3" /> Proyectos
        </Link>
        <h1 className="text-2xl font-bold mt-2">Alta de proyecto real</h1>
        <p className="text-sm text-muted-foreground">
          Carga los antecedentes verificables del activo. Todo queda asociado al proyecto y alimenta
          ficha, valorización y documentos para inversionistas.
        </p>
      </header>

      <ol className="flex flex-wrap gap-2 mb-6">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-mono border transition-colors ${
                i === step
                  ? "bg-gold text-background border-transparent"
                  : i < step
                    ? "border-gold/40 text-gold"
                    : "border-border text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded border border-border bg-bg-secondary p-4 md:p-6 space-y-4">
        {step === 0 && (
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Código *">
              <input
                className={inputCls}
                value={identidad.code}
                onChange={(e) => setIdentidad({ ...identidad, code: e.target.value })}
                placeholder="CHOLQUI"
              />
            </Field>
            <Field label="Nombre *">
              <input
                className={inputCls}
                value={identidad.name}
                onChange={(e) => setIdentidad({ ...identidad, name: e.target.value })}
                placeholder="Proyecto Cholqui"
              />
            </Field>
            <Field label="Commodity">
              <input
                className={inputCls}
                value={identidad.commodity}
                onChange={(e) => setIdentidad({ ...identidad, commodity: e.target.value })}
              />
            </Field>
            <Field label="Estado">
              <select
                className={inputCls}
                value={identidad.status}
                onChange={(e) => setIdentidad({ ...identidad, status: e.target.value })}
              >
                <option value="exploracion">Exploración</option>
                <option value="evaluacion">Evaluación</option>
                <option value="desarrollo">Desarrollo</option>
                <option value="produccion">Producción</option>
              </select>
            </Field>
            <Field label="País">
              <input
                className={inputCls}
                value={identidad.country}
                onChange={(e) => setIdentidad({ ...identidad, country: e.target.value })}
              />
            </Field>
            <Field label="Región">
              <input
                className={inputCls}
                value={identidad.region}
                onChange={(e) => setIdentidad({ ...identidad, region: e.target.value })}
                placeholder="Región Metropolitana"
              />
            </Field>
            <Field label="Latitud (WGS84)">
              <input
                className={inputCls}
                value={identidad.center_lat}
                onChange={(e) => setIdentidad({ ...identidad, center_lat: e.target.value })}
                placeholder="-33.85"
              />
            </Field>
            <Field label="Longitud (WGS84)">
              <input
                className={inputCls}
                value={identidad.center_lng}
                onChange={(e) => setIdentidad({ ...identidad, center_lng: e.target.value })}
                placeholder="-71.25"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Descripción">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={identidad.description}
                  onChange={(e) => setIdentidad({ ...identidad, description: e.target.value })}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <RowEditor
            rows={concesiones}
            onChange={setConcesiones}
            empty={emptyConcesion}
            addLabel="Agregar pertenencia / pedimento"
            render={(row, set) => (
              <>
                <Field label="Rol / código">
                  <input
                    className={inputCls}
                    value={row.code}
                    onChange={(e) => set({ code: e.target.value })}
                  />
                </Field>
                <Field label="Nombre">
                  <input
                    className={inputCls}
                    value={row.name}
                    onChange={(e) => set({ name: e.target.value })}
                  />
                </Field>
                <Field label="Tipo">
                  <select
                    className={inputCls}
                    value={row.concession_type}
                    onChange={(e) => set({ concession_type: e.target.value })}
                  >
                    <option value="pertenencia">Pertenencia (explotación)</option>
                    <option value="pedimento">Pedimento (exploración)</option>
                    <option value="manifestacion">Manifestación</option>
                  </select>
                </Field>
                <Field label="Estado">
                  <select
                    className={inputCls}
                    value={row.status}
                    onChange={(e) => set({ status: e.target.value })}
                  >
                    <option value="vigente">Vigente</option>
                    <option value="en_tramite">En trámite</option>
                    <option value="por_verificar">Por verificar</option>
                  </select>
                </Field>
                <Field label="Titular">
                  <input
                    className={inputCls}
                    value={row.holder}
                    onChange={(e) => set({ holder: e.target.value })}
                  />
                </Field>
                <Field label="Superficie (ha)">
                  <input
                    className={inputCls}
                    value={row.area_ha}
                    onChange={(e) => set({ area_ha: e.target.value })}
                  />
                </Field>
                <Field label="Comuna">
                  <input
                    className={inputCls}
                    value={row.commune}
                    onChange={(e) => set({ commune: e.target.value })}
                  />
                </Field>
                <Field label="Procedencia del dato">
                  <input
                    className={inputCls}
                    value={row.source}
                    onChange={(e) => set({ source: e.target.value })}
                    placeholder="Sernageomin / Declarado / Por verificar"
                  />
                </Field>
              </>
            )}
          />
        )}

        {step === 2 && (
          <RowEditor
            rows={muestras}
            onChange={setMuestras}
            empty={emptyMuestra}
            addLabel="Agregar muestra"
            render={(row, set) => (
              <>
                <Field label="Código de muestra">
                  <input
                    className={inputCls}
                    value={row.sample_code}
                    onChange={(e) => set({ sample_code: e.target.value })}
                  />
                </Field>
                <Field label="Tipo">
                  <input
                    className={inputCls}
                    value={row.sample_type}
                    onChange={(e) => set({ sample_type: e.target.value })}
                    placeholder="roca / canaleta / sondaje"
                  />
                </Field>
                <Field label="Zona">
                  <input
                    className={inputCls}
                    value={row.zone}
                    onChange={(e) => set({ zone: e.target.value })}
                  />
                </Field>
                <Field label="Fecha de muestreo">
                  <input
                    type="date"
                    className={inputCls}
                    value={row.sampled_at}
                    onChange={(e) => set({ sampled_at: e.target.value })}
                  />
                </Field>
                <Field label="Este (UTM)">
                  <input
                    className={inputCls}
                    value={row.easting}
                    onChange={(e) => set({ easting: e.target.value })}
                  />
                </Field>
                <Field label="Norte (UTM)">
                  <input
                    className={inputCls}
                    value={row.northing}
                    onChange={(e) => set({ northing: e.target.value })}
                  />
                </Field>
                <Field label="Cu (%)">
                  <input
                    className={inputCls}
                    value={row.cu_pct}
                    onChange={(e) => set({ cu_pct: e.target.value })}
                  />
                </Field>
                <Field label="Au (g/t)">
                  <input
                    className={inputCls}
                    value={row.au_gpt}
                    onChange={(e) => set({ au_gpt: e.target.value })}
                  />
                </Field>
                <Field label="Ag (g/t)">
                  <input
                    className={inputCls}
                    value={row.ag_gpt}
                    onChange={(e) => set({ ag_gpt: e.target.value })}
                  />
                </Field>
                <Field label="Laboratorio">
                  <input
                    className={inputCls}
                    value={row.lab}
                    onChange={(e) => set({ lab: e.target.value })}
                  />
                </Field>
                <Field label="N° certificado">
                  <input
                    className={inputCls}
                    value={row.certificate}
                    onChange={(e) => set({ certificate: e.target.value })}
                  />
                </Field>
              </>
            )}
          />
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Field label="Resumen ejecutivo">
              <textarea
                rows={4}
                className={inputCls}
                value={brief.executive_summary}
                onChange={(e) => setBrief({ ...brief, executive_summary: e.target.value })}
              />
            </Field>
            <Field label="Interpretación geológica / petrología">
              <textarea
                rows={4}
                className={inputCls}
                value={brief.petrology_interpretation}
                onChange={(e) => setBrief({ ...brief, petrology_interpretation: e.target.value })}
              />
            </Field>
            <Field label="Modelo minero / plan de explotación">
              <textarea
                rows={3}
                className={inputCls}
                value={brief.mining_model}
                onChange={(e) => setBrief({ ...brief, mining_model: e.target.value })}
              />
            </Field>
            <Field label="Equipo técnico (uno por línea)">
              <textarea
                rows={3}
                className={inputCls}
                value={brief.team}
                onChange={(e) => setBrief({ ...brief, team: e.target.value })}
                placeholder={"Andrés Leman Vargas — Geólogo\nJuan Arcos Vidal — Geólogo"}
              />
            </Field>
            <Field label="Documentos fuente (uno por línea)">
              <textarea
                rows={3}
                className={inputCls}
                value={brief.source_documents}
                onChange={(e) => setBrief({ ...brief, source_documents: e.target.value })}
              />
            </Field>
            <Field label="Riesgos (uno por línea)">
              <textarea
                rows={3}
                className={inputCls}
                value={brief.risks}
                onChange={(e) => setBrief({ ...brief, risks: e.target.value })}
              />
            </Field>
            <Field label="Conclusión">
              <textarea
                rows={3}
                className={inputCls}
                value={brief.conclusion}
                onChange={(e) => setBrief({ ...brief, conclusion: e.target.value })}
              />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Tamaño de la ronda (USD)">
              <input
                className={inputCls}
                value={ronda.round_size_usd}
                onChange={(e) => setRonda({ ...ronda, round_size_usd: e.target.value })}
              />
            </Field>
            <Field label="Ticket mínimo (USD)">
              <input
                className={inputCls}
                value={ronda.min_ticket_usd}
                onChange={(e) => setRonda({ ...ronda, min_ticket_usd: e.target.value })}
              />
            </Field>
            <Field label="Instrumento">
              <input
                className={inputCls}
                value={ronda.instrument}
                onChange={(e) => setRonda({ ...ronda, instrument: e.target.value })}
              />
            </Field>
            <Field label="% equity ofrecido">
              <input
                className={inputCls}
                value={ronda.equity_offered_pct}
                onChange={(e) => setRonda({ ...ronda, equity_offered_pct: e.target.value })}
              />
            </Field>
            <Field label="Valorización mínima (USD)">
              <input
                className={inputCls}
                value={ronda.valuation_low_usd}
                onChange={(e) => setRonda({ ...ronda, valuation_low_usd: e.target.value })}
              />
            </Field>
            <Field label="Valorización máxima (USD)">
              <input
                className={inputCls}
                value={ronda.valuation_high_usd}
                onChange={(e) => setRonda({ ...ronda, valuation_high_usd: e.target.value })}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Método de valorización">
                <input
                  className={inputCls}
                  value={ronda.valuation_method}
                  onChange={(e) => setRonda({ ...ronda, valuation_method: e.target.value })}
                  placeholder="Comparables de mercado / costo de reemplazo"
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Uso de fondos (uno por línea)">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={ronda.use_of_funds}
                  onChange={(e) => setRonda({ ...ronda, use_of_funds: e.target.value })}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Hitos (uno por línea)">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={ronda.milestones}
                  onChange={(e) => setRonda({ ...ronda, milestones: e.target.value })}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Notas y supuestos">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={ronda.notes}
                  onChange={(e) => setRonda({ ...ronda, notes: e.target.value })}
                />
              </Field>
            </div>
            <p className="md:col-span-2 text-[11px] text-muted-foreground">
              Los escenarios cargados aquí son referenciales mientras no exista una estimación de
              recursos o reservas bajo un estándar reconocido.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border text-xs font-mono disabled:opacity-40"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Anterior
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border text-xs font-mono hover:bg-accent"
          >
            Siguiente <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-gold text-background text-xs font-mono font-semibold disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Crear proyecto con antecedentes
          </button>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-2.5 py-1.5 rounded border border-border bg-background text-sm outline-none focus:border-gold/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function RowEditor<T extends object>({
  rows,
  onChange,
  empty,
  addLabel,
  render,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  empty: T;
  addLabel: string;
  render: (row: T, set: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="rounded border border-border/70 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">
              Registro {i + 1}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Eliminar registro"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {render(row, (patch) =>
              onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))),
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { ...empty }])}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-[11px] font-mono hover:bg-accent"
      >
        <Plus className="w-3 h-3" /> {addLabel}
      </button>
    </div>
  );
}

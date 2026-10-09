import { useMemo, useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useQaQc, type QaQcResult } from "@/hooks/useQaQc";
import { ShieldCheck, Plus, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLE: Record<
  QaQcResult["status"],
  { color: string; Icon: typeof CheckCircle2; label: string }
> = {
  pending: {
    color: "text-muted-foreground border-border bg-muted/30",
    Icon: Clock,
    label: "Pendiente",
  },
  pass: { color: "text-teal border-teal/30 bg-teal/10", Icon: CheckCircle2, label: "Pass" },
  warn: { color: "text-gold border-gold/30 bg-gold/10", Icon: AlertTriangle, label: "Warn" },
  fail: {
    color: "text-destructive border-destructive/30 bg-destructive/10",
    Icon: XCircle,
    label: "Fail",
  },
};

export function QaQcPage({ projectId }: { projectId: string }) {
  const { projects } = useProjects();
  const active = projects.find((project) => project.id === projectId);
  const { standards, results, loading, addStandard, addResult } = useQaQc(projectId);
  const [tab, setTab] = useState<"results" | "standards">("results");
  const [showStdForm, setShowStdForm] = useState(false);
  const [showResForm, setShowResForm] = useState(false);

  const stats = useMemo(() => {
    const total = results.length;
    const pass = results.filter((r) => r.status === "pass").length;
    const warn = results.filter((r) => r.status === "warn").length;
    const fail = results.filter((r) => r.status === "fail").length;
    const pending = results.filter((r) => r.status === "pending").length;
    return { total, pass, warn, fail, pending };
  }, [results]);

  if (!active)
    return <div className="p-8 text-sm text-muted-foreground">Selecciona un proyecto.</div>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-20 md:pb-8">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Proyecto · {active.code}
          </div>
          <h1 className="text-xl md:text-2xl font-bold mt-1 inline-flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-gold" /> QA/QC · Control de calidad
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Blanks, estándares y duplicados con semáforo automático.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowStdForm((v) => !v)}
            className="px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-accent inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Estándar
          </button>
          <button
            type="button"
            onClick={() => setShowResForm((v) => !v)}
            className="px-3 py-1.5 text-xs font-mono bg-gold text-bg-primary rounded hover:bg-gold/90 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Resultado QC
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        <KpiCard label="Total" value={stats.total} />
        <KpiCard label="Pass" value={stats.pass} tone="teal" />
        <KpiCard label="Warn" value={stats.warn} tone="gold" />
        <KpiCard label="Fail" value={stats.fail} tone="destructive" />
        <KpiCard label="Pendiente" value={stats.pending} />
      </div>

      {showStdForm && (
        <StandardForm
          onClose={() => setShowStdForm(false)}
          onSubmit={async (s) => {
            const { error } = await addStandard(s);
            if (error) toast.error(error);
            else {
              toast.success("Estándar agregado");
              setShowStdForm(false);
            }
          }}
        />
      )}

      {showResForm && (
        <ResultForm
          standards={standards}
          onClose={() => setShowResForm(false)}
          onSubmit={async (r) => {
            const { error } = await addResult(r);
            if (error) toast.error(error);
            else {
              toast.success("Resultado QC registrado");
              setShowResForm(false);
            }
          }}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4">
        <TabBtn
          active={tab === "results"}
          onClick={() => setTab("results")}
          label={`Resultados (${results.length})`}
        />
        <TabBtn
          active={tab === "standards"}
          onClick={() => setTab("standards")}
          label={`Estándares (${standards.length})`}
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : tab === "results" ? (
        <ResultsTable results={results} standards={standards} />
      ) : (
        <StandardsTable standards={standards} />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "teal" | "gold" | "destructive";
}) {
  const colorMap = {
    teal: "text-teal",
    gold: "text-gold",
    destructive: "text-destructive",
  };
  return (
    <div className="rounded border border-border bg-bg-secondary p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${tone ? colorMap[tone] : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-mono border-b-2 -mb-px transition-colors ${
        active
          ? "border-gold text-gold"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ResultsTable({
  results,
  standards,
}: {
  results: QaQcResult[];
  standards: { id: string; code: string; expected_value: number; unit: string }[];
}) {
  if (results.length === 0) {
    return (
      <div className="rounded border border-border bg-bg-secondary p-8 text-center text-xs font-mono text-muted-foreground">
        Sin resultados QC todavía.
      </div>
    );
  }
  const stdMap = new Map(standards.map((s) => [s.id, s]));
  return (
    <div className="rounded border border-border bg-bg-secondary overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/30 text-muted-foreground font-mono uppercase text-[10px]">
          <tr>
            <th className="text-left px-3 py-2">Estado</th>
            <th className="text-left px-3 py-2">Tipo</th>
            <th className="text-left px-3 py-2">Muestra</th>
            <th className="text-left px-3 py-2">Elem.</th>
            <th className="text-right px-3 py-2">Medido</th>
            <th className="text-right px-3 py-2">Esperado</th>
            <th className="text-left px-3 py-2">Ref</th>
            <th className="text-left px-3 py-2">Fecha</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {results.map((r) => {
            const st = STATUS_STYLE[r.status];
            const std = r.standard_id ? stdMap.get(r.standard_id) : null;
            return (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] uppercase ${st.color}`}
                  >
                    <st.Icon className="w-3 h-3" /> {st.label}
                  </span>
                </td>
                <td className="px-3 py-2 capitalize">{r.qc_type}</td>
                <td className="px-3 py-2">{r.sample_code}</td>
                <td className="px-3 py-2">{r.element}</td>
                <td className="px-3 py-2 text-right">{r.measured_value ?? "—"}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {std
                    ? `${std.expected_value} ${std.unit}`
                    : r.qc_type === "blank"
                      ? "≤0.01"
                      : (r.parent_sample_code ?? "—")}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {std?.code ?? r.parent_sample_code ?? "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.measured_at ?? new Date(r.created_at).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StandardsTable({
  standards,
}: {
  standards: {
    id: string;
    code: string;
    name: string;
    element: string;
    expected_value: number;
    tolerance_pct: number;
    unit: string;
    certifying_lab: string | null;
  }[];
}) {
  if (standards.length === 0) {
    return (
      <div className="rounded border border-border bg-bg-secondary p-8 text-center text-xs font-mono text-muted-foreground">
        Aún no hay estándares en este proyecto.
      </div>
    );
  }
  return (
    <div className="rounded border border-border bg-bg-secondary overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/30 text-muted-foreground font-mono uppercase text-[10px]">
          <tr>
            <th className="text-left px-3 py-2">Código</th>
            <th className="text-left px-3 py-2">Nombre</th>
            <th className="text-left px-3 py-2">Elem.</th>
            <th className="text-right px-3 py-2">Esperado</th>
            <th className="text-right px-3 py-2">Tol. ±%</th>
            <th className="text-left px-3 py-2">Lab certificador</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {standards.map((s) => (
            <tr key={s.id} className="border-t border-border">
              <td className="px-3 py-2 text-gold">{s.code}</td>
              <td className="px-3 py-2">{s.name}</td>
              <td className="px-3 py-2">{s.element}</td>
              <td className="px-3 py-2 text-right">
                {s.expected_value} {s.unit}
              </td>
              <td className="px-3 py-2 text-right">{s.tolerance_pct}%</td>
              <td className="px-3 py-2 text-muted-foreground">{s.certifying_lab ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StandardForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (s: {
    code: string;
    name: string;
    element: string;
    expected_value: number;
    tolerance_pct: number;
    unit: string;
    certifying_lab: string | null;
    notes: string | null;
  }) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [element, setElement] = useState("Au");
  const [expected, setExpected] = useState("");
  const [tol, setTol] = useState("10");
  const [unit, setUnit] = useState("g/t");
  const [lab, setLab] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          code,
          name,
          element,
          expected_value: parseFloat(expected),
          tolerance_pct: parseFloat(tol),
          unit,
          certifying_lab: lab || null,
          notes: null,
        });
      }}
      className="mb-6 rounded border border-border bg-bg-secondary p-4 grid grid-cols-1 md:grid-cols-4 gap-3"
    >
      <Field label="Código" value={code} onChange={setCode} required />
      <Field label="Nombre" value={name} onChange={setName} required />
      <Field label="Elemento" value={element} onChange={setElement} required />
      <Field
        label="Valor esperado"
        value={expected}
        onChange={setExpected}
        type="number"
        required
      />
      <Field label="Tolerancia ±%" value={tol} onChange={setTol} type="number" required />
      <Field label="Unidad" value={unit} onChange={setUnit} required />
      <Field label="Lab certificador" value={lab} onChange={setLab} />
      <div className="md:col-span-4 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-mono border border-border rounded"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 text-xs font-mono bg-gold text-bg-primary rounded"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}

function ResultForm({
  standards,
  onSubmit,
  onClose,
}: {
  standards: { id: string; code: string; element: string }[];
  onSubmit: (r: {
    sample_code: string;
    qc_type: "blank" | "standard" | "duplicate";
    element: string;
    measured_value: number | null;
    standard_id: string | null;
    parent_sample_code: string | null;
    certificate: string | null;
    lab: string | null;
    measured_at: string | null;
    notes: string | null;
  }) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"blank" | "standard" | "duplicate">("blank");
  const [element, setElement] = useState("Au");
  const [measured, setMeasured] = useState("");
  const [stdId, setStdId] = useState("");
  const [parent, setParent] = useState("");
  const [cert, setCert] = useState("");
  const [lab, setLab] = useState("");
  const [date, setDate] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          sample_code: code,
          qc_type: type,
          element,
          measured_value: measured ? parseFloat(measured) : null,
          standard_id: type === "standard" ? stdId || null : null,
          parent_sample_code: type === "duplicate" ? parent || null : null,
          certificate: cert || null,
          lab: lab || null,
          measured_at: date || null,
          notes: null,
        });
      }}
      className="mb-6 rounded border border-border bg-bg-secondary p-4 grid grid-cols-1 md:grid-cols-4 gap-3"
    >
      <Field label="Código muestra QC" value={code} onChange={setCode} required />
      <div>
        <label className="text-[10px] font-mono uppercase text-muted-foreground">Tipo</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "blank" | "standard" | "duplicate")}
          className="w-full mt-1 px-2 py-1.5 text-xs rounded border border-border bg-background font-mono"
        >
          <option value="blank">Blank</option>
          <option value="standard">Standard</option>
          <option value="duplicate">Duplicate</option>
        </select>
      </div>
      <Field label="Elemento" value={element} onChange={setElement} required />
      <Field label="Valor medido" value={measured} onChange={setMeasured} type="number" />
      {type === "standard" && (
        <div className="md:col-span-2">
          <label className="text-[10px] font-mono uppercase text-muted-foreground">
            Estándar de referencia
          </label>
          <select
            value={stdId}
            onChange={(e) => setStdId(e.target.value)}
            className="w-full mt-1 px-2 py-1.5 text-xs rounded border border-border bg-background font-mono"
          >
            <option value="">— seleccionar —</option>
            {standards
              .filter((s) => s.element === element)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
          </select>
        </div>
      )}
      {type === "duplicate" && <Field label="Muestra padre" value={parent} onChange={setParent} />}
      <Field label="Certificado" value={cert} onChange={setCert} />
      <Field label="Lab" value={lab} onChange={setLab} />
      <Field label="Fecha medición" value={date} onChange={setDate} type="date" />
      <div className="md:col-span-4 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-mono border border-border rounded"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 text-xs font-mono bg-gold text-bg-primary rounded"
        >
          Registrar
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-mono uppercase text-muted-foreground">
        {label}
        {required && " *"}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        step={type === "number" ? "any" : undefined}
        className="w-full mt-1 px-2 py-1.5 text-xs rounded border border-border bg-background font-mono"
      />
    </div>
  );
}

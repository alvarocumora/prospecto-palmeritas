import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, Beaker, AlertTriangle, FlaskConical, ShieldCheck, FileText, Sparkles } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useSamplingResults } from "@/hooks/useSamplingResults";
import { AssayCsvImport } from "@/components/sampling/AssayCsvImport";
import { GeochemFingerprintPanel } from "@/components/sampling/GeochemFingerprintPanel";

export const Route = createFileRoute("/_authenticated/dashboard/sampling")({
  head: () => ({ meta: [{ title: "Muestreo — Trackmin GeoIntel" }] }),
  component: SamplingPage,
});

function SamplingPage() {
  const { active } = useProjects();
  const { data, loading, refresh } = useSamplingResults(active?.id ?? null);
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState<"results" | "fingerprint">("results");

  const stats = {
    total: data.length,
    samples: data.filter((d) => !["blank", "standard", "duplicate"].includes(d.sample_type)).length,
    blanks: data.filter((d) => d.sample_type === "blank").length,
    standards: data.filter((d) => d.sample_type === "standard").length,
    duplicates: data.filter((d) => d.sample_type === "duplicate").length,
    auMax: data.reduce((m, d) => Math.max(m, d.au_gpt ?? 0), 0),
    auAvg: (() => {
      const vals = data.filter((d) => !["blank", "standard"].includes(d.sample_type)).map((d) => d.au_gpt ?? 0).filter((v) => v > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    })(),
    highGrade: data.filter((d) => (d.au_gpt ?? 0) >= 1).length,
  };

  if (!active) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Muestreo</h1>
        <p className="text-muted-foreground text-sm">Selecciona un proyecto activo para ver y cargar resultados de laboratorio.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" /> Muestreo · {active.name}
          </h1>
          <p className="text-sm text-muted-foreground">Resultados de laboratorio, QA/QC y geoquímica de superficie.</p>
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
        >
          <Upload className="w-4 h-4" /> Importar CSV laboratorio
        </button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <StatCard icon={<Beaker className="w-3 h-3" />} label="Total" value={stats.total} />
        <StatCard icon={<Beaker className="w-3 h-3" />} label="Muestras" value={stats.samples} />
        <StatCard icon={<ShieldCheck className="w-3 h-3" />} label="Blancos" value={stats.blanks} />
        <StatCard icon={<ShieldCheck className="w-3 h-3" />} label="Estándares" value={stats.standards} />
        <StatCard icon={<ShieldCheck className="w-3 h-3" />} label="Duplicados" value={stats.duplicates} />
        <StatCard icon={<AlertTriangle className="w-3 h-3" />} label="≥1 g/t Au" value={stats.highGrade} highlight />
        <StatCard icon={<FileText className="w-3 h-3" />} label="Au prom" value={stats.auAvg.toFixed(2)} suffix="g/t" />
        <StatCard icon={<FileText className="w-3 h-3" />} label="Au máx" value={stats.auMax.toFixed(2)} suffix="g/t" highlight />
      </div>

      <div className="rounded border border-border overflow-hidden">
        <div className="px-3 py-2 bg-muted text-xs font-mono uppercase text-muted-foreground border-b border-border flex items-center justify-between">
          <span>Resultados recientes</span>
          {loading && <span>cargando…</span>}
        </div>
        {data.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Sin muestras todavía. Haz clic en <strong className="text-foreground">Importar CSV laboratorio</strong> para cargar tu primer assay sheet de ALS, SGS, Bureau Veritas o ACME.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 px-3">Código</th>
                  <th className="text-left py-2 px-3">Tipo</th>
                  <th className="text-right py-2 px-3">Au g/t</th>
                  <th className="text-right py-2 px-3">Ag g/t</th>
                  <th className="text-right py-2 px-3">Cu %</th>
                  <th className="text-right py-2 px-3">As ppm</th>
                  <th className="text-right py-2 px-3">Sb ppm</th>
                  <th className="text-left py-2 px-3">Cert.</th>
                  <th className="text-left py-2 px-3">Lab</th>
                  <th className="text-left py-2 px-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 200).map((r) => {
                  const isQc = ["blank", "standard", "duplicate"].includes(r.sample_type);
                  const isHigh = (r.au_gpt ?? 0) >= 1;
                  return (
                    <tr key={r.id} className={`border-b border-border/40 hover:bg-muted/40 ${isQc ? "bg-muted/20" : ""} ${isHigh ? "bg-primary/5" : ""}`}>
                      <td className="py-1.5 px-3 font-semibold">{r.sample_code}</td>
                      <td className="py-1.5 px-3">
                        <span className={
                          r.sample_type === "blank" ? "text-info" :
                          r.sample_type === "standard" ? "text-primary" :
                          r.sample_type === "duplicate" ? "text-accent-foreground" : "text-muted-foreground"
                        }>{r.sample_type}</span>
                      </td>
                      <td className={`py-1.5 px-3 text-right ${isHigh ? "font-bold text-primary" : ""}`}>{r.au_gpt?.toFixed(3) ?? "—"}</td>
                      <td className="py-1.5 px-3 text-right">{r.ag_gpt?.toFixed(2) ?? "—"}</td>
                      <td className="py-1.5 px-3 text-right">{r.cu_pct?.toFixed(3) ?? "—"}</td>
                      <td className="py-1.5 px-3 text-right">{r.as_ppm ?? "—"}</td>
                      <td className="py-1.5 px-3 text-right">{r.sb_ppm ?? "—"}</td>
                      <td className="py-1.5 px-3 text-muted-foreground">{r.certificate ?? "—"}</td>
                      <td className="py-1.5 px-3 text-muted-foreground">{r.lab ?? "—"}</td>
                      <td className="py-1.5 px-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.length > 200 && (
              <div className="p-2 text-center text-[10px] text-muted-foreground border-t border-border">
                Mostrando 200 de {data.length} resultados
              </div>
            )}
          </div>
        )}
      </div>

      {importOpen && (
        <AssayCsvImport
          projectId={active.id}
          onClose={() => setImportOpen(false)}
          onSaved={() => { setImportOpen(false); refresh(); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, suffix, highlight }: { icon: React.ReactNode; label: string; value: number | string; suffix?: string; highlight?: boolean }) {
  return (
    <div className={`rounded border p-2 ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"}`}>
      <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase font-mono">{icon}{label}</div>
      <div className={`text-lg font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}{suffix && <span className="text-xs text-muted-foreground ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

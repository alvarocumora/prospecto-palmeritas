import { useState } from "react";
import { Sparkles, Play, Target as TargetIcon, AlertCircle, Loader2 } from "lucide-react";
import { useGeochemFingerprint, type GeochemAnalysis } from "@/hooks/useGeochemFingerprint";
import { toast } from "sonner";

export function GeochemFingerprintPanel({ projectId }: { projectId: string }) {
  const { latest, loading, running, error, run, generateTargets } = useGeochemFingerprint(projectId);
  const [generating, setGenerating] = useState(false);

  const onRun = async () => {
    const r = await run({ k: 4 });
    if (r.ok) toast.success("Fingerprint geoquímico generado");
    else toast.error(r.error ?? "Error generando fingerprint");
  };

  const onGenerateTargets = async () => {
    if (!latest) return;
    setGenerating(true);
    const r = await generateTargets(latest);
    setGenerating(false);
    if (r.ok) toast.success(`${r.created} targets creados desde clusters`);
    else toast.error(r.error ?? "Error creando targets");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded border border-border bg-muted/20 p-4">
        <div className="flex-1 min-w-[260px]">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Geochemical Fingerprint
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Análisis multivariado (PCA + clustering) sobre todas las muestras del proyecto. Detecta la firma del depósito (pórfido, epitermal, IOCG, skarn, VMS) y agrupa muestras químicamente similares para vectorear hacia el centro mineralizado.
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Calculando…" : latest ? "Re-calcular" : "Generar fingerprint"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !latest && (
        <div className="text-sm text-muted-foreground p-6 text-center">Cargando análisis previo…</div>
      )}

      {!loading && !latest && !error && (
        <div className="rounded border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aún no hay análisis para este proyecto. Carga al menos 5 muestras y haz clic en <strong className="text-foreground">Generar fingerprint</strong>.
        </div>
      )}

      {latest && <FingerprintResults analysis={latest} onGenerateTargets={onGenerateTargets} generating={generating} />}
    </div>
  );
}

function FingerprintResults({ analysis, onGenerateTargets, generating }: { analysis: GeochemAnalysis; onGenerateTargets: () => void; generating: boolean }) {
  const conf = Math.round((analysis.signature_confidence ?? 0) * 100);
  const pf = Object.entries(analysis.pathfinder_scores).sort((a, b) => b[1] - a[1]);
  const maxPf = Math.max(...pf.map(([, v]) => v), 1);

  return (
    <div className="space-y-4">
      {/* Signature */}
      <div className="rounded border border-primary/40 bg-primary/5 p-4">
        <div className="text-[10px] uppercase font-mono text-muted-foreground">Firma detectada</div>
        <div className="text-xl font-bold text-primary mt-0.5">{analysis.signature ?? "—"}</div>
        <div className="text-xs text-muted-foreground mt-1">
          Confianza: <span className="font-semibold text-foreground">{conf}%</span> · {analysis.sample_count} muestras · {analysis.elements_used.length} elementos · {analysis.cluster_count} clusters
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          Generado: {new Date(analysis.created_at).toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PCA Biplot */}
        <div className="rounded border border-border p-3">
          <div className="text-xs font-mono uppercase text-muted-foreground mb-2">
            Biplot PC1 ({(analysis.pca_variance.pc1 * 100).toFixed(1)}%) vs PC2 ({(analysis.pca_variance.pc2 * 100).toFixed(1)}%)
          </div>
          <PcaBiplot analysis={analysis} />
        </div>

        {/* Pathfinder bar chart */}
        <div className="rounded border border-border p-3">
          <div className="text-xs font-mono uppercase text-muted-foreground mb-2">Índices pathfinder</div>
          <div className="space-y-2">
            {pf.map(([key, value]) => {
              const pct = (value / maxPf) * 100;
              const isTop = key === pf[0][0];
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className={isTop ? "font-semibold text-foreground" : "text-muted-foreground"}>{labelFor(key)}</span>
                    <span className="font-mono text-muted-foreground">{value.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded overflow-hidden">
                    <div className={isTop ? "h-full bg-primary" : "h-full bg-muted-foreground/40"} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Clusters table */}
      <div className="rounded border border-border overflow-hidden">
        <div className="px-3 py-2 bg-muted text-xs font-mono uppercase text-muted-foreground border-b border-border flex items-center justify-between">
          <span>Clusters geoquímicos</span>
          <button
            onClick={onGenerateTargets}
            disabled={generating}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <TargetIcon className="w-3 h-3" />}
            Generar targets desde clusters
          </button>
        </div>
        <table className="w-full text-xs font-mono">
          <thead className="bg-muted/50 text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left py-2 px-3">Cluster</th>
              <th className="text-right py-2 px-3">Muestras</th>
              <th className="text-right py-2 px-3">Au prom (g/t)</th>
              <th className="text-right py-2 px-3">PC1</th>
              <th className="text-right py-2 px-3">PC2</th>
            </tr>
          </thead>
          <tbody>
            {analysis.clusters.map((c) => (
              <tr key={c.cluster} className="border-b border-border/40">
                <td className="py-1.5 px-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ background: clusterColor(c.cluster) }} />
                    #{c.cluster + 1}
                  </span>
                </td>
                <td className="py-1.5 px-3 text-right">{c.sample_count}</td>
                <td className={`py-1.5 px-3 text-right ${c.au_mean_gpt >= 1 ? "font-bold text-primary" : ""}`}>{c.au_mean_gpt.toFixed(3)}</td>
                <td className="py-1.5 px-3 text-right text-muted-foreground">{c.centroid_pc1.toFixed(2)}</td>
                <td className="py-1.5 px-3 text-right text-muted-foreground">{c.centroid_pc2.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PcaBiplot({ analysis }: { analysis: GeochemAnalysis }) {
  const W = 360, H = 280, M = 30;
  const pts = analysis.pca_scores;
  if (pts.length === 0) return <div className="text-xs text-muted-foreground">Sin datos</div>;
  const xs = pts.map((p) => p.pc1);
  const ys = pts.map((p) => p.pc2);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const sx = (x: number) => M + ((x - xMin) / (xMax - xMin || 1)) * (W - 2 * M);
  const sy = (y: number) => H - M - ((y - yMin) / (yMax - yMin || 1)) * (H - 2 * M);

  const loadings = Object.entries(analysis.pca_loadings);
  const loadScale = Math.min(W, H) * 0.35;
  const loadMax = Math.max(...loadings.map(([, v]) => Math.hypot(v.pc1, v.pc2)), 0.1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* axes */}
      <line x1={M} y1={H / 2} x2={W - M} y2={H / 2} stroke="hsl(var(--border))" strokeDasharray="2 2" />
      <line x1={W / 2} y1={M} x2={W / 2} y2={H - M} stroke="hsl(var(--border))" strokeDasharray="2 2" />
      {/* sample dots */}
      {pts.map((p) => (
        <circle key={p.sample_id} cx={sx(p.pc1)} cy={sy(p.pc2)} r={3} fill={clusterColor(p.cluster)} fillOpacity={0.7} />
      ))}
      {/* loading vectors */}
      {loadings.map(([elem, v]) => {
        const x2 = W / 2 + (v.pc1 / loadMax) * loadScale;
        const y2 = H / 2 - (v.pc2 / loadMax) * loadScale;
        return (
          <g key={elem}>
            <line x1={W / 2} y1={H / 2} x2={x2} y2={y2} stroke="hsl(var(--primary))" strokeWidth={1.2} />
            <text x={x2} y={y2} dx={4} dy={-2} fontSize="9" fill="hsl(var(--primary))" fontFamily="monospace">{elem.replace("_gpt", "").replace("_pct", "%").replace("_ppm", "").toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
}

function labelFor(key: string): string {
  const m: Record<string, string> = {
    epithermal: "Epitermal (As+Sb+Hg)",
    porphyry: "Pórfido (Cu+Mo)",
    iocg: "IOCG (Cu+Au)",
    skarn: "Skarn (Zn+Pb+Cu)",
    vms: "VMS (Zn+Pb+Cu+Ag)",
  };
  return m[key] ?? key;
}

const CLUSTER_COLORS = ["#0ea5e9", "#f97316", "#a855f7", "#22c55e", "#eab308", "#ec4899"];
function clusterColor(c: number): string {
  return CLUSTER_COLORS[c % CLUSTER_COLORS.length];
}

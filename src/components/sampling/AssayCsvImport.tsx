import { useMemo, useState } from "react";
import { Upload, X, FileText, AlertTriangle, CheckCircle2, Loader2, Beaker, FlaskConical, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseAssayCsv, runQaQc, type ParsedAssay } from "@/lib/sampling/assayParser";

const TEMPLATE = `SAMPLE_ID,Au_ppm,Ag_ppm,Cu_pct,As_ppm,Sb_ppm,Hg_ppm,Pb_ppm,Zn_ppm,Mo_ppm,CERTIFICATE,LAB
LP-001,0.852,12.3,0.45,234,45,1.2,89,156,8,LA12345,ALS
LP-002,1.245,18.7,0.67,512,89,2.4,134,203,12,LA12345,ALS
LP-003,<0.005,2.1,0.12,45,12,0.5,23,67,3,LA12345,ALS
LP-002-D,1.198,17.9,0.65,498,87,2.3,131,198,11,LA12345,ALS
BLK-001,<0.005,<0.5,<0.01,<5,<2,<0.1,<5,<5,<1,LA12345,ALS
STD-OREAS45e,2.450,1.8,0.08,8,3,0.2,15,42,4,LA12345,ALS`;

export function AssayCsvImport({
  projectId,
  defaultSampleType = "rock_chip",
  onClose,
  onSaved,
}: {
  projectId: string;
  defaultSampleType?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [sampleType, setSampleType] = useState(defaultSampleType);
  const [zone, setZone] = useState("");

  const parsed = useMemo(() => (text ? parseAssayCsv(text) : null), [text]);
  const validRows = parsed?.rows.filter((r) => r.errors.length === 0) ?? [];
  const invalidRows = parsed?.rows.filter((r) => r.errors.length > 0) ?? [];
  const qcAlerts = useMemo(() => (parsed ? runQaQc(parsed.rows) : []), [parsed]);

  const handleFile = async (file: File) => setText(await file.text());

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "muestras_laboratorio_plantilla.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!user) { toast.error("Sin sesión"); return; }
    if (validRows.length === 0) { toast.error("No hay filas válidas para importar"); return; }
    setImporting(true);
    try {
      const payload = validRows.map((r: ParsedAssay) => {
        const noteParts: string[] = [];
        if (r.qc_type !== "sample") noteParts.push(`QC:${r.qc_type}${r.parent_code ? ` of ${r.parent_code}` : ""}`);
        if (r.warnings.length) noteParts.push(...r.warnings);
        return {
          project_id: projectId,
          created_by: user.id,
          sample_code: r.sample_code,
          sample_type: r.qc_type === "sample" ? sampleType : r.qc_type,
          zone: zone || null,
          au_gpt: r.au_gpt,
          ag_gpt: r.ag_gpt,
          cu_pct: r.cu_pct,
          as_ppm: r.as_ppm,
          sb_ppm: r.sb_ppm,
          hg_ppm: r.hg_ppm,
          pb_ppm: r.pb_ppm,
          zn_ppm: r.zn_ppm,
          mo_ppm: r.mo_ppm,
          certificate: r.certificate,
          lab: r.lab,
          notes: noteParts.join(" | ") || null,
        };
      });
      const CHUNK = 200;
      let inserted = 0;
      for (let i = 0; i < payload.length; i += CHUNK) {
        const chunk = payload.slice(i, i + CHUNK);
        const { error } = await supabase.from("sampling_results").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      toast.success(`${inserted} muestras importadas`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const preview = parsed?.rows.slice(0, 50) ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-lg w-full max-w-5xl my-8 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-mono uppercase tracking-wide flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" /> Importar assay sheet de laboratorio
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">Archivo CSV (ALS / SGS / Bureau Veritas / ACME)</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                className="block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:font-mono file:cursor-pointer"
              />
              <button onClick={downloadTemplate} className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline">
                <FileText className="w-3 h-3" /> Descargar plantilla
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">Tipo muestra</label>
                <select value={sampleType} onChange={(e) => setSampleType(e.target.value)} className="w-full text-xs bg-background border border-border rounded p-1.5 font-mono">
                  <option value="rock_chip">Rock chip</option>
                  <option value="channel">Canal</option>
                  <option value="grab">Grab</option>
                  <option value="soil">Suelo</option>
                  <option value="stream_sediment">Sedimento</option>
                  <option value="core">Testigo</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">Zona</label>
                <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ej: Vena Norte" className="w-full text-xs bg-background border border-border rounded p-1.5 font-mono" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">o pegar contenido</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="SAMPLE_ID,Au_ppm,Ag_ppm,Cu_pct,..."
              rows={4}
              className="w-full text-[11px] font-mono bg-muted border border-border rounded p-2 resize-y"
            />
          </div>

          <div className="text-[11px] font-mono text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Detección automática:</strong> elementos por nombre+unidad (Au_ppm, Ag g/t, Cu_pct, As_ppm…), valores bajo límite (&lt;0.005 → 0.0025).
            <br />
            <strong className="text-foreground">QA/QC por código:</strong> <span className="text-info">BLK/BLANK</span> = blanco · <span className="text-info">STD/CRM/OREAS</span> = estándar · <span className="text-info">SAMPLE-D / -DUP</span> = duplicado.
          </div>

          {parsed?.headerError && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs font-mono text-destructive">
              {parsed.headerError}
            </div>
          )}

          {parsed && Object.keys(parsed.detectedColumns).length > 0 && (
            <div className="rounded border border-border bg-muted/40 p-3">
              <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Columnas detectadas</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(parsed.detectedColumns).map(([logical, original]) => (
                  <span key={logical} className="text-[10px] font-mono bg-background border border-border rounded px-1.5 py-0.5">
                    <span className="text-primary">{logical}</span> ← {original}
                  </span>
                ))}
              </div>
            </div>
          )}

          {parsed && parsed.rows.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <Stat icon={<Beaker className="w-3 h-3" />} label="Muestras" value={parsed.qcStats.samples} />
              <Stat icon={<ShieldCheck className="w-3 h-3" />} label="Blancos" value={parsed.qcStats.blanks} color="text-info" />
              <Stat icon={<ShieldCheck className="w-3 h-3" />} label="Estándares" value={parsed.qcStats.standards} color="text-primary" />
              <Stat icon={<ShieldCheck className="w-3 h-3" />} label="Duplicados" value={parsed.qcStats.duplicates} color="text-accent-foreground" />
            </div>
          )}

          {qcAlerts.length > 0 && (
            <div className="rounded border border-orange-500/40 bg-orange-500/10 p-3 space-y-1">
              <div className="text-xs font-mono uppercase text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> {qcAlerts.length} alertas QA/QC
              </div>
              <ul className="text-[11px] font-mono space-y-0.5 max-h-32 overflow-y-auto">
                {qcAlerts.slice(0, 20).map((a, i) => (
                  <li key={i} className={a.severity === "critical" ? "text-destructive" : "text-orange-600 dark:text-orange-400"}>
                    fila {a.rowNum} · {a.sample_code}: {a.message}
                  </li>
                ))}
                {qcAlerts.length > 20 && <li className="text-muted-foreground">… y {qcAlerts.length - 20} más</li>}
              </ul>
            </div>
          )}

          {parsed && parsed.rows.length > 0 && (
            <div className="flex flex-wrap gap-3 text-xs font-mono">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" /> {validRows.length} válidas
              </span>
              {invalidRows.length > 0 && (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertTriangle className="w-3 h-3" /> {invalidRows.length} con errores
                </span>
              )}
            </div>
          )}

          {preview.length > 0 && (
            <div className="rounded border border-border overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead className="bg-muted text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-1.5 px-2">#</th>
                    <th className="text-left py-1.5 px-2">sample_code</th>
                    <th className="text-left py-1.5 px-2">qc</th>
                    <th className="text-right py-1.5 px-2">Au g/t</th>
                    <th className="text-right py-1.5 px-2">Ag g/t</th>
                    <th className="text-right py-1.5 px-2">Cu %</th>
                    <th className="text-right py-1.5 px-2">As ppm</th>
                    <th className="text-left py-1.5 px-2">notas</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.rowNum} className={`border-b border-border/40 ${r.errors.length ? "bg-destructive/5" : r.qc_type !== "sample" ? "bg-info/5" : ""}`}>
                      <td className="py-1 px-2 text-muted-foreground">{r.rowNum}</td>
                      <td className="py-1 px-2">{r.sample_code || <span className="text-destructive">∅</span>}</td>
                      <td className="py-1 px-2">
                        <span className={
                          r.qc_type === "blank" ? "text-info" :
                          r.qc_type === "standard" ? "text-primary" :
                          r.qc_type === "duplicate" ? "text-accent-foreground" : "text-muted-foreground"
                        }>{r.qc_type}</span>
                      </td>
                      <td className="py-1 px-2 text-right">{r.au_gpt?.toFixed(3) ?? "—"}</td>
                      <td className="py-1 px-2 text-right">{r.ag_gpt?.toFixed(2) ?? "—"}</td>
                      <td className="py-1 px-2 text-right">{r.cu_pct?.toFixed(3) ?? "—"}</td>
                      <td className="py-1 px-2 text-right">{r.as_ppm ?? "—"}</td>
                      <td className="py-1 px-2 text-muted-foreground truncate max-w-[180px]" title={[...r.errors, ...r.warnings].join(" | ")}>
                        {r.errors[0] || r.warnings[0] || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed && parsed.rows.length > preview.length && (
                <div className="text-[10px] font-mono text-muted-foreground p-2 text-center border-t border-border">
                  Mostrando {preview.length} de {parsed.rows.length} filas
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
          <button onClick={onClose} className="text-xs font-mono text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={importing || validRows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-mono font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Importar {validRows.length} muestras
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color = "text-foreground" }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <div className="rounded border border-border bg-muted/30 p-2">
      <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase">{icon}{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

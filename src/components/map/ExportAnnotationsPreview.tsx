// Preview dialog shown before exporting annotations to CSV or PDF.
// Lets the user confirm header, project name, and counts before download.
import { Download, FileText, FileSpreadsheet, X } from "lucide-react";
import type { MapAnnotation } from "@/hooks/useMapAnnotations";
import { ANNOTATION_COLORS } from "@/hooks/useMapAnnotations";
import { exportAnnotationsCsv, exportAnnotationsPdf } from "./exportAnnotations";

interface Props {
  open: boolean;
  format: "csv" | "pdf";
  annotations: MapAnnotation[];
  totalAnnotations: number;
  projectName: string;
  targetMap?: Map<string, { code: string }>;
  campaignMap?: Map<string, { name: string }>;
  filterSummary?: string;
  showResolved: boolean;
  onClose: () => void;
}

export function ExportAnnotationsPreview({
  open, format, annotations, totalAnnotations, projectName, targetMap, campaignMap,
  filterSummary, showResolved, onClose,
}: Props) {
  if (!open) return null;

  const total = annotations.length;
  const resolved = annotations.filter((a) => a.resolved).length;
  const pending = total - resolved;
  const linkedTarget = annotations.filter((a) => a.target_id).length;
  const linkedCampaign = annotations.filter((a) => a.campaign_id).length;
  const linkedPhase = annotations.filter((a) => a.phase).length;

  // Color breakdown
  const byColor = new Map<string, number>();
  for (const a of annotations) byColor.set(a.color, (byColor.get(a.color) ?? 0) + 1);

  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = projectName.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
  const filename = `anotaciones-${safeName}-${stamp}.${format}`;
  const isPdf = format === "pdf";

  const handleDownload = () => {
    if (isPdf) {
      exportAnnotationsPdf(annotations, { projectName, targetMap, campaignMap });
    } else {
      exportAnnotationsCsv(annotations, { projectName, targetMap, campaignMap });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPdf ? (
              <FileText className="w-4 h-4 text-gold" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-gold" />
            )}
            <div>
              <div className="text-[11px] font-mono uppercase text-muted-foreground">
                Vista previa · Exportar {format.toUpperCase()}
              </div>
              <div className="text-xs font-mono text-foreground mt-0.5">{filename}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
          {/* Document header preview */}
          <div className="rounded border border-gold/30 bg-gold/5 p-3">
            <div className="text-[10px] font-mono uppercase text-gold mb-1">Encabezado del reporte</div>
            <div className="text-sm font-bold text-foreground">
              Anotaciones del mapa — {projectName}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground mt-1">
              Total: {total} · Resueltas: {resolved} · Generado: {new Date().toLocaleString("es-CL")}
            </div>
          </div>

          {/* Counts grid */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Total" value={total} accent="gold" />
            <Stat label="Pendientes" value={pending} accent="amber" />
            <Stat label="Resueltas" value={resolved} accent="green" />
          </div>

          {/* Links */}
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1.5">
              Vínculos
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Target" value={linkedTarget} accent="blue" small />
              <Stat label="Campaña" value={linkedCampaign} accent="purple" small />
              <Stat label="Fase" value={linkedPhase} accent="green" small />
            </div>
          </div>

          {/* Color breakdown */}
          {byColor.size > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1.5">
                Por categoría
              </div>
              <div className="space-y-1">
                {ANNOTATION_COLORS.filter((c) => byColor.has(c.value)).map((c) => (
                  <div
                    key={c.value}
                    className="flex items-center justify-between px-2 py-1 rounded border border-border bg-accent/20 text-[11px] font-mono"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: c.hex }}
                      />
                      <span className="text-foreground">{c.label}</span>
                    </span>
                    <span className="text-muted-foreground">{byColor.get(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {total === 0 && (
            <div className="text-center py-4 text-[11px] font-mono text-muted-foreground border border-dashed border-border rounded">
              No hay anotaciones para exportar con los filtros actuales.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={handleDownload}
            disabled={total === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gold text-bg-primary text-[11px] font-mono font-bold hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar {format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label, value, accent, small,
}: { label: string; value: number; accent: "gold" | "amber" | "green" | "blue" | "purple"; small?: boolean }) {
  const colors: Record<string, string> = {
    gold: "border-gold/30 text-gold",
    amber: "border-amber-500/30 text-amber-500",
    green: "border-emerald-500/30 text-emerald-500",
    blue: "border-blue-500/30 text-blue-500",
    purple: "border-purple-500/30 text-purple-500",
  };
  return (
    <div className={`rounded border ${colors[accent]} bg-accent/10 px-2 py-1.5`}>
      <div className="text-[9px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className={`font-mono font-bold ${small ? "text-sm" : "text-lg"} leading-tight`}>
        {value}
      </div>
    </div>
  );
}

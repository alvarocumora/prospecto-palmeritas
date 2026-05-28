// NI 43-101 Mode Panel — Sprint 4
// Construye un reporte estructurado a partir del estado actual del engine.
// Permite exportar JSON listo para PDF.
import { useMemo } from "react";
import { X, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlockModelOutput } from "@/engine3d/workers/blockModel.worker";
import type { BlockModelParams } from "@/engine3d/hooks/useBlockModel";
import type { QAQCResult } from "@/engine3d/qaqc/qaqc.worker";
import type { EstimationSettings } from "@/engine3d/qaqc/estimationPresets";
import type { ParsedDrillholeBundle } from "@/engine3d/data/csvDrillholes";
import { auditTrail, computeHash } from "@/engine3d/qaqc/auditTrail";
import { modelVersions } from "@/engine3d/qaqc/modelVersions";

type Props = {
  projectId: string;
  model: BlockModelOutput | null;
  params: BlockModelParams;
  estimation: EstimationSettings;
  qaqc: QAQCResult | null;
  bundle: ParsedDrillholeBundle | null;
  econ: { price: number; opex: number; capex: number; recovery: number; discount: number; years: number };
  onClose: () => void;
};

export function NI43101Panel({ projectId, model, params, estimation, qaqc, bundle, econ, onClose }: Props) {
  const report = useMemo(() => buildReport({ projectId, model, params, estimation, qaqc, bundle, econ }), [
    projectId, model, params, estimation, qaqc, bundle, econ,
  ]);

  function snapshot() {
    const event = auditTrail.log("ni43101.snapshot", { hash: report.hash, projectId });
    const versions = modelVersions.list();
    const blob = new Blob([JSON.stringify({ ...report, scenarioId: event.scenarioId, versions }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ni43101-${projectId}-${event.scenarioId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="absolute inset-2 z-30 bg-black/95 backdrop-blur rounded-lg border border-border flex flex-col font-mono text-[11px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 uppercase tracking-wider text-[10px] text-gold">
          <FileText className="w-3.5 h-3.5" /> NI 43-101 mode · reporte preliminar
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={snapshot}>
            <Download className="w-3 h-3 mr-1" /> Snapshot JSON
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-foreground/90">
        <Section title="1. Data source summary">
          <KV k="Project ID" v={projectId} />
          <KV k="Collars importados" v={bundle?.collars.length ?? 0} />
          <KV k="Surveys" v={bundle?.surveys.length ?? 0} />
          <KV k="Assays" v={bundle?.assays.length ?? 0} />
          <KV k="Lithology" v={bundle?.lithology.length ?? 0} />
        </Section>

        <Section title="2. QA/QC summary">
          {qaqc ? (
            <>
              <KV k="Critical issues" v={qaqc.summary.critical} cls={qaqc.summary.critical > 0 ? "text-red-300" : "text-emerald-300"} />
              <KV k="Warnings" v={qaqc.summary.warning} />
              <KV k="Info" v={qaqc.summary.info} />
              <KV k="QA/QC hash" v={qaqc.summary.hash} />
            </>
          ) : (
            <div className="text-muted-foreground">QA/QC no ejecutado.</div>
          )}
        </Section>

        <Section title="3. Estimation method">
          <KV k="Método" v="Inverse Distance Weighting (IDW)" />
          <KV k="IDW power" v={estimation.idwPower} />
          <KV k="Search radius" v={`${estimation.searchRadius} m`} />
          <KV k="Min / Max samples" v={`${estimation.minSamples} / ${estimation.maxSamples}`} />
          <KV k="Anisotropía" v={`rx ${estimation.anisotropy.rx} · ry ${estimation.anisotropy.ry} · rz ${estimation.anisotropy.rz}`} />
          <KV k="Block size" v={`${params.blockSize} m`} />
          <KV k="Density default" v={`${estimation.defaultDensity} t/m³`} />
        </Section>

        <Section title="4. Classification logic">
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            Measured: distancia al sample más cercano ≤ {params.classMeasuredR} m.
            Indicated: ≤ {params.classIndicatedR} m. Inferred: dentro del search radius pero superior al umbral indicated.
            Bloques sin samples dentro del radio se clasifican como waste / unestimated.
          </div>
        </Section>

        <Section title="5. Resource summary">
          {model ? (
            <>
              <KV k="Bloques estimados" v={model.count} />
              <KV k="Grade promedio" v={model.stats.gradeMean.toFixed(3)} />
              <KV k="Tonnes totales" v={`${(model.stats.tonnesTotal / 1e6).toFixed(2)} Mt`} />
              <KV k="Metal contenido" v={model.stats.metalTotal.toExponential(3)} />
              <KV k="Measured / Indicated / Inferred" v={`${model.stats.measured} / ${model.stats.indicated} / ${model.stats.inferred}`} />
            </>
          ) : (
            <div className="text-muted-foreground">Block model no construido.</div>
          )}
        </Section>

        <Section title="6. Economic parameters">
          <KV k="Precio" v={`USD ${econ.price}`} />
          <KV k="OPEX" v={`USD ${econ.opex}/t`} />
          <KV k="CAPEX" v={`USD ${(econ.capex / 1e6).toFixed(1)} M`} />
          <KV k="Recovery" v={`${econ.recovery}%`} />
          <KV k="Discount rate" v={`${(econ.discount * 100).toFixed(1)}%`} />
          <KV k="LOM" v={`${econ.years} años`} />
        </Section>

        <Section title="7. Assumptions & limitations">
          <ul className="text-[10px] text-muted-foreground leading-relaxed list-disc pl-4 space-y-1">
            <li>Estimación preliminar para fines exploratorios — no constituye un reporte NI 43-101 firmado.</li>
            <li>Modelo de bloques generado vía IDW; no se aplican variogramas, kriging ni validación cruzada.</li>
            <li>Densidad asignada por default; se recomienda medición directa por litología.</li>
            <li>Económicos calculados con flujo lineal simplificado, sin sustaining capex, regalías ni impuestos.</li>
            <li>Datos satelitales / geofísicos integrados como guía exploratoria; no sustituyen sondajes.</li>
          </ul>
        </Section>

        <Section title="8. Cautionary statement">
          <div className="text-[10px] text-amber-300 leading-relaxed border border-amber-500/40 bg-amber-500/10 rounded p-2">
            Este reporte es un MODELO PRELIMINAR generado automáticamente. No reemplaza un Technical Report
            firmado por un Qualified Person (QP) conforme al National Instrument 43-101. Los resultados deben
            ser revisados, validados y firmados por un QP independiente antes de ser usados para decisiones
            de inversión, divulgación pública o financiamiento.
          </div>
        </Section>

        <div className="text-[9px] text-muted-foreground border-t border-border pt-2">
          Report hash: <span className="text-emerald-300">{report.hash}</span> · generado{" "}
          {new Date(report.generatedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border/60 rounded p-2 bg-black/40">
      <div className="text-[10px] uppercase tracking-wider text-gold mb-1.5">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
function KV({ k, v, cls }: { k: string; v: string | number; cls?: string }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-muted-foreground">{k}</span>
      <span className={cls ?? "text-foreground"}>{typeof v === "number" ? v.toLocaleString() : v}</span>
    </div>
  );
}

function buildReport(args: Omit<Props, "onClose">) {
  const generatedAt = Date.now();
  const payload = {
    projectId: args.projectId,
    bundle: args.bundle
      ? {
          collars: args.bundle.collars.length,
          surveys: args.bundle.surveys.length,
          assays: args.bundle.assays.length,
          lithology: args.bundle.lithology.length,
        }
      : null,
    qaqc: args.qaqc?.summary ?? null,
    estimation: args.estimation,
    params: args.params,
    model: args.model?.stats ?? null,
    economics: args.econ,
  };
  return { generatedAt, payload, hash: computeHash(payload) };
}

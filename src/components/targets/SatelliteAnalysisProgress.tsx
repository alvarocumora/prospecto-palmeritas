import { Progress } from "@/components/ui/progress";
import { Check, Loader2, Satellite } from "lucide-react";
import type { SatIndexCode } from "@/hooks/useProjectSatelliteAnomalies";
import { SAT_INDEX_CODES } from "@/hooks/useProjectSatelliteAnomalies";
import type { ProgressState } from "@/hooks/useSatelliteAnalysisProgress";

const INDEX_LABEL: Record<SatIndexCode, string> = {
  IRON_OXIDE: "Óxidos de hierro",
  CLAY_MINERALS: "Arcillas",
  HYDROTHERMAL_ALTERATION: "Alteración hidrotermal",
  STRUCTURAL_LINEAMENTS: "Lineamientos",
};

type Props = {
  progress: ProgressState;
  expectedRuns: number;
  expectedAnomalies: number;
};

export function SatelliteAnalysisProgress({ progress, expectedRuns, expectedAnomalies }: Props) {
  const { runsDone, anomaliesDone, currentIndex, indicesDone, percent } = progress;
  // Mostrar al menos 5% para que se note movimiento al iniciar.
  const displayed = Math.max(percent, 5);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 rounded border border-signal-cyan/40 bg-signal-cyan/5 p-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <Satellite className="w-4 h-4 text-signal-cyan" />
        <div className="text-xs font-mono text-signal-cyan">
          Análisis satelital Sentinel-2 en curso
        </div>
        <div className="ml-auto text-xs font-mono text-signal-cyan/80">{percent}%</div>
      </div>
      <Progress value={displayed} className="h-1.5" />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-muted-foreground">
        <span>
          Índices{" "}
          <span className="text-foreground">
            {runsDone}/{expectedRuns}
          </span>
        </span>
        <span>·</span>
        <span>
          Anomalías{" "}
          <span className="text-foreground">
            {anomaliesDone}/{expectedAnomalies}
          </span>
        </span>
        {currentIndex && (
          <>
            <span>·</span>
            <span>
              Procesando <span className="text-signal-cyan">{INDEX_LABEL[currentIndex]}</span>
            </span>
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SAT_INDEX_CODES.map((code) => {
          const done = indicesDone.includes(code);
          const active = !done && currentIndex === code;
          return (
            <span
              key={code}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                done
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  : active
                    ? "border-signal-cyan/40 text-signal-cyan bg-signal-cyan/10"
                    : "border-border text-muted-foreground bg-bg-secondary"
              }`}
            >
              {done ? (
                <Check className="w-2.5 h-2.5" />
              ) : active ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : null}
              {INDEX_LABEL[code]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

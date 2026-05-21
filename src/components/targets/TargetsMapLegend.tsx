import type { AnomaliesByIndex, SatIndexCode } from "@/hooks/useProjectSatelliteAnomalies";
import type { ConcessionRow } from "@/hooks/useProjectMiningConcessions";

const INDEX_META: Record<SatIndexCode, { label: string; cssVar: string }> = {
  IRON_OXIDE: { label: "Óxido de hierro", cssVar: "--sat-iron" },
  CLAY_MINERALS: { label: "Arcillas", cssVar: "--sat-clay" },
  HYDROTHERMAL_ALTERATION: { label: "Alt. hidrotermal", cssVar: "--sat-hydro" },
  STRUCTURAL_LINEAMENTS: { label: "Lineamientos", cssVar: "--sat-struct" },
};

export function TargetsMapLegend({
  anomaliesByIndex,
  concessions,
}: {
  anomaliesByIndex?: AnomaliesByIndex;
  concessions?: ConcessionRow[];
}) {
  const totalAnoms = anomaliesByIndex
    ? Object.values(anomaliesByIndex).reduce((s, arr) => s + arr.length, 0)
    : 0;
  const concCount = concessions?.length ?? 0;
  if (totalAnoms === 0 && concCount === 0) return null;

  return (
    <div className="absolute right-2 top-16 z-[400] rounded-md border border-border bg-background/90 backdrop-blur p-2 shadow-lg text-[10px] font-mono space-y-1.5 max-w-[200px]">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Leyenda</div>

      {concCount > 0 && (
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-sm border"
            style={{
              background: "color-mix(in oklch, var(--catastro-explotacion) 30%, transparent)",
              borderColor: "var(--catastro-explotacion)",
            }}
          />
          <span className="text-foreground/90">Catastro</span>
          <span className="ml-auto text-muted-foreground">{concCount}</span>
        </div>
      )}

      {anomaliesByIndex &&
        (Object.keys(INDEX_META) as SatIndexCode[]).map((k) => {
          const arr = anomaliesByIndex[k];
          if (!arr || arr.length === 0) return null;
          const meta = INDEX_META[k];
          return (
            <div key={k} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm border"
                style={{
                  background: `color-mix(in oklch, var(${meta.cssVar}) 40%, transparent)`,
                  borderColor: `var(${meta.cssVar})`,
                }}
              />
              <span className="text-foreground/90">{meta.label}</span>
              <span className="ml-auto text-muted-foreground">{arr.length}</span>
            </div>
          );
        })}
    </div>
  );
}

export { INDEX_META };

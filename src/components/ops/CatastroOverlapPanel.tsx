import { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import * as turf from "@turf/turf";
import { CATASTRO_STYLE, type CatastroOrigen } from "@/components/map/overlays";
import type { MiningConcession } from "@/hooks/useMiningConcessions";

type CatastroFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  {
    ORIGEN?: CatastroOrigen;
    NOMBRE?: string;
    NUMERO_ROL?: string | number;
    DV_ROL?: string;
    HECTAREAS?: number;
    TITULAR_DIVISION?: string;
    SITUACION_CONCESION?: string;
  }
>;

type Props = {
  /** SERNAGEOMIN features currently in view (from CatastroMap). */
  catastroFeatures: CatastroFeature[];
  /** Project concessions with geometry. */
  projectConcessions: MiningConcession[];
};

type OverlapRow = {
  concession: MiningConcession;
  concessionAreaHa: number;
  overlapHa: number;
  pctOfConcession: number;
  hits: Array<{
    nombre: string;
    rol: string;
    origen: CatastroOrigen;
    titular: string;
    overlapHa: number;
    pctOfHit: number;
  }>;
};

function toPolygon(geom: unknown): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
  if (!geom || typeof geom !== "object") return null;
  const g = geom as GeoJSON.Geometry;
  if (g.type === "Polygon" || g.type === "MultiPolygon") {
    return turf.feature(g) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  }
  return null;
}

function safeArea(f: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>): number {
  try {
    return turf.area(f);
  } catch {
    return 0;
  }
}

function safeIntersect(
  a: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  b: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
  try {
    const fc = turf.featureCollection([a, b]);
    const r = turf.intersect(fc);
    return r as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
  } catch {
    return null;
  }
}

export function CatastroOverlapPanel({ catastroFeatures, projectConcessions }: Props) {
  const [computing, setComputing] = useState(false);
  const [rows, setRows] = useState<OverlapRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligibleProject = useMemo(
    () => projectConcessions.filter((c) => !!c.geometry_geojson),
    [projectConcessions],
  );

  const compute = () => {
    setError(null);
    setComputing(true);
    // Defer to next tick so UI shows the spinner
    setTimeout(() => {
      try {
        const result: OverlapRow[] = [];
        for (const c of eligibleProject) {
          const cPoly = toPolygon(c.geometry_geojson);
          if (!cPoly) continue;
          const cArea = safeArea(cPoly);
          const cAreaHa = cArea / 10_000;
          const hits: OverlapRow["hits"] = [];
          let totalOverlap = 0;
          for (const f of catastroFeatures) {
            const fPoly = toPolygon(f.geometry);
            if (!fPoly) continue;
            const inter = safeIntersect(cPoly, fPoly);
            if (!inter) continue;
            const interArea = safeArea(inter);
            if (interArea <= 1) continue; // <1m² → noise
            const fArea = safeArea(fPoly);
            const interHa = interArea / 10_000;
            totalOverlap += interHa;
            hits.push({
              nombre: f.properties.NOMBRE ?? "—",
              rol: f.properties.NUMERO_ROL
                ? `${f.properties.NUMERO_ROL}${f.properties.DV_ROL ? `-${f.properties.DV_ROL}` : ""}`
                : "—",
              origen: f.properties.ORIGEN ?? "EXPLOTA_1983",
              titular: f.properties.TITULAR_DIVISION ?? "—",
              overlapHa: interHa,
              pctOfHit: fArea > 0 ? (interArea / fArea) * 100 : 0,
            });
          }
          hits.sort((a, b) => b.overlapHa - a.overlapHa);
          result.push({
            concession: c,
            concessionAreaHa: cAreaHa,
            overlapHa: totalOverlap,
            pctOfConcession: cAreaHa > 0 ? (totalOverlap / cAreaHa) * 100 : 0,
            hits,
          });
        }
        result.sort((a, b) => b.pctOfConcession - a.pctOfConcession);
        setRows(result);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setComputing(false);
      }
    }, 50);
  };

  const totals = useMemo(() => {
    if (!rows) return null;
    const totalArea = rows.reduce((s, r) => s + r.concessionAreaHa, 0);
    const totalOverlap = rows.reduce((s, r) => s + r.overlapHa, 0);
    const conflicting = rows.filter((r) => r.overlapHa > 0).length;
    return {
      totalArea,
      totalOverlap,
      conflicting,
      pct: totalArea > 0 ? (totalOverlap / totalArea) * 100 : 0,
    };
  }, [rows]);

  return (
    <div className="border border-border rounded overflow-hidden bg-bg-secondary/30">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className="font-mono uppercase tracking-wider text-text-secondary">Análisis de superposición</span>
          <span className="text-text-dim font-mono">
            {eligibleProject.length} concesiones · {catastroFeatures.length} pertenencias en vista
          </span>
        </div>
        <button
          onClick={compute}
          disabled={computing || eligibleProject.length === 0 || catastroFeatures.length === 0}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs hover:opacity-90 disabled:opacity-50"
        >
          {computing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Calcular
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-destructive border-b border-border flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {!rows && !computing && (
        <div className="p-6 text-center text-text-secondary text-xs">
          {eligibleProject.length === 0
            ? "Tus concesiones no tienen geometría cargada — no se puede calcular superposición."
            : catastroFeatures.length === 0
            ? "Carga primero el catastro SERNAGEOMIN en el mapa (botón “Cargar”)."
            : "Pulsa “Calcular” para cuantificar las hectáreas superpuestas."}
        </div>
      )}

      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border-b border-border">
          <Stat label="Concesiones" value={String(rows?.length ?? 0)} />
          <Stat label="Con conflicto" value={String(totals.conflicting)} color={totals.conflicting > 0 ? "#dc2626" : undefined} />
          <Stat label="Ha superpuestas" value={totals.totalOverlap.toFixed(1)} color={totals.totalOverlap > 0 ? "#ea580c" : undefined} />
          <Stat label="% del área propia" value={`${totals.pct.toFixed(1)}%`} color={totals.pct > 5 ? "#dc2626" : undefined} />
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="divide-y divide-border max-h-[420px] overflow-auto">
          {rows.map((r) => {
            const danger = r.pctOfConcession > 5;
            return (
              <details key={r.concession.id} className="group" open={danger}>
                <summary className="cursor-pointer list-none px-3 py-2 hover:bg-accent/30 flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background:
                        r.overlapHa === 0 ? "#0d9488" : danger ? "#dc2626" : "#f59e0b",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-mono">
                      <span className="font-semibold">{r.concession.code}</span>
                      <span className="text-text-secondary"> — {r.concession.name}</span>
                    </div>
                    <div className="text-[11px] text-text-dim">
                      {r.concessionAreaHa.toFixed(1)} ha propias · {r.hits.length} pertenencias intersectan
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-semibold" style={{ color: danger ? "#dc2626" : r.overlapHa > 0 ? "#ea580c" : "#0d9488" }}>
                      {r.overlapHa.toFixed(1)} ha
                    </div>
                    <div className="text-[11px] text-text-dim">{r.pctOfConcession.toFixed(1)}% propio</div>
                  </div>
                </summary>
                {r.hits.length > 0 && (
                  <div className="px-3 pb-3">
                    <table className="w-full text-[11px]">
                      <thead className="text-text-dim border-b border-border">
                        <tr className="text-left">
                          <th className="py-1 font-medium">Pertenencia</th>
                          <th className="py-1 font-medium">ROL</th>
                          <th className="py-1 font-medium">Tipo</th>
                          <th className="py-1 font-medium">Titular</th>
                          <th className="py-1 font-medium text-right">Ha</th>
                          <th className="py-1 font-medium text-right">% suya</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.hits.map((h, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="py-1">{h.nombre}</td>
                            <td className="py-1 font-mono">{h.rol}</td>
                            <td className="py-1">
                              <span
                                className="inline-block px-1.5 py-0.5 rounded text-[10px] border"
                                style={{
                                  borderColor: CATASTRO_STYLE[h.origen].color,
                                  color: CATASTRO_STYLE[h.origen].color,
                                }}
                              >
                                {CATASTRO_STYLE[h.origen].label}
                              </span>
                            </td>
                            <td className="py-1 truncate max-w-[180px]">{h.titular}</td>
                            <td className="py-1 text-right font-mono">{h.overlapHa.toFixed(2)}</td>
                            <td className="py-1 text-right font-mono">{h.pctOfHit.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-border rounded p-2 bg-bg-elevated/50">
      <div className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className="text-base font-semibold font-mono" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

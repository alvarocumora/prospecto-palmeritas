// Análisis satelital base del área solicitada (Sentinel-2 L2A). MEDIDO: escena,
// fecha, nubosidad, índices. INTERPRETADO: anomalía relativa (> media + 1σ).
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Satellite } from "lucide-react";
import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import type { PedimentoResult } from "@/lib/pedimentoGeometry";
import { analyzeAoiSpectral, type AoiSpectralResult } from "@/lib/cadastre/designer.functions";

const HEAT = "wb-heat";

export function SpectralPanel({ map, ped }: { map: MLMap | null; ped: PedimentoResult | null }) {
  const run = useServerFn(analyzeAoiSpectral);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AoiSpectralResult | null>(null);
  const [show, setShow] = useState(true);
  const key = ped ? JSON.stringify(ped.cornersUtm) : "";
  useEffect(() => setRes(null), [key]);

  useEffect(() => {
    if (!map) return;
    if (!map.getSource(HEAT)) {
      map.addSource(HEAT, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: HEAT, type: "fill", source: HEAT,
        paint: {
          "fill-color": ["interpolate", ["linear"], ["get", "z"], 0, "#fde68a", 1, "#f97316", 2, "#b91c1c"],
          "fill-opacity": ["case", [">", ["get", "z"], 0.5], 0.55, 0],
        },
      }, map.getLayer("wb-pedimento-line") ? "wb-pedimento-line" : undefined);
    }
    (map.getSource(HEAT) as GeoJSONSource).setData(res?.ok && show ? res.heat : { type: "FeatureCollection", features: [] });
  }, [map, res, show]);
  useEffect(() => () => { (map?.getSource(HEAT) as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: [] }); }, [map]);

  if (!ped) return null;
  const analyze = async () => {
    const c = ped.rectangleWgs84.geometry.coordinates[0];
    const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
    setBusy(true);
    try {
      setRes(await run({ data: { bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] } }));
    } catch { setRes({ ok: false, error: "No se pudo ejecutar el análisis." }); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded border border-border p-2 space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Análisis satelital base</div>
      <button type="button" onClick={analyze} disabled={busy || ped.areaHa > 5000}
        className="w-full flex items-center justify-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Satellite className="w-3.5 h-3.5" />}
        {busy ? "Procesando escena (hasta ~40 s)…" : "Analizar área solicitada"}
      </button>
      {res && !res.ok && <div className="text-xs text-destructive">{res.error}</div>}
      {res?.ok && (
        <div className="space-y-1.5 text-xs">
          <div className="text-[10px] text-muted-foreground">
            <span className="font-mono">MEDIDO</span> · {res.scene.source} · {res.scene.datetime.slice(0, 10)} · nubes {res.scene.cloudPct?.toFixed(1) ?? "s/d"} % · {res.validPixels.toLocaleString("es-CL")} píxeles de 20 m
          </div>
          <table className="w-full text-[11px]">
            <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Índice</th><th className="text-right font-normal">Media</th><th className="text-right font-normal">P90</th><th className="text-right font-normal">% anómalo</th></tr></thead>
            <tbody>
              {res.indices.map((i) => (
                <tr key={i.key}><td>{i.label}</td><td className="text-right tabular-nums">{i.mean}</td><td className="text-right tabular-nums">{i.p90}</td><td className="text-right tabular-nums">{i.key === "ndvi" ? "—" : `${i.anomalyPct} %`}</td></tr>
              ))}
            </tbody>
          </table>
          <label className="flex items-center gap-1.5 text-[11px]"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />Mostrar mapa de calor de óxidos</label>
          <p className="text-[10px] text-muted-foreground">
            <span className="font-mono">INTERPRETADO</span> · «% anómalo» = píxeles sobre la media + 1σ dentro del propio polígono (anomalía relativa local). No indica ley, tonelaje ni recurso; sirve para priorizar muestreo. Pendiente/DEM no incluido en este análisis.
          </p>
        </div>
      )}
    </div>
  );
}

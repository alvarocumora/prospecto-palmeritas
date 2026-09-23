import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Satellite } from "lucide-react";
import { getCholquiScenes } from "@/lib/cholquiSatellite.functions";
import { CHOLQUI, CHOLQUI_POINTS, CHOLQUI_ASSAYS } from "../data/cholqui";

/**
 * Cobertura satelital real (Sentinel-2 L2A, Planetary Computer) sobre el AOI
 * de Cholqui + cruce con la evidencia de terreno documentada.
 *
 * No se muestran "anomalías espectrales" calculadas: la plataforma sólo
 * expone escenas reales y la alteración descrita en el prospecto, cada una
 * con su etiqueta de procedencia.
 */

type AlterationKind = "Óxidos de Cu" | "Argílica / sericítica" | "Carbonatos" | "Cuarzo / vetas";

function classify(name: string): AlterationKind {
  const n = name.toLowerCase();
  if (n.includes("argíl") || n.includes("sericit")) return "Argílica / sericítica";
  if (n.includes("carbonat") || n.includes("caliza")) return "Carbonatos";
  if (n.includes("cuarz")) return "Cuarzo / vetas";
  return "Óxidos de Cu";
}

const KIND_ORDER: AlterationKind[] = [
  "Óxidos de Cu",
  "Argílica / sericítica",
  "Carbonatos",
  "Cuarzo / vetas",
];

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function CholquiSatellitePanel() {
  const fn = useServerFn(getCholquiScenes);
  const [maxCloud, setMaxCloud] = useState(25);
  const { data, isLoading } = useQuery({
    queryKey: ["cholqui-scenes", maxCloud],
    queryFn: () => fn({ data: { monthsBack: 12, maxCloud } }),
    staleTime: 10 * 60_000,
  });

  const [sceneIdx, setSceneIdx] = useState(0);
  const scene = data?.scenes?.[sceneIdx] ?? null;

  const assayByPoint = useMemo(() => {
    const m = new Map<string, (typeof CHOLQUI_ASSAYS)[number]>();
    for (const a of CHOLQUI_ASSAYS) m.set(a.sample.replace(/[-\s]/g, "").toUpperCase(), a);
    return m;
  }, []);

  const rows = useMemo(
    () =>
      CHOLQUI_POINTS.map((p) => {
        const key = p.code.replace(/[-\s]/g, "").toUpperCase();
        return {
          ...p,
          kind: classify(p.name),
          assay: assayByPoint.get(key) ?? null,
          distKm: distanceKm(CHOLQUI.center.lat, CHOLQUI.center.lng, p.lat, p.lng),
        };
      }).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)),
    [assayByPoint],
  );

  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <header className="px-6 py-5 border-b border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand flex items-center gap-2">
          <Satellite className="w-3.5 h-3.5" />
          Observación satelital · cobertura verificable
        </div>
        <h2 className="font-display text-2xl mt-1 text-content">Sentinel-2 sobre el AOI Cholqui</h2>
        <p className="text-sm text-content-subtle mt-1 max-w-3xl">
          Escenas reales del catálogo público Sentinel-2 L2A (Microsoft Planetary Computer) sobre el
          bounding box de las pertenencias. La plataforma no publica índices espectrales
          interpretados: la alteración listada abajo proviene del mapeo de terreno del prospecto.
        </p>
      </header>

      <div className="px-6 py-4 flex flex-wrap items-center gap-3 border-b border-hairline bg-surface-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
          Nubosidad máxima
        </span>
        {[10, 25, 60].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setMaxCloud(c);
              setSceneIdx(0);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-colors ${
              c === maxCloud
                ? "bg-accent-brand text-accent-brand-contrast border-transparent"
                : "border-hairline text-content-muted hover:border-accent-brand"
            }`}
          >
            &lt; {c}%
          </button>
        ))}
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-content-subtle" />}
      </div>

      {!isLoading && (!data?.ok || (data?.scenes.length ?? 0) === 0) && (
        <div className="px-6 py-8 text-sm text-content-subtle">
          Sin escenas disponibles para el AOI con estos filtros
          {data?.error ? ` (${data.error})` : ""}. No se generan capas sintéticas.
        </div>
      )}

      {scene && (
        <div className="grid md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-6 border-b md:border-b-0 md:border-r border-hairline">
            {scene.previewUrl ? (
              <img
                src={scene.previewUrl}
                alt={`Escena Sentinel-2 ${scene.id} sobre el Proyecto Cholqui`}
                loading="lazy"
                className="w-full rounded-xl border border-hairline bg-surface-2"
              />
            ) : (
              <div className="text-sm text-content-subtle">Escena sin preview público.</div>
            )}
            <div className="mt-3 text-[11px] text-content-subtle">
              Composición RGB de referencia del proveedor. Procedencia:{" "}
              <span className="text-content">Certificado (catálogo Sentinel-2 L2A)</span>.
            </div>
          </div>

          <div className="p-4 max-h-[420px] overflow-auto">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-2">
              Escenas disponibles ({data?.scenes.length})
            </div>
            <ul className="space-y-1">
              {data?.scenes.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSceneIdx(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                      i === sceneIdx
                        ? "border-accent-brand bg-surface-2"
                        : "border-hairline hover:border-accent-brand"
                    }`}
                  >
                    <div className="font-mono text-content">{s.datetime.slice(0, 10)}</div>
                    <div className="text-content-subtle">
                      Nubes {s.cloudPct != null ? `${s.cloudPct.toFixed(1)}%` : "s/d"} ·{" "}
                      {s.platform ?? "sentinel-2"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="px-6 py-6 border-t border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          Cruce con evidencia de terreno · alteración mapeada en el prospecto
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-content-subtle border-b border-hairline">
                <th className="py-2 pr-3 font-mono font-normal">Punto</th>
                <th className="py-2 pr-3 font-mono font-normal">Alteración / estilo</th>
                <th className="py-2 pr-3 font-mono font-normal">Descripción</th>
                <th className="py-2 pr-3 font-mono font-normal text-right">Cu total</th>
                <th className="py-2 pr-3 font-mono font-normal text-right">Dist. centro</th>
                <th className="py-2 font-mono font-normal">Procedencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-hairline/60 align-top">
                  <td className="py-2 pr-3 font-mono text-content">{r.code}</td>
                  <td className="py-2 pr-3 text-content">{r.kind}</td>
                  <td className="py-2 pr-3 text-content-subtle max-w-[320px]">{r.name}</td>
                  <td className="py-2 pr-3 text-right font-mono text-content">
                    {r.assay ? `${r.assay.cuTotalPct.toFixed(3)} %` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-content-subtle">
                    {r.distKm.toFixed(1)} km
                  </td>
                  <td className="py-2 text-content-subtle">
                    {r.assay
                      ? `Análisis firmado (${r.assay.lab} · ${r.assay.reportId})`
                      : "Declarado (mapeo de terreno)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] text-content-subtle">
          Detección satelital y mapeo de superficie no constituyen recursos ni reservas. No existe
          estimación bajo CH 20235 / NI 43-101 / JORC para este proyecto.
        </p>
      </div>
    </section>
  );
}

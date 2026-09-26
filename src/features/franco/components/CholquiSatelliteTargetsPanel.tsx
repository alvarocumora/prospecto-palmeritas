/**
 * Anomalías satelitales de Cholqui y malla de sondajes propuesta.
 *
 * Las anomalías son DERIVADAS (razones de banda Sentinel-2) y la malla es
 * CONCEPTUAL: ninguna de las dos es mineralización, recurso ni programa
 * comprometido. Cada bloque lleva su etiqueta de procedencia a la vista.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crosshair, Loader2, Satellite } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { ProjectDocsMenu } from "@/components/documents/ProjectDocsMenu";
import { getCholquiSatelliteTargets } from "@/lib/cholqui/satelliteTargets.functions";
import { indexLabel } from "@/lib/cholqui/drillGrid";
import { buildCholquiTargetsDoc } from "@/lib/pdf/adapters/cholquiTargets";
import { CHOLQUI, CHOLQUI_POINTS, LAS_MINITAS } from "../data/cholqui";

const INDEX_COLOR: Record<string, string> = {
  IRON_OXIDE: "#c0703a",
  CLAY_MINERALS: "#b98a2f",
  HYDROTHERMAL_ALTERATION: "#a4262c",
  STRUCTURAL_LINEAMENTS: "#14506b",
  HISTORICAL_CHANGE: "#48586a",
  NDVI: "#2e7d46",
};

function colorFor(code: string): string {
  return INDEX_COLOR[code] ?? "#48586a";
}

function num(value: number, digits = 0): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function CholquiSatelliteTargetsPanel() {
  const fn = useServerFn(getCholquiSatelliteTargets);
  const { data, isLoading, error } = useQuery({
    queryKey: ["cholqui-satellite-targets"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [showCollars, setShowCollars] = useState(true);
  const layersRef = useRef<{ anomalies?: L.LayerGroup; collars?: L.LayerGroup }>({});

  useEffect(() => {
    if (!data || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true }).setView(
        [CHOLQUI.center.lat, CHOLQUI.center.lng],
        13,
      );
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Imagery © Esri · Sentinel-2 L2A", maxZoom: 19 },
      ).addTo(map);

      const anomalyGroup = L.layerGroup();
      data.anomalies.forEach((a, i) => {
        const code = `A-${String(i + 1).padStart(2, "0")}`;
        const color = colorFor(a.indexCode);
        if (a.ring.length > 2) {
          L.polygon(
            a.ring.map(([lng, lat]) => [lat, lng] as [number, number]),
            { color, weight: 1.5, fillColor: color, fillOpacity: 0.22 },
          )
            .bindPopup(
              `<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.5">
                <strong>${code} · ${indexLabel(a.indexCode)}</strong><br/>
                Puntaje <b>${a.score != null ? a.score.toFixed(2) : "s/d"}</b> · severidad ${a.severity}<br/>
                ${a.zScore != null ? `z-score ${a.zScore.toFixed(2)}<br/>` : ""}
                Tenencia: <b>${a.withinTenure ? "dentro de concesión conocida" : "fuera — requiere verificar tenencia"}</b><br/>
                <span style="opacity:.65">${a.provenance}</span>
              </div>`,
            )
            .addTo(anomalyGroup);
        }
      });

      const collarGroup = L.layerGroup();
      for (const c of data.collars) {
        L.circleMarker([c.lat, c.lng], {
          radius: 7,
          color: "#0d2b3e",
          weight: 3,
          fillColor: "#d4af37",
          fillOpacity: 0.95,
        })
          .bindPopup(
            `<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.5">
              <strong>${c.code} · SONDAJE PROPUESTO</strong><br/>
              Azimut ${c.azimuthDeg}° · inclinación ${c.dipDeg}° · ${num(c.depthM)} m<br/>
              Prioridad ${c.priority}<br/>
              ${c.objective}<br/>
              <span style="opacity:.65">Propuesta conceptual — sujeta a topografía y permisos</span>
            </div>`,
          )
          .addTo(collarGroup);
      }

      for (const p of CHOLQUI_POINTS) {
        L.circleMarker([p.lat, p.lng], {
          radius: 4,
          color: "#2563eb",
          weight: 1.5,
          fillColor: "#2563eb",
          fillOpacity: 0.7,
        })
          .bindPopup(`<b>${p.code}</b><br/>${p.name}`)
          .addTo(map);
      }
      L.circleMarker([LAS_MINITAS.lat, LAS_MINITAS.lng], {
        radius: 8,
        color: "#c0703a",
        weight: 3,
        fillColor: "#c0703a",
        fillOpacity: 0.35,
      })
        .bindPopup(`<b>${LAS_MINITAS.name}</b><br/><small>Faena de tercero · contexto</small>`)
        .addTo(map);

      anomalyGroup.addTo(map);
      collarGroup.addTo(map);
      layersRef.current = { anomalies: anomalyGroup, collars: collarGroup };

      const all = [
        ...data.anomalies.map((a) => [a.lat, a.lng] as [number, number]),
        ...data.collars.map((c) => [c.lat, c.lng] as [number, number]),
      ];
      if (all.length) map.fitBounds(L.latLngBounds(all).pad(0.25));
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = {};
    };
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layersRef.current.anomalies;
    if (!map || !layer) return;
    if (showAnomalies) layer.addTo(map);
    else layer.removeFrom(map);
  }, [showAnomalies]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layersRef.current.collars;
    if (!map || !layer) return;
    if (showCollars) layer.addTo(map);
    else layer.removeFrom(map);
  }, [showCollars]);

  const legend = useMemo(() => {
    if (!data) return [];
    return data.summary.indexes.map((i) => ({
      code: i.code,
      label: indexLabel(i.code),
      count: i.count,
      color: colorFor(i.code),
    }));
  }, [data]);

  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <header className="px-6 py-5 border-b border-hairline flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand flex items-center gap-2">
            <Satellite className="w-3.5 h-3.5" />
            Análisis satelital · anomalías y targets
          </div>
          <h2 className="font-display text-2xl mt-1 text-content">
            Anomalías espectrales y malla de sondajes propuesta
          </h2>
          <p className="text-sm text-content-subtle mt-1 max-w-3xl">
            Anomalías derivadas de razones de banda Sentinel-2 sobre el AOI de Cholqui y la malla de
            sondajes que se desprende de ellas. Una anomalía es un indicio de alteración, no
            mineralización; la malla es una propuesta de exploración, no un programa comprometido.
          </p>
        </div>
        <ProjectDocsMenu
          className="h-10 shrink-0"
          variant="outline"
          label="Descargar informe de targets"
          disabled={!data}
          build={() => (data ? buildCholquiTargetsDoc(data) : null)}
        />
      </header>

      {isLoading && (
        <div className="px-6 py-10 flex items-center gap-2 text-sm text-content-subtle">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando la corrida satelital…
        </div>
      )}

      {error && (
        <div className="px-6 py-10 text-sm text-content-subtle">
          No se pudo leer la corrida satelital del proyecto. No se generan capas sintéticas.
        </div>
      )}

      {data && data.anomalies.length === 0 && (
        <div className="px-6 py-10 text-sm text-content-subtle">
          No hay anomalías almacenadas para el AOI de Cholqui.
        </div>
      )}

      {data && data.anomalies.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-b border-hairline bg-surface-2">
            {[
              [
                "Anomalías",
                `${data.summary.anomalies} · ${data.summary.withinTenure} en tenencia`,
              ],
              [
                "Superficie interpretable",
                data.coverage.typicalPct != null
                  ? `${num(data.coverage.typicalPct, 1)} % (mejor caso ${data.coverage.bestCasePct != null ? num(data.coverage.bestCasePct, 1) : "s/d"} %)`
                  : "s/d",
              ],
              ["Plataformas propuestas", String(data.summary.collars)],
              ["Metraje propuesto", `${num(data.summary.totalMeters)} m`],
            ].map(([k, v]) => (
              <div key={k} className="px-5 py-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                  {k}
                </div>
                <div className="mt-1 text-sm font-medium text-content">{v}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="p-4 border-b lg:border-b-0 lg:border-r border-hairline space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-[.18em] text-content-subtle">
                Capas
              </div>
              <button
                type="button"
                onClick={() => setShowAnomalies((v) => !v)}
                className="w-full flex items-center gap-2 rounded border border-hairline px-2.5 py-2 text-left hover:bg-surface-2"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-sm ${showAnomalies ? "bg-accent-brand" : "bg-hairline"}`}
                />
                <span className="flex-1 text-xs">Anomalías satelitales</span>
                <span className="text-[8px] font-mono text-content-subtle">DERIVADO</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCollars((v) => !v)}
                className="w-full flex items-center gap-2 rounded border border-hairline px-2.5 py-2 text-left hover:bg-surface-2"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-sm ${showCollars ? "bg-accent-brand" : "bg-hairline"}`}
                />
                <span className="flex-1 text-xs">Sondajes propuestos</span>
                <span className="text-[8px] font-mono text-content-subtle">CONCEPTUAL</span>
              </button>

              <div className="pt-2 text-[10px] font-mono uppercase tracking-[.18em] text-content-subtle">
                Índices
              </div>
              <ul className="space-y-1.5">
                {legend.map((l) => (
                  <li key={l.code} className="flex items-start gap-2 text-[11px] text-content">
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="flex-1 leading-snug">{l.label}</span>
                    <span className="font-mono text-content-subtle">{l.count}</span>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="relative min-h-[520px]">
              <div
                ref={containerRef}
                data-report-map="cholqui-targets"
                className="absolute inset-0 bg-surface-2"
              />
            </div>
          </div>

          <div className="px-6 py-6 border-t border-hairline">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3 flex items-center gap-2">
              <Crosshair className="w-3.5 h-3.5" /> Malla de sondajes propuesta · fase 1
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-content-subtle border-b border-hairline">
                    <th className="py-2 pr-3 font-mono font-normal">Sondaje</th>
                    <th className="py-2 pr-3 font-mono font-normal">Collar (lat, lon)</th>
                    <th className="py-2 pr-3 font-mono font-normal text-right">Azimut</th>
                    <th className="py-2 pr-3 font-mono font-normal text-right">Incl.</th>
                    <th className="py-2 pr-3 font-mono font-normal text-right">Prof.</th>
                    <th className="py-2 pr-3 font-mono font-normal">Prioridad</th>
                    <th className="py-2 font-mono font-normal">Objetivo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.collars.map((c) => (
                    <tr key={c.code} className="border-b border-hairline/60 align-top">
                      <td className="py-2 pr-3 font-mono text-content">{c.code}</td>
                      <td className="py-2 pr-3 font-mono text-content-subtle">
                        {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-content">
                        {c.azimuthDeg}°
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-content">{c.dipDeg}°</td>
                      <td className="py-2 pr-3 text-right font-mono text-content">
                        {num(c.depthM)} m
                      </td>
                      <td className="py-2 pr-3 text-content">{c.priority}</td>
                      <td className="py-2 text-content-subtle max-w-[320px]">{c.objective}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[11px] text-content-subtle">
              Coordenadas de collar preliminares: requieren topografía, acceso, servidumbres y
              permisos antes de ejecutarse. La detección satelital y la malla propuesta no
              constituyen recursos ni reservas bajo CH 20235 / NI 43-101 / JORC.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

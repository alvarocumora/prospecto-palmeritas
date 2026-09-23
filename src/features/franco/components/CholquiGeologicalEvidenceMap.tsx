import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layers3, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Layer, LayerGroup } from "leaflet";
import francoPertenenciasRaw from "@/data/geo/franco_pertenencias.geojson?raw";
import { buildSatelliteLayers } from "@/components/map/satelliteLayers";
import { buildSernageominLayers } from "@/components/map/sernageominLayers";
import { getCholquiRemoteCandidates } from "@/lib/cholquiRemoteSensing.functions";
import { candidateStyle, CHOLQUI_REMOTE_DISCLAIMER } from "../data/remoteSensing";
import { Card } from "@/features/palmeras/components/primitives/Card";
import { SectionTitle } from "@/features/palmeras/components/primitives/SectionTitle";
import {
  CHOLQUI,
  CHOLQUI_ASSAYS,
  CHOLQUI_POINTS,
  LAS_MINITAS,
  type CholquiAssay,
} from "../data/cholqui";

type LayerKey = "tenure" | "field" | "assays" | "neighbor" | "geology" | "mines" | "worldCover" | "dem" | "remoteCandidates";
type EvidenceState = "verified" | "observed" | "context";

const LAYERS: Array<{ key: LayerKey; label: string; state: EvidenceState; defaultOn: boolean }> = [
  { key: "tenure", label: "Pertenencias", state: "verified", defaultOn: true },
  { key: "field", label: "Puntos de terreno", state: "observed", defaultOn: true },
  { key: "assays", label: "Ensayes certificados", state: "verified", defaultOn: true },
  { key: "neighbor", label: "Faena vecina", state: "context", defaultOn: true },
  { key: "geology", label: "Geología SERNAGEOMIN", state: "verified", defaultOn: false },
  { key: "mines", label: "Faenas SERNAGEOMIN", state: "verified", defaultOn: false },
  { key: "worldCover", label: "ESA WorldCover", state: "context", defaultOn: false },
  { key: "dem", label: "DEM / hillshade", state: "context", defaultOn: false },
  { key: "remoteCandidates", label: "Candidatos Sentinel-2", state: "context", defaultOn: false },
];

const STATE_LABEL: Record<EvidenceState, string> = {
  verified: "VERIFICADO",
  observed: "OBSERVADO",
  context: "CONTEXTO",
};

const FC_DATA = JSON.parse(francoPertenenciasRaw) as GeoJSON.FeatureCollection;

function assayKey(s: string) {
  return s.replace(/[-\s]/g, "").toUpperCase();
}

function assayPopup(a: CholquiAssay) {
  return `<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.5">
    <strong>${a.sample} · ENSAYE CERTIFICADO</strong><br/>
    Cu total <b>${a.cuTotalPct.toFixed(3)}%</b> · Cu soluble <b>${a.cuSolublePct.toFixed(3)}%</b><br/>
    Au ${a.auGpt.toFixed(2)} g/t · Ag ${a.agPpm.toFixed(0)} ppm<br/>
    <span style="opacity:.65">${a.lab} · informe ${a.reportId} · ${a.reportDate}</span>
  </div>`;
}

/**
 * Mapa maestro de evidencia de Cholqui.
 * Une fuentes verificables y observaciones documentadas sin convertir
 * contexto geoespacial en inferencias de mineralización.
 */
export function CholquiGeologicalEvidenceMap() {
  const remoteFn = useServerFn(getCholquiRemoteCandidates);
  const remote = useQuery({
    queryKey: ["cholqui-remote-candidates"],
    queryFn: () => remoteFn({ data: {} }),
    staleTime: 30 * 60_000,
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<Partial<Record<LayerKey, Layer | LayerGroup>>>({});
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<Record<LayerKey, boolean>>(() =>
    Object.fromEntries(LAYERS.map((l) => [l.key, l.defaultOn])) as Record<LayerKey, boolean>,
  );

  const assayByPoint = useMemo(
    () => new Map(CHOLQUI_ASSAYS.map((a) => [assayKey(a.sample), a])),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current || mapRef.current) return;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(
        [CHOLQUI.center.lat, CHOLQUI.center.lng],
        13,
      );
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Imagery © Esri", maxZoom: 19 },
      ).addTo(map);

      const tenure = L.geoJSON(FC_DATA as never, {
        style: { color: "#d4af37", weight: 2, fillColor: "#d4af37", fillOpacity: 0.08 },
        onEachFeature: (f, layer) => {
          const name = String((f.properties as Record<string, unknown> | null)?.name ?? "Pertenencia");
          layer.bindPopup(`<b>${name}</b><br/><small>Pertenencia del proyecto · geometría documental</small>`);
        },
      });

      const field = L.layerGroup();
      const assays = L.layerGroup();
      for (const p of CHOLQUI_POINTS) {
        const a = assayByPoint.get(assayKey(p.code));
        const target = a ? assays : field;
        L.circleMarker([p.lat, p.lng], {
          radius: a ? 7 : 5,
          color: a ? "#d4af37" : "#2563eb",
          weight: 2,
          fillColor: a ? "#d4af37" : "#2563eb",
          fillOpacity: a ? 0.95 : 0.72,
        })
          .bindPopup(
            a
              ? assayPopup(a)
              : `<div style="font-family:ui-monospace,monospace;font-size:11px"><b>${p.code}</b><br/>${p.name}<br/><span style="opacity:.65">Observación de terreno documentada · sin ensaye asociado</span></div>`,
          )
          .addTo(target);
      }

      const neighbor = L.layerGroup();
      L.circleMarker([LAS_MINITAS.lat, LAS_MINITAS.lng], {
        radius: 9,
        color: "#c0703a",
        weight: 3,
        fillColor: "#c0703a",
        fillOpacity: 0.35,
      })
        .bindPopup(
          `<b>${LAS_MINITAS.name}</b><br/>${LAS_MINITAS.holder}<br/><small>Faena de tercero · contexto regional, no producción del proyecto.</small>`,
        )
        .addTo(neighbor);

      const sngm = buildSernageominLayers(L);
      const satellite = buildSatelliteLayers(L);
      layersRef.current = {
        tenure,
        field,
        assays,
        neighbor,
        geology: sngm.geologia1M,
        mines: sngm.yacimientos,
        worldCover: satellite.worldCover,
        dem: satellite.copernicusDem,
        remoteCandidates: L.layerGroup(),
      };

      if (remote.data?.ok && remote.data.data) {
        const group = layersRef.current.remoteCandidates as LayerGroup;
        for (const feature of remote.data.data.features) {
          const [lng, lat] = feature.geometry.coordinates;
          const p = feature.properties;
          const s = candidateStyle(p.aloh_zscore);
          const marker = L.circleMarker([lat, lng], {
            radius: s.radius,
            color: s.color,
            weight: 2,
            fillColor: s.color,
            fillOpacity: 0.32,
          }).bindPopup(
            `<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.5">
              <b>Candidato #${p.rank} · DERIVADO</b><br/>
              Al-OH z-score <b>${p.aloh_zscore}</b> · percentil ${p.aloh_percentile}<br/>
              <span style="opacity:.65">${p.legend}</span>
            </div>`,
          ).addTo(group);
        }
      }

      for (const item of LAYERS) {
        if (item.defaultOn) layersRef.current[item.key]?.addTo(map);
      }
      try {
        map.fitBounds(tenure.getBounds(), { padding: [24, 24] });
      } catch {
        // AOI fallback already centered.
      }
      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = {};
    };
  }, [assayByPoint, remote.data]);

  function toggle(key: LayerKey) {
    const map = mapRef.current;
    const layer = layersRef.current[key];
    if (!map || !layer) return;
    setActive((prev) => {
      const next = !prev[key];
      if (next) layer.addTo(map);
      else layer.removeFrom(map);
      return { ...prev, [key]: next };
    });
  }

  return (
    <Card className="p-0 overflow-hidden" accent="gold">
      <div className="p-5 border-b border-border flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <SectionTitle icon={Layers3} sub="Catastro + terreno + laboratorio + geología oficial + contexto satelital">
            Geological Evidence Map
          </SectionTitle>
          <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
            Vista analítica del proyecto. Cada capa conserva su procedencia; contexto satelital o regional no se presenta
            como mineralización ni como recurso.
          </p>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          WGS84 · {CHOLQUI.location}
        </div>
      </div>

      <div className="grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="p-4 border-b lg:border-b-0 lg:border-r border-border bg-background space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-[.18em] text-muted-foreground mb-3">
            Evidence stack
          </div>
          {LAYERS.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={!ready}
              onClick={() => toggle(item.key)}
              className="w-full flex items-center gap-2 rounded border border-border px-2.5 py-2 text-left hover:bg-muted/30 disabled:opacity-50"
            >
              <span className={`h-2.5 w-2.5 rounded-sm ${active[item.key] ? "bg-gold" : "bg-muted"}`} />
              <span className="min-w-0 flex-1 text-xs">{item.label}</span>
              <span className="text-[8px] font-mono text-muted-foreground">{STATE_LABEL[item.state]}</span>
            </button>
          ))}
          <div className="pt-3 text-[10px] leading-relaxed text-muted-foreground">
{remote.data?.ok
              ? `Sentinel-2: ${remote.data.data.features.length} candidatos derivados publicados. ${CHOLQUI_REMOTE_DISCLAIMER}`
              : "Sentinel-2 derivado aún no publicado. No se generan anomalías sintéticas. El motor de convergencia permanecerá desactivado hasta disponer del GeoJSON reproducible."}
          </div>
        </aside>

        <div className="relative min-h-[580px]">
          <div ref={containerRef} data-report-map="cholqui-evidence" className="absolute inset-0 bg-bg-secondary" />
          {!ready && (
            <div className="absolute inset-0 grid place-items-center bg-background/50 pointer-events-none">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-gold" /> Cargando evidence stack…
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-border text-[10px] font-mono text-muted-foreground">
        {CHOLQUI_POINTS.length} observaciones · {CHOLQUI_ASSAYS.length} ensayes certificados · {FC_DATA.features.length} polígonos de pertenencias
      </div>
    </Card>
  );
}

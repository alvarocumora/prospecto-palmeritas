import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from "leaflet";
import { Card } from "@/features/palmeras/components/primitives/Card";
import { SectionTitle } from "@/features/palmeras/components/primitives/SectionTitle";
import francoPertenenciasRaw from "@/data/geo/franco_pertenencias.geojson?raw";
import {
  getFrancoCadastreCross,
  type FrancoPertenenciaMatch,
} from "@/lib/franco-cadastre.functions";
import { CHOLQUI_ASSAYS, CHOLQUI_POINTS, LAS_MINITAS } from "../data/cholqui";

type FCFeature = {
  type: "Feature";
  properties: { name: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};
type FC = { type: "FeatureCollection"; features: FCFeature[] };

const FC_DATA: FC = JSON.parse(francoPertenenciasRaw);

export function FrancoPertenenciasMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletGeoJSON | null>(null);

  const fn = useServerFn(getFrancoCadastreCross);
  const { data, isLoading } = useQuery({
    queryKey: ["franco-cadastre-cross"],
    queryFn: () => fn({ data: {} as never }),
    staleTime: 60_000,
  });

  // Internal reconciliation is retained only to enrich documentary polygons with cadastre attributes.
  const matchByName = useMemo(() => {
    const m = new Map<string, FrancoPertenenciaMatch>();
    if (!data) return m;
    const rank = { EXACT: 4, GEOM: 3, "NAME~": 2, NONE: 1 } as const;
    for (const r of data.rows) {
      const prev = m.get(r.kmlName);
      if (!prev || rank[r.matchKind] > rank[prev.matchKind]) m.set(r.kmlName, r);
    }
    return m;
  }, [data]);

  const assayByPoint = useMemo(
    () =>
      new Map(
        CHOLQUI_ASSAYS.map((assay) => [assay.sample.replace(/[-\s]/g, "").toUpperCase(), assay]),
      ),
    [],
  );

  // Init map once
  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current || mapRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([-33.82, -71.05], 13);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles © Esri",
          maxZoom: 19,
        },
      ).addTo(map);
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Render polygons whenever match data changes
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }
      const layer = L.geoJSON(FC_DATA as never, {
        style: () => ({
          color: "#d4af37",
          weight: 2,
          fillColor: "#d4af37",
          fillOpacity: 0.14,
          opacity: 0.9,
        }),
        onEachFeature: (feat, lyr) => {
          const name = (feat.properties as { name?: string } | undefined)?.name?.trim() ?? "(s/n)";
          const m = matchByName.get(name);
          const html =
            m && m.concessionCode
              ? `<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.35">
                 <div style="font-weight:700;color:#d4af37">${name}</div>
                 <div>Catastro: <b>${m.concessionName ?? "—"}</b></div>
                 <div>Código: ${m.concessionCode ?? "—"}</div>
                 <div>Titular: ${m.holder ?? "—"}</div>
                 <div>Área: ${m.areaHaDb?.toFixed(2) ?? "—"} ha</div>
                 <div>Estado: ${m.status ?? "—"}</div>
                 <div style="color:#8A949C;margin-top:4px">Polígono KMZ documental; el catastro es la referencia canónica.</div>
               </div>`
              : `<div style="font-family:ui-monospace,monospace;font-size:11px">
                 <div style="font-weight:700;color:#d4af37">${name}</div>
                 <div>Polígono documental KMZ</div>
                 <div style="color:#8A949C">Sin registro catastral asociado en esta consulta.</div>
               </div>`;
          lyr.bindPopup(html);
        },
      });
      layer.addTo(mapRef.current);

      // Puntos de observación / muestreo del prospecto + faena vecina.
      for (const p of CHOLQUI_POINTS) {
        const assay = assayByPoint.get(p.code.replace(/[-\s]/g, "").toUpperCase());
        const assayHtml = assay
          ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #D9D5CB">
               <div style="font-weight:700;color:#2447D6">ANÁLISIS DISPONIBLE · ${assay.lab}</div>
               <div>Cu total: <b>${assay.cuTotalPct.toLocaleString("es-CL")} %</b> · Cu soluble: <b>${assay.cuSolublePct.toLocaleString("es-CL")} %</b></div>
               <div>Au: ${assay.auGpt.toLocaleString("es-CL")} g/t · Ag: ${assay.agPpm.toLocaleString("es-CL")} g/t</div>
               <div>Informe ${assay.reportId}${assay.laboratoryCode ? ` · código ${assay.laboratoryCode}` : ""} · ${assay.reportDate}</div>
             </div>`
          : `<div style="margin-top:6px;color:#8A949C">Sin análisis químico asociado en los antecedentes disponibles</div>`;
        L.circleMarker([p.lat, p.lng], {
          radius: assay ? 7 : 5,
          color: "#2447D6",
          weight: 2,
          fillColor: assay ? "#D4AF37" : "#2447D6",
          fillOpacity: assay ? 0.95 : 0.65,
        })
          .bindPopup(
            `<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.4">
               <div style="font-weight:700">${p.code} · ${p.name}</div>
               <div>PSAD'56 19H: ${p.utmE} E / ${p.utmN} N</div>
               <div>WGS84: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>
               <div style="color:#8A949C">Observación de terreno — no es ley media</div>
               ${assayHtml}
             </div>`,
          )
          .addTo(mapRef.current);
      }
      L.circleMarker([LAS_MINITAS.lat, LAS_MINITAS.lng], {
        radius: 8,
        color: "#C0703A",
        weight: 3,
        fillColor: "#C0703A",
        fillOpacity: 0.5,
      })
        .bindPopup(
          `<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.4">
             <div style="font-weight:700;color:#C0703A">${LAS_MINITAS.name}</div>
             <div>${LAS_MINITAS.holder}</div>
             <div>~${LAS_MINITAS.throughputTMonth.toLocaleString("es-CL")} t/mes · ~${LAS_MINITAS.areaHa} ha</div>
             <div style="color:#8A949C">Faena de un tercero — no es producción del proyecto</div>
           </div>`,
        )
        .addTo(mapRef.current);
      try {
        mapRef.current.fitBounds(layer.getBounds(), { padding: [20, 20] });
      } catch {
        /* empty */
      }
      layerRef.current = layer;
    })();
    return () => {
      cancelled = true;
    };
  }, [assayByPoint, matchByName]);

  return (
    <Card className="p-6" accent="gold">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <SectionTitle
          icon={MapPin}
          sub="Catastro como referencia canónica · KMZ conservado sólo como respaldo documental"
        >
          Live map · Pertenencias Cholqui
        </SectionTitle>
        <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          <LegendDot color="#d4af37" label="Pertenencia documental" />
          <LegendDot color="#2447D6" label="Punto de terreno" />
          <LegendDot color="#d4af37" label="Muestra analizada" />
          <LegendDot color="#C0703A" label="Faena vecina" />
        </div>
      </div>
      <div className="relative">
        <div
          ref={containerRef}
          data-report-map="cholqui"
          className="w-full h-[460px] rounded border border-border overflow-hidden bg-bg-secondary"
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm pointer-events-none">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-gold">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando catastro…
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 text-[11px] font-mono uppercase tracking-wider text-hint">
        {data ? `${data.uniqueConcessions} concesiones en catastro · ${FC_DATA.features.length} polígonos KMZ documentales` : "—"}
      </div>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from "leaflet";
import type { Feature } from "geojson";
import { Card } from "@/features/palmeras/components/primitives/Card";
import { SectionTitle } from "@/features/palmeras/components/primitives/SectionTitle";
import francoPertenenciasRaw from "@/data/geo/franco_pertenencias.geojson?raw";
import {
  getFrancoCadastreCross,
  type FrancoPertenenciaMatch,
} from "@/lib/franco-cadastre.functions";

type FCFeature = {
  type: "Feature";
  properties: { name: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};
type FC = { type: "FeatureCollection"; features: FCFeature[] };

const FC_DATA: FC = JSON.parse(francoPertenenciasRaw);

function colorFor(matchKind: FrancoPertenenciaMatch["matchKind"] | undefined): {
  color: string;
  fillColor: string;
} {
  switch (matchKind) {
    case "EXACT":
      return { color: "#d4af37", fillColor: "#d4af37" }; // gold
    case "GEOM":
      return { color: "#4fa3a3", fillColor: "#4fa3a3" }; // teal
    case "NAME~":
      return { color: "#b87333", fillColor: "#b87333" }; // copper
    default:
      return { color: "#6b7280", fillColor: "#6b7280" }; // muted
  }
}

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

  // Build a name -> best match map (prefer EXACT > GEOM > NAME~ > NONE)
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
        style: (feat?: Feature) => {
          const name = (feat?.properties as { name?: string } | undefined)?.name?.trim() ?? "";
          const match = matchByName.get(name);
          const c = colorFor(match?.matchKind);
          return {
            color: c.color,
            weight: 2,
            fillColor: c.fillColor,
            fillOpacity: 0.18,
            opacity: 0.9,
          };
        },
        onEachFeature: (feat, lyr) => {
          const name = (feat.properties as { name?: string } | undefined)?.name?.trim() ?? "(s/n)";
          const m = matchByName.get(name);
          const html =
            m && m.matchKind !== "NONE"
              ? `<div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.35">
                 <div style="font-weight:700;color:#d4af37">${name}</div>
                 <div>Concesión: <b>${m.concessionName ?? "—"}</b></div>
                 <div>Código: ${m.concessionCode ?? "—"}</div>
                 <div>Titular: ${m.holder ?? "—"}</div>
                 <div>Área DB: ${m.areaHaDb?.toFixed(2) ?? "—"} ha</div>
                 <div>Overlap: ${m.overlapHa.toFixed(2)} ha (${m.pctOfKml.toFixed(1)}%)</div>
                 <div>Match: <b>${m.matchKind}</b> · ${m.status ?? ""}</div>
               </div>`
              : `<div style="font-family:ui-monospace,monospace;font-size:11px">
                 <div style="font-weight:700;color:#9ca3af">${name}</div>
                 <div>Sin match en catastro</div>
               </div>`;
          lyr.bindPopup(html);
        },
      });
      layer.addTo(mapRef.current);
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
  }, [matchByName]);

  return (
    <Card className="p-6" accent="gold">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <SectionTitle
          icon={MapPin}
          sub="Pertenencias KMZ sobre satélite · color = estado de match con catastro real"
        >
          Live map · Pertenencias Franco
        </SectionTitle>
        <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          <LegendDot color="#d4af37" label="Match exacto" />
          <LegendDot color="#4fa3a3" label="Geom" />
          <LegendDot color="#b87333" label="Nombre" />
          <LegendDot color="#6b7280" label="Sin match" />
        </div>
      </div>
      <div className="relative">
        <div
          ref={containerRef}
          className="w-full h-[460px] rounded border border-border overflow-hidden bg-bg-secondary"
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm pointer-events-none">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-gold">
              <Loader2 className="w-4 h-4 animate-spin" /> Cruzando con catastro…
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 text-[11px] font-mono uppercase tracking-wider text-hint">
        {FC_DATA.features.length} polígonos KMZ ·{" "}
        {data
          ? `${data.matchedKmlPolygons} con match · ${data.uniqueConcessions} concesiones únicas`
          : "—"}
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

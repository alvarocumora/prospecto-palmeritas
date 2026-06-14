// Fase 1 — Visor 3D Pro con anomalías magnéticas reales EMAG2 (NOAA NCEI).
// Mapa Leaflet con capa satelital ESRI + overlay raster EMAG2 + marcadores de targets.
/**
 * @deprecated Sprint 2 · Usar `<GeoScene3D mode="subsurface" variant="mag" />` desde `@/components/geoscene`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjects } from "@/hooks/useProjects";
import { detectMagTargets, listMagTargets } from "@/lib/magAnomaly.functions";
import { Loader2, Zap, Layers, Satellite, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Link } from "@tanstack/react-router";

const TILAMA_BBOX = {
  minLon: -71.25,
  minLat: -32.22,
  maxLon: -70.98,
  maxLat: -31.98,
};

const EMAG2_EXPORT =
  "https://gis.ngdc.noaa.gov/arcgis/rest/services/EMAG2v3/ImageServer/exportImage";

function emag2ImageUrl(bbox: typeof TILAMA_BBOX, w = 1024, h = 1024) {
  const params = new URLSearchParams({
    bbox: `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`,
    bboxSR: "4326",
    imageSR: "4326",
    size: `${w},${h}`,
    format: "png",
    pixelType: "F32",
    renderingRule: JSON.stringify({
      rasterFunction: "Stretch",
      rasterFunctionArguments: { StretchType: 6, Gamma: [1.0] },
    }),
    f: "image",
  });
  return `${EMAG2_EXPORT}?${params.toString()}`;
}

export function MagAnomaly3DPro() {
  const { active } = useProjects();
  const projectId = active?.id ?? null;
  const detectFn = useServerFn(detectMagTargets);
  const listFn = useServerFn(listMagTargets);
  const qc = useQueryClient();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const magLayerRef = useRef<L.ImageOverlay | null>(null);
  const targetsLayerRef = useRef<L.LayerGroup | null>(null);
  const [magOpacity, setMagOpacity] = useState(0.55);
  const [showSat, setShowSat] = useState(true);

  const { data: targetsData } = useQuery({
    queryKey: ["mag_targets", projectId],
    queryFn: () => (projectId ? listFn({ data: { projectId } }) : Promise.resolve({ targets: [] })),
    enabled: !!projectId,
  });

  const detectMut = useMutation({
    mutationFn: () =>
      detectFn({
        data: {
          projectId: projectId!,
          bbox: TILAMA_BBOX,
          gridN: 28,
          topK: 10,
          persist: true,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mag_targets", projectId] });
    },
  });

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [
        (TILAMA_BBOX.minLat + TILAMA_BBOX.maxLat) / 2,
        (TILAMA_BBOX.minLon + TILAMA_BBOX.maxLon) / 2,
      ],
      zoom: 12,
      zoomControl: true,
      preferCanvas: true,
    });

    const esri = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "ESRI World Imagery",
        maxZoom: 19,
      },
    );
    esri.addTo(map);

    const bounds: L.LatLngBoundsExpression = [
      [TILAMA_BBOX.minLat, TILAMA_BBOX.minLon],
      [TILAMA_BBOX.maxLat, TILAMA_BBOX.maxLon],
    ];
    const mag = L.imageOverlay(emag2ImageUrl(TILAMA_BBOX), bounds, {
      opacity: magOpacity,
      crossOrigin: true,
      className: "mix-blend-screen",
    }).addTo(map);
    magLayerRef.current = mag;

    targetsLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update opacity
  useEffect(() => {
    magLayerRef.current?.setOpacity(magOpacity);
  }, [magOpacity]);

  // Render targets
  useEffect(() => {
    const layer = targetsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    const targets = targetsData?.targets ?? [];
    targets.forEach((t) => {
      const intensity = Math.min(1, Math.abs(t.mag_nt) / 300);
      const color = `hsl(${50 - intensity * 50}, 90%, ${55 - intensity * 15}%)`;
      const marker = L.circleMarker([t.lat, t.lon], {
        radius: 8 + intensity * 10,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.4,
      });
      marker.bindTooltip(
        `<div style="font-family:monospace">
           <div><b>${t.name}</b> · rank ${t.rank}</div>
           <div>${t.mag_nt.toFixed(1)} nT</div>
           <div style="opacity:.6">${t.lat.toFixed(4)}, ${t.lon.toFixed(4)}</div>
         </div>`,
        { direction: "top" },
      );
      marker.addTo(layer);
    });
  }, [targetsData]);

  const stats = useMemo(() => {
    const t = targetsData?.targets ?? [];
    if (t.length === 0) return null;
    const vals = t.map((x) => Math.abs(x.mag_nt));
    return {
      count: t.length,
      max: Math.max(...vals),
      min: Math.min(...vals),
    };
  }, [targetsData]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-[400] w-72 space-y-3 rounded-lg border border-gold/30 bg-background/90 p-4 font-mono text-xs backdrop-blur">
        <div className="flex items-center gap-2 text-gold">
          <Activity className="h-4 w-4" />
          <span className="font-bold">3D PRO · EMAG2 v3 (NOAA)</span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Layers className="h-3 w-3" /> Magnetismo
            </span>
            <span className="text-gold">{(magOpacity * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[magOpacity * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => setMagOpacity(v[0] / 100)}
          />
        </div>

        <Button
          size="sm"
          variant="outline"
          className="w-full border-gold/40 text-gold hover:bg-gold/10"
          disabled={!projectId || detectMut.isPending}
          onClick={() => detectMut.mutate()}
        >
          {detectMut.isPending ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <Zap className="mr-2 h-3 w-3" />
          )}
          Detectar anomalías
        </Button>

        {detectMut.data?.stats && (
          <div className="rounded border border-border/50 p-2 text-[10px] text-muted-foreground">
            <div>n={detectMut.data.stats.count} muestras</div>
            <div>
              μ={detectMut.data.stats.mean.toFixed(1)} σ=
              {detectMut.data.stats.std.toFixed(1)} nT
            </div>
            <div>
              rango [{detectMut.data.stats.min.toFixed(0)}, {detectMut.data.stats.max.toFixed(0)}]
              nT
            </div>
            <div className="text-gold">{detectMut.data.persisted} targets guardados</div>
          </div>
        )}

        {stats && (
          <div className="rounded border border-gold/30 bg-gold/5 p-2 text-[10px]">
            <div className="text-gold">
              {stats.count} targets · max {stats.max.toFixed(0)} nT
            </div>
          </div>
        )}

        <div className="border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Satellite className="h-3 w-3" />
            <span>ESRI World Imagery + EMAG2v3 NOAA NCEI</span>
          </div>
          <Link to="/dashboard/geology3d" className="mt-1 inline-block text-gold hover:underline">
            → Ver modelo 3D estructural
          </Link>
        </div>
      </div>

      {!projectId && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/80 font-mono text-sm text-muted-foreground">
          Selecciona un proyecto activo
        </div>
      )}
    </div>
  );
}

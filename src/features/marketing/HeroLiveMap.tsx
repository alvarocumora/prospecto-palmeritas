import { useEffect, useRef } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Satellite, Radar, Activity, ArrowRight } from "lucide-react";
import { getLandingMapData } from "@/lib/landingMap.functions";
import { useLocale } from "@/features/marketing/i18n";

const STYLE: any = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

const FALLBACK_CENTER: [number, number] = [-70.4, -29.5];
const FALLBACK_ZOOM = 4.4;

export function HeroLiveMap() {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const styleReadyRef = useRef(false);

  const fetchMap = useServerFn(getLandingMapData);
  const { data } = useQuery({
    queryKey: ["landing-map"],
    queryFn: () => fetchMap(),
    staleTime: 5 * 60_000,
  });

  // init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      interactive: true,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false, showCompass: false }), "top-right");
    map.on("load", () => {
      styleReadyRef.current = true;
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
  }, []);

  // data → sources
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;

    const apply = () => {
      const ensure = (id: string, fc: any) => {
        const src = map.getSource(id) as any;
        if (src) src.setData(fc);
        else map.addSource(id, { type: "geojson", data: fc });
      };
      ensure("hl-conc", data.concessions);
      ensure("hl-anom", data.anomalies);
      ensure("hl-dep", data.deposits);

      if (!map.getLayer("hl-conc-fill")) {
        map.addLayer({
          id: "hl-conc-fill",
          type: "fill",
          source: "hl-conc",
          paint: {
            "fill-color": [
              "interpolate", ["linear"], ["coalesce", ["get", "score"], 0],
              0, "#94a3b8",
              60, "#f59e0b",
              80, "#10b981",
            ],
            "fill-opacity": 0.55,
          },
        });
        map.addLayer({
          id: "hl-conc-line",
          type: "line",
          source: "hl-conc",
          paint: { "line-color": "#ffffff", "line-width": 0.6, "line-opacity": 0.8 },
        });
      }
      if (!map.getLayer("hl-anom-pt")) {
        map.addLayer({
          id: "hl-anom-pt",
          type: "circle",
          source: "hl-anom",
          paint: {
            "circle-radius": 4,
            "circle-color": "#e879f9",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
            "circle-opacity": 0.9,
          },
        });
      }
      if (!map.getLayer("hl-dep-pt")) {
        map.addLayer({
          id: "hl-dep-pt",
          type: "circle",
          source: "hl-dep",
          paint: {
            "circle-radius": 5,
            "circle-color": "#fcd34d",
            "circle-stroke-color": "#0b2a5b",
            "circle-stroke-width": 1.2,
          },
        });
      }

      if (data.bbox) {
        const [w, s, e, n] = data.bbox;
        try {
          map.fitBounds([[w, s], [e, n]], { padding: 40, duration: 700, maxZoom: 7 });
        } catch {}
      }
    };

    if (styleReadyRef.current) apply();
    else map.once("load", apply);
  }, [data]);

  const hasData =
    (data?.concessions?.features?.length ?? 0) +
      (data?.anomalies?.features?.length ?? 0) +
      (data?.deposits?.features?.length ?? 0) >
    0;

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-[var(--brand-blue-soft)] to-transparent rounded-3xl -z-10" />
      <div className="rounded-2xl border border-[var(--brand-hair)] bg-white shadow-[0_30px_60px_-30px_rgba(11,42,91,0.25)] overflow-hidden">
        <div className="h-9 bg-[var(--brand-navy-deep)] flex items-center px-3 gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="ml-3 text-[10px] font-mono text-white/60 tracking-widest">
            GEOCAPITALS · LIVE MAP · CHILE
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-mono text-[var(--brand-gold)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-gold)] animate-pulse" />
            LIVE
          </span>
        </div>

        <div className="relative">
          <div ref={containerRef} className="h-[420px] w-full bg-[var(--brand-navy-deep)]" />
          {/* Overlay leyenda */}
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-md border border-[var(--brand-hair)] px-3 py-2 text-[10px] font-mono text-[var(--brand-navy-deep)] space-y-1 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-emerald-500/70 border border-white" /> Concesión score alto
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-amber-500/70 border border-white" /> Score medio
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 border border-white" /> Anomalía satelital
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 border border-[var(--brand-navy-deep)]" /> Yacimiento conocido
            </div>
          </div>

          {/* Stats flotantes */}
          {hasData && (
            <div className="absolute top-3 right-3 flex gap-2">
              <Pill icon={<Radar className="w-3 h-3" />} label={`${data?.concessions.features.length ?? 0} concesiones`} />
              <Pill icon={<Satellite className="w-3 h-3" />} label={`${data?.anomalies.features.length ?? 0} anomalías`} />
              <Pill icon={<Activity className="w-3 h-3" />} label={`${data?.deposits.features.length ?? 0} yacimientos`} />
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 flex items-center justify-between gap-3 text-[10px] font-mono text-[var(--brand-mute)] border-t border-[var(--brand-hair)]">
          <span>PostGIS · Sentinel-2 · Esri Imagery</span>
          <Link
            to="/terminal"
            className="inline-flex items-center gap-1.5 text-[var(--brand-blue)] hover:gap-2 transition-all font-medium normal-case tracking-normal"
          >
            {t("open_terminal")} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur border border-[var(--brand-hair)] rounded-full px-2.5 py-1 text-[10px] font-mono text-[var(--brand-navy-deep)] shadow-sm">
      {icon}
      {label}
    </span>
  );
}

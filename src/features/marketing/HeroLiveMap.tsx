import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MLMap, Popup as MLPopup } from "maplibre-gl";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Satellite, Radar, Activity, ArrowRight, Briefcase, Sparkles } from "lucide-react";
import { getLandingMapData } from "@/lib/landingMap.functions";
import { useLocale } from "@/features/marketing/i18n";

// maplibre-gl touches `window` at import time — load it only in the browser.
let _maplibre: typeof import("maplibre-gl") | null = null;
async function loadMaplibre() {
  if (_maplibre) return _maplibre;
  const [mod] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]);
  _maplibre = mod.default ? (mod as any) : mod;
  return _maplibre!;
}

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
const EMPTY_FC = { type: "FeatureCollection", features: [] } as any;

type Mode = "listings" | "potential";

export function HeroLiveMap() {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<MLPopup | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const styleReadyRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("listings");

  const fetchMap = useServerFn(getLandingMapData);
  const { data } = useQuery({
    queryKey: ["landing-map"],
    queryFn: () => fetchMap(),
    staleTime: 5 * 60_000,
    enabled: mounted,
  });

  // init map (client-only, lazy)
  useEffect(() => {
    let cancelled = false;
    setMounted(true);
    if (!containerRef.current || mapRef.current) return;
    loadMaplibre().then((ml) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      mlRef.current = ml;
      const map = new ml.Map({
        container: containerRef.current,
        style: STYLE,
        center: FALLBACK_CENTER,
        zoom: FALLBACK_ZOOM,
        attributionControl: { compact: true },
        cooperativeGestures: true,
        interactive: true,
        pitchWithRotate: false,
      });
      map.addControl(
        new ml.NavigationControl({ visualizePitch: false, showCompass: false }),
        "top-right",
      );
      map.on("load", () => {
        styleReadyRef.current = true;
      });
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
  }, []);

  // data → sources + layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;

    const apply = () => {
      const ensureSrc = (id: string, fc: any) => {
        const src = map.getSource(id) as any;
        if (src) src.setData(fc);
        else map.addSource(id, { type: "geojson", data: fc });
      };
      ensureSrc("hl-conc", data.concessions ?? EMPTY_FC);
      ensureSrc("hl-anom", data.anomalies ?? EMPTY_FC);
      ensureSrc("hl-dep", data.deposits ?? EMPTY_FC);
      ensureSrc("hl-list", data.listings ?? EMPTY_FC);

      // potential layers
      if (!map.getLayer("hl-conc-fill")) {
        map.addLayer({
          id: "hl-conc-fill",
          type: "fill",
          source: "hl-conc",
          paint: {
            "fill-color": [
              "interpolate", ["linear"], ["coalesce", ["get", "score"], 0],
              0, "#94a3b8", 60, "#f59e0b", 80, "#10b981",
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

      // listings layer — bigger, colored by modality
      if (!map.getLayer("hl-list-pt")) {
        map.addLayer({
          id: "hl-list-pt",
          type: "circle",
          source: "hl-list",
          paint: {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              3, 5, 6, 9, 10, 14,
            ],
            "circle-color": [
              "match", ["get", "modality"],
              "sale", "#10b981",
              "jv", "#fcd34d",
              "royalty", "#60a5fa",
              "#fcd34d",
            ],
            "circle-stroke-color": "#0b2a5b",
            "circle-stroke-width": 2,
            "circle-opacity": 0.95,
          },
        });
        map.addLayer({
          id: "hl-list-halo",
          type: "circle",
          source: "hl-list",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 10, 6, 18, 10, 26],
            "circle-color": "#fcd34d",
            "circle-opacity": 0.15,
            "circle-blur": 0.6,
          },
        }, "hl-list-pt");

        // hover popup
        map.on("mouseenter", "hl-list-pt", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "hl-list-pt", () => {
          map.getCanvas().style.cursor = "";
          popupRef.current?.remove();
        });
        map.on("click", "hl-list-pt", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p: any = f.properties ?? {};
          const price =
            p.asking_price_usd != null && p.asking_price_usd !== ""
              ? `US$ ${Number(p.asking_price_usd).toLocaleString("en-US")}`
              : "—";
          const html = `
            <div style="font-family:ui-sans-serif,system-ui;min-width:200px">
              <div style="font-size:11px;letter-spacing:.08em;color:#64748b;text-transform:uppercase">${escapeHtml(p.modality ?? "")} · ${escapeHtml(p.commodity ?? "")}</div>
              <div style="font-weight:600;color:#0b2a5b;margin:2px 0 6px">${escapeHtml(p.title ?? "Sin título")}</div>
              <div style="font-size:12px;color:#334155">${escapeHtml(p.region ?? "")}${p.area_ha ? ` · ${Number(p.area_ha).toLocaleString()} ha` : ""}</div>
              <div style="font-size:12px;color:#0b2a5b;margin-top:4px"><b>${price}</b></div>
            </div>`;
          popupRef.current?.remove();
          popupRef.current = new mlRef.current!.Popup({ closeButton: true, offset: 12 })
            .setLngLat((f.geometry as any).coordinates)
            .setHTML(html)
            .addTo(map);
        });
      }
    };

    if (styleReadyRef.current) apply();
    else map.once("load", apply);
  }, [data]);

  // toggle layer visibility + fit bounds per mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    const setVis = (id: string, v: "visible" | "none") => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    };
    const applyMode = () => {
      const listingsOn = mode === "listings";
      setVis("hl-list-pt", listingsOn ? "visible" : "none");
      setVis("hl-list-halo", listingsOn ? "visible" : "none");
      setVis("hl-conc-fill", listingsOn ? "none" : "visible");
      setVis("hl-conc-line", listingsOn ? "none" : "visible");
      setVis("hl-anom-pt", listingsOn ? "none" : "visible");
      setVis("hl-dep-pt", listingsOn ? "none" : "visible");

      const bb = listingsOn ? data.listingsBbox : data.bbox;
      if (bb) {
        const [w, s, e, n] = bb;
        try {
          map.fitBounds([[w, s], [e, n]], {
            padding: 60,
            duration: 700,
            maxZoom: listingsOn ? 6.5 : 7,
          });
        } catch {}
      }
    };
    if (styleReadyRef.current) applyMode();
    else map.once("load", applyMode);
  }, [mode, data]);

  const counts = useMemo(() => ({
    listings: data?.listings?.features?.length ?? 0,
    concessions: data?.concessions?.features?.length ?? 0,
    anomalies: data?.anomalies?.features?.length ?? 0,
    deposits: data?.deposits?.features?.length ?? 0,
  }), [data]);

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-[var(--brand-blue-soft)] to-transparent rounded-3xl -z-10" />
      <div className="rounded-2xl border border-[var(--brand-hair)] bg-white shadow-[0_30px_60px_-30px_rgba(11,42,91,0.25)] overflow-hidden">
        <div className="h-9 bg-[var(--brand-navy-deep)] flex items-center px-3 gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="ml-3 text-[10px] font-mono text-white/60 tracking-widest">
            {t("map_chip_live")}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-mono text-[var(--brand-gold)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-gold)] animate-pulse" />
            LIVE
          </span>
        </div>

        {/* Mode toggle */}
        <div className="flex items-stretch border-b border-[var(--brand-hair)] bg-[var(--brand-blue-soft)]/40">
          <ModeBtn
            active={mode === "listings"}
            onClick={() => setMode("listings")}
            icon={<Briefcase className="w-3.5 h-3.5" />}
            label={t("map_mode_listings")}
            hint={t("map_listings_hint")}
            count={counts.listings}
          />
          <ModeBtn
            active={mode === "potential"}
            onClick={() => setMode("potential")}
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label={t("map_mode_potential")}
            hint={t("map_potential_hint")}
            count={counts.concessions + counts.anomalies + counts.deposits}
          />
        </div>

        <div className="relative">
          <div ref={containerRef} className="h-[420px] w-full bg-[var(--brand-navy-deep)]" />

          {/* legend */}
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-md border border-[var(--brand-hair)] px-3 py-2 text-[10px] font-mono text-[var(--brand-navy-deep)] space-y-1 shadow-sm">
            {mode === "listings" ? (
              <>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" /> Venta</div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-300 border border-[var(--brand-navy-deep)]" /> Joint Venture</div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 border border-white" /> Royalty</div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-emerald-500/70 border border-white" /> Concesión score alto</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-500/70 border border-white" /> Score medio</div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 border border-white" /> Anomalía satelital</div>
                <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-300 border border-[var(--brand-navy-deep)]" /> Yacimiento conocido</div>
              </>
            )}
          </div>

          {/* stat pills */}
          <div className="absolute top-3 right-3 flex gap-2">
            {mode === "listings" ? (
              <Pill icon={<Briefcase className="w-3 h-3" />} label={`${counts.listings} listados`} />
            ) : (
              <>
                <Pill icon={<Radar className="w-3 h-3" />} label={`${counts.concessions} concesiones`} />
                <Pill icon={<Satellite className="w-3 h-3" />} label={`${counts.anomalies} anomalías`} />
                <Pill icon={<Activity className="w-3 h-3" />} label={`${counts.deposits} yacimientos`} />
              </>
            )}
          </div>
        </div>

        <div className="px-4 py-2.5 flex items-center justify-between gap-3 text-[10px] font-mono text-[var(--brand-mute)] border-t border-[var(--brand-hair)]">
          <span>PostGIS · Sentinel-2 · Esri Imagery</span>
          <div className="flex items-center gap-4">
            <Link
              to="/proyectos"
              className="inline-flex items-center gap-1.5 text-[var(--brand-blue)] hover:gap-2 transition-all font-medium normal-case tracking-normal"
            >
              {t("map_browse_deals")} <ArrowRight className="w-3 h-3" />
            </Link>
            <Link
              to="/terminal"
              className="inline-flex items-center gap-1.5 text-[var(--brand-blue)] hover:gap-2 transition-all font-medium normal-case tracking-normal"
            >
              {t("open_terminal")} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
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

function ModeBtn({
  active,
  onClick,
  icon,
  label,
  hint,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 text-left transition-colors ${
        active
          ? "bg-white text-[var(--brand-navy-deep)] shadow-[inset_0_-2px_0_0_var(--brand-gold)]"
          : "text-[var(--brand-mute)] hover:bg-white/60"
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
        {icon}
        {label}
        <span className="ml-auto text-[10px] font-mono opacity-70">{count}</span>
      </div>
      <div className="text-[10px] font-mono opacity-70 mt-0.5">{hint}</div>
    </button>
  );
}

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

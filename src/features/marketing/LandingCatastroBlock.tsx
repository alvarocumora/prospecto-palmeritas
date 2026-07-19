import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MLMap, StyleSpecification } from "maplibre-gl";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Bell,
  FileText,
  Globe2,
  MapPin,
  Search,
  Sparkles,
  Layers,
  Check,
} from "lucide-react";
import { getLandingCatastroSnapshot } from "@/lib/landingCatastro.functions";
import { getPublicPlans } from "@/lib/plans.functions";

let _ml: typeof import("maplibre-gl") | null = null;
async function loadMaplibre() {
  if (_ml) return _ml;
  const [mod] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]);
  _ml = mod.default ? (mod as unknown as typeof import("maplibre-gl")) : mod;
  return _ml!;
}

const STYLE: StyleSpecification = {
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

const TIPO_LABEL: Record<string, string> = {
  exploracion: "Exploración",
  explotacion: "Explotación",
};
const ESTADO_LABEL: Record<string, string> = {
  vigente: "Vigentes",
  en_tramite: "En trámite",
  eliminada: "Eliminadas",
};

function fmtInt(n: number) {
  return new Intl.NumberFormat("es-CL").format(n);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CadastreMap({ polygons }: { polygons: GeoJSON.FeatureCollection }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!ref.current || mapRef.current) return;
    let ro: ResizeObserver | null = null;
    loadMaplibre().then((ml) => {
      if (cancelled || !ref.current || mapRef.current) return;
      const map = new ml.Map({
        container: ref.current,
        style: STYLE,
        center: [-70.32, -27.36],
        zoom: 8.4,
        attributionControl: false,
        interactive: true,
      });
      map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        mapRef.current = map;
        (window as unknown as { __landingMap?: unknown }).__landingMap = map;
        setReady(true);
        map.resize();
      });
      if (ref.current && "ResizeObserver" in window) {
        ro = new ResizeObserver(() => {
          try {
            map.resize();
          } catch {
            /* noop */
          }
        });
        ro.observe(ref.current);
      }
    });
    return () => {
      cancelled = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // Clone to strip any non-cloneable wrappers from the query cache
    const data = polygons?.features?.length
      ? (JSON.parse(JSON.stringify(polygons)) as GeoJSON.FeatureCollection)
      : ({ type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection);
    const src = map.getSource("cadastre-poly");
    if (src) {
      (src as unknown as { setData: (d: unknown) => void }).setData(data);
      return;
    }
    map.addSource("cadastre-poly", { type: "geojson", data });

    // Fill by tipo (exploración / explotación)
    map.addLayer({
      id: "cadastre-fill",
      type: "fill",
      source: "cadastre-poly",
      paint: {
        "fill-color": [
          "match",
          ["get", "tipo"],
          "exploracion", "#2563eb",
          "exploración", "#2563eb",
          "explotacion", "#f59e0b",
          "explotación", "#f59e0b",
          /* other */ "#64748b",
        ],
        "fill-opacity": [
          "interpolate", ["linear"], ["zoom"],
          3, 0.35,
          6, 0.45,
          10, 0.55,
        ],
      },
    });
    map.addLayer({
      id: "cadastre-outline",
      type: "line",
      source: "cadastre-poly",
      paint: {
        "line-color": [
          "match",
          ["get", "tipo"],
          "exploracion", "#60a5fa",
          "exploración", "#60a5fa",
          "explotacion", "#fbbf24",
          "explotación", "#fbbf24",
          "#94a3b8",
        ],
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.2, 8, 0.8, 12, 1.6],
        "line-opacity": 0.8,
      },
    });
    map.addLayer({
      id: "cadastre-dot",
      type: "circle",
      source: "cadastre-poly",
      maxzoom: 8,
      paint: {
        "circle-color": [
          "match", ["get", "tipo"],
          "exploracion", "#60a5fa",
          "exploración", "#60a5fa",
          "explotacion", "#fbbf24",
          "explotación", "#fbbf24",
          "#94a3b8",
        ],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 6, 2.4, 8, 4],
        "circle-opacity": 0.85,
        "circle-stroke-color": "#0b1220",
        "circle-stroke-width": 0.4,
      },
    });
  }, [polygons, ready]);

  return (
    <div
      ref={ref}
      className="w-full h-full"
      style={{ background: "#0b1220" }}
      aria-label="Mapa nacional de concesiones mineras"
    />
  );
}

export function LandingCatastroBlock() {
  const snapFn = useServerFn(getLandingCatastroSnapshot);
  const { data } = useQuery({
    queryKey: ["landing-catastro-snapshot"],
    queryFn: () => snapFn(),
    staleTime: 5 * 60_000,
  });

  const plansFn = useServerFn(getPublicPlans);
  const { data: plans = [] } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => plansFn(),
    staleTime: 5 * 60_000,
  });

  const total = data?.totalNacional ?? 0;
  const polySample = data?.polygons?.features.length ?? 0;
  const maxTipo = Math.max(1, ...(data?.porTipo?.map((x) => x.count) ?? [1]));
  const maxEstado = Math.max(1, ...(data?.porEstado?.map((x) => x.count) ?? [1]));

  const tools: Array<{ label: string; to: string; icon: typeof MapPin; badge?: string }> = [
    { label: "Mapa nacional", to: "/catastro/mapa", icon: MapPin },
    { label: "Buscar titular / RUT", to: "/catastro/mapa", icon: Search },
    { label: "Multi-país (PE · BR · ZM · MW)", to: "/catastro/global", icon: Globe2 },
    { label: "Monitoreo y alertas", to: "/catastro/app/watchlist", icon: Bell, badge: "Pro" },
    { label: "Reportes PDF / GeoJSON", to: "/catastro/precios", icon: FileText, badge: "Pro" },
    { label: "Vista proyecto", to: "/catastro/proyecto", icon: Layers },
  ];

  return (
    <div className="space-y-8" data-theme="im-light">
      {/* Row: map + KPIs */}
      <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6">
        {/* Concesiones */}
        <div className="relative rounded-sm overflow-hidden border border-hairline shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)] h-[440px] lg:h-[520px] bg-[#0b1220]">
          <CadastreMap polygons={data?.polygons ?? { type: "FeatureCollection", features: [] }} />
          {/* HUD chips */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-black/60 backdrop-blur border border-white/10 text-[10px] font-mono uppercase tracking-[0.22em] text-white">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#facc15" }}
              />
              SERNAGEOMIN · Catastro live
            </div>
            <div className="inline-flex items-center gap-3 px-2.5 py-1 rounded-sm bg-black/50 backdrop-blur border border-white/10 text-[10px] font-mono text-white/80">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: "#f59e0b" }} />
                Explotación
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: "#2563eb" }} />
                Exploración
              </span>
              <span className="opacity-70">· {fmtInt(polySample)} de {fmtInt(total)}</span>
            </div>
          </div>
          <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/70">
              Última sync · {fmtDate(data?.updatedAt ?? null)}
            </div>
            <Link
              to="/catastro/mapa"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-content text-[10px] font-semibold uppercase tracking-[0.22em] hover:bg-accent-brand hover:text-white transition-colors"
            >
              Abrir mapa completo
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* KPIs / distributions */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-px bg-hairline border border-hairline rounded-sm overflow-hidden">
            <div className="bg-white px-4 py-4">
              <div className="font-mono text-2xl text-content tracking-tight">{fmtInt(total)}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-content-muted mt-1">
                Concesiones indexadas
              </div>
            </div>
            <div className="bg-white px-4 py-4">
              <div className="font-mono text-2xl text-content tracking-tight">
                {fmtInt(data?.topTitulares?.length ?? 0)}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-content-muted mt-1">
                Top titulares monitoreados
              </div>
            </div>
          </div>

          {/* Distribución por tipo */}
          <div className="border border-hairline rounded-sm bg-white p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-content-muted mb-3">
              Distribución por tipo
            </div>
            <div className="space-y-2">
              {(data?.porTipo ?? []).map((row) => (
                <div key={row.key}>
                  <div className="flex justify-between text-[11px] font-mono text-content mb-1">
                    <span>{TIPO_LABEL[row.key] ?? row.key}</span>
                    <span className="text-content-muted">{fmtInt(row.count)}</span>
                  </div>
                  <div className="h-1.5 bg-hairline rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(row.count / maxTipo) * 100}%`,
                        background: "var(--accent-brand)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estado */}
          <div className="border border-hairline rounded-sm bg-white p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-content-muted mb-3">
              Estado registral
            </div>
            <div className="space-y-2">
              {(data?.porEstado ?? []).map((row) => (
                <div key={row.key}>
                  <div className="flex justify-between text-[11px] font-mono text-content mb-1">
                    <span>{ESTADO_LABEL[row.key] ?? row.key}</span>
                    <span className="text-content-muted">{fmtInt(row.count)}</span>
                  </div>
                  <div className="h-1.5 bg-hairline rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(row.count / maxEstado) * 100}%`,
                        background: "#0f172a",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top holders */}
          <div className="border border-hairline rounded-sm bg-white p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-content-muted mb-3">
              Top titulares
            </div>
            <ul className="divide-y divide-hairline">
              {(data?.topTitulares ?? []).slice(0, 5).map((h) => (
                <li
                  key={h.name}
                  className="flex items-center justify-between py-1.5 text-[12px] text-content"
                >
                  <span className="truncate mr-3">{h.name}</span>
                  <span className="font-mono text-content-muted">{fmtInt(h.count)}</span>
                </li>
              ))}
              {(!data || data.topTitulares.length === 0) && (
                <li className="py-2 text-[11px] font-mono text-content-muted">Cargando…</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Tools row */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-content-muted mb-3">
          Herramientas del catastro
        </div>
        <div className="flex flex-wrap gap-2">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.label}
                to={tool.to}
                className="group inline-flex items-center gap-2 px-3 py-2 border border-hairline rounded-sm bg-white text-[11px] font-mono text-content hover:border-accent-brand hover:text-accent-brand transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tool.label}</span>
                {tool.badge && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-content text-white text-[9px] uppercase tracking-wider">
                    {tool.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Plans mini */}
      <div className="border border-hairline rounded-sm bg-white">
        <div className="px-5 py-4 border-b border-hairline flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-content-muted">
              Planes
            </div>
            <div className="brand-display text-lg text-content">Desde gratis. Escalable.</div>
          </div>
          <Link
            to="/catastro/precios"
            className="inline-flex items-center gap-1.5 h-10 px-4 bg-content text-white text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:bg-accent-brand transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ver planes
          </Link>
        </div>
        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-hairline">
          {plans.length === 0 && (
            <div className="p-5 text-[11px] font-mono text-content-muted">Cargando planes…</div>
          )}
          {plans.slice(0, 3).map((p) => (
            <div key={p.code} className="p-5">
              <div className="flex items-baseline justify-between mb-2">
                <div className="brand-display text-xl text-content">{p.name}</div>
                <div className="font-mono text-content-muted text-[11px]">
                  {p.priceMonthly === 0 ? "Gratis" : `USD ${p.priceMonthly}/mes`}
                </div>
              </div>
              {p.description && (
                <p className="text-[12px] text-content-muted mb-3 leading-snug">{p.description}</p>
              )}
              <ul className="space-y-1.5">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-content">
                    <Check className="w-3.5 h-3.5 mt-0.5 text-accent-brand shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

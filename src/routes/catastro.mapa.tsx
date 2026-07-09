import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  Search,
  Layers,
  Building2,
  SlidersHorizontal,
  Satellite,
  Map as MapIcon,
  LocateFixed,
  ChevronDown,
  X,
} from "lucide-react";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { searchConcessions } from "@/lib/catastroPublic.functions";
import { SNGM_CONCESIONES_URL } from "@/lib/sngm";

export const Route = createFileRoute("/catastro/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa Nacional de Concesiones Mineras de Chile · Geocapitals" },
      {
        name: "description",
        content:
          "Mapa interactivo nacional de concesiones mineras de Chile en tiempo real desde SERNAGEOMIN. Busca por titular, RUT o código, filtra por tipo y situación.",
      },
      { property: "og:title", content: "Mapa Nacional Catastro Minero · Geocapitals" },
      {
        property: "og:description",
        content:
          "Visualiza todas las concesiones mineras vigentes en Chile sobre cartografía Esri.",
      },
      { rel: "canonical", href: "/catastro/mapa" },
    ],
  }),
  component: CatastroMap,
});

// La capa nacional tiene ~103.000 polígonos: solo se piden al servidor desde
// este zoom. Bajo ese nivel mostramos un aviso en vez de un mapa "vacío".
const LAYER_MIN_ZOOM = 9;

type TipoFilter = "all" | "exploracion" | "explotacion";
type SituacionFilter = "all" | "constituida" | "tramite" | "eliminada";
type Basemap = "satelite" | "calles";

const BASEMAPS: Record<Basemap, string> = {
  satelite:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  calles:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
};

const SITUACION_SQL: Record<Exclude<SituacionFilter, "all">, string> = {
  constituida: "CONSTITUIDA",
  tramite: "EN TRAMITE",
  eliminada: "ELIMINADA",
};

/** Construye el WHERE de SERNAGEOMIN a partir de los filtros activos. */
function buildWhere(tipo: TipoFilter, situacion: SituacionFilter): string {
  const clauses: string[] = [];
  if (tipo !== "all")
    clauses.push(`TIPO_CONCESION = '${tipo === "exploracion" ? "EXPLORACION" : "EXPLOTACION"}'`);
  if (situacion !== "all") clauses.push(`SITUACION_CONCESION = '${SITUACION_SQL[situacion]}'`);
  return clauses.length ? clauses.join(" AND ") : "1=1";
}

/** Color por situación legal (señal de due-diligence). */
function colorForSituacion(situacion: unknown): string {
  const s = String(situacion ?? "").toUpperCase();
  if (s.includes("ELIMIN")) return "#ef4444";
  if (s.includes("TRAMITE") || s.includes("TRÁMITE")) return "#f59e0b";
  if (s.includes("CONSTITU")) return "#10b981";
  return "#94a3b8";
}

function CatastroMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  // Refs a objetos Leaflet para actualizarlos sin reinicializar el mapa.
  const mapObjRef = useRef<unknown>(null);
  const layerRef = useRef<unknown>(null);
  const baseLayerRef = useRef<unknown>(null);

  const [q, setQ] = useState("");
  const [needsZoom, setNeedsZoom] = useState(false);
  const [layerLoading, setLayerLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [featureCount, setFeatureCount] = useState<number | null>(null);

  const [tipo, setTipo] = useState<TipoFilter>("all");
  const [situacion, setSituacion] = useState<SituacionFilter>("all");
  const [basemap, setBasemap] = useState<Basemap>("satelite");
  const [showFilters, setShowFilters] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const search = useServerFn(searchConcessions);
  const mutation = useMutation({
    mutationFn: (term: string) => search({ data: { q: term, limit: 20 } }),
  });
  const hasResults = (mutation.data?.results.length ?? 0) > 0;

  // Init del mapa (una sola vez).
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      if (!mapRef.current) return;
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        const EL = await import("esri-leaflet");
        const map = L.map(mapRef.current, {
          center: [-31.63, -71.17],
          zoom: 11,
          zoomControl: false,
        });
        mapObjRef.current = map;
        L.control.zoom({ position: "bottomright" }).addTo(map);

        const base = L.tileLayer(BASEMAPS.satelite, {
          attribution: "Esri · SERNAGEOMIN",
          maxZoom: 19,
        }).addTo(map);
        baseLayerRef.current = base;

        const concesiones = EL.featureLayer({
          url: SNGM_CONCESIONES_URL,
          minZoom: LAYER_MIN_ZOOM,
          precision: 5,
          simplifyFactor: 0.5,
          where: "1=1",
          style: (feature: { properties?: Record<string, unknown> }) => {
            const c = colorForSituacion(feature?.properties?.SITUACION_CONCESION);
            return { color: c, weight: 1, fillColor: c, fillOpacity: 0.18 };
          },
        });
        layerRef.current = concesiones;

        const popupFn = (layer: unknown) => {
          const p =
            (layer as { feature?: { properties?: Record<string, unknown> } }).feature?.properties ??
            {};
          const rol = `${p.NUMERO_ROL ?? ""}${p.DV_ROL ? `-${p.DV_ROL}` : ""}`;
          return `
          <div style="font-family:ui-monospace,monospace;font-size:11px;line-height:1.45">
            <div style="font-weight:600;font-size:12px">${p.NOMBRE ?? rol}</div>
            <div>ROL: ${rol}</div>
            <div>Titular: ${p.TITULAR_NOMBRE ?? "—"}</div>
            <div>RUT: ${p.TITULAR_RUT ?? "—"}${p.TITULAR_DV ? `-${p.TITULAR_DV}` : ""}</div>
            <div>Comuna: ${p.COMUNA ?? "—"}</div>
            <div>Hectáreas: ${p.HECTAREAS ?? "—"}</div>
            <div>Tipo: ${p.TIPO_CONCESION ?? "—"}</div>
            <div>Estado: ${p.SITUACION_CONCESION ?? "—"}</div>
          </div>`;
        };
        (concesiones.bindPopup as (fn: (layer: unknown) => string) => void)(popupFn);

        const syncZoomHint = () => setNeedsZoom(map.getZoom() < LAYER_MIN_ZOOM);
        map.on("zoomend", syncZoomHint);
        syncZoomHint();
        concesiones.on("loading", () => setLayerLoading(true));
        concesiones.on("load", () => {
          setLayerLoading(false);
          let n = 0;
          (concesiones.eachFeature as (cb: () => void) => void)(() => (n += 1));
          setFeatureCount(n);
        });
        concesiones.on("requesterror", (e: unknown) => {
          setLayerLoading(false);
          const msg = (e as { error?: { message?: string } })?.error?.message ?? "error de red";
          setMapError(`SERNAGEOMIN no respondió: ${msg}. Reintenta al mover el mapa.`);
        });
        concesiones.on("requestsuccess", () => setMapError(null));
        concesiones.addTo(map);

        cleanup = () => map.remove();
      } catch (e) {
        console.error("[catastro.mapa] init failed", e);
        setMapError(e instanceof Error ? e.message : "No se pudo inicializar el mapa.");
      }
    })();
    return () => cleanup?.();
  }, []);

  // Aplicar filtros a la capa viva (setWhere) sin reinicializar.
  useEffect(() => {
    const layer = layerRef.current as { setWhere?: (w: string) => void } | null;
    layer?.setWhere?.(buildWhere(tipo, situacion));
  }, [tipo, situacion]);

  // Cambio de basemap.
  useEffect(() => {
    const map = mapObjRef.current as { addLayer?: (l: unknown) => void } | null;
    const old = baseLayerRef.current as { remove?: () => void } | null;
    if (!map || typeof window === "undefined") return;
    (async () => {
      const L = (await import("leaflet")).default;
      const next = L.tileLayer(BASEMAPS[basemap], {
        attribution: "Esri · SERNAGEOMIN",
        maxZoom: 19,
      });
      next.addTo(map as never);
      (next as unknown as { bringToBack: () => void }).bringToBack();
      old?.remove?.();
      baseLayerRef.current = next;
    })();
  }, [basemap]);

  const locate = () => {
    const map = mapObjRef.current as {
      locate?: (o: Record<string, unknown>) => void;
    } | null;
    map?.locate?.({ setView: true, maxZoom: 13 });
  };

  return (
    <PublicCatastroShell>
      <div className="relative h-[calc(100dvh-3.5rem)] overflow-hidden">
        {/* Mapa a pantalla completa */}
        <div ref={mapRef} className="absolute inset-0 z-0" />

        {/* Panel flotante: búsqueda + filtros + resultados */}
        <div className="absolute top-2 left-2 right-2 sm:right-auto sm:w-[360px] z-[500] flex flex-col gap-2 max-h-[calc(100%-1rem)]">
          <div className="rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg">
            {/* Búsqueda */}
            <div className="p-2.5 flex items-center gap-2">
              <form
                className="relative flex-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (q.trim().length >= 2) {
                    mutation.mutate(q.trim());
                    setPanelOpen(true);
                  }
                }}
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Titular, RUT, código…"
                  className="w-full pl-10 pr-8 py-2 rounded border border-border bg-background font-mono text-xs focus:outline-none focus:border-primary"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      mutation.reset();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                title="Filtros"
                className={`p-2 rounded border transition-colors ${
                  showFilters || tipo !== "all" || situacion !== "all"
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Filtros */}
            {showFilters && (
              <div className="px-2.5 pb-2.5 space-y-2 border-t border-border pt-2.5">
                <FilterRow label="Tipo">
                  {(
                    [
                      ["all", "Todos"],
                      ["exploracion", "Exploración"],
                      ["explotacion", "Explotación"],
                    ] as [TipoFilter, string][]
                  ).map(([v, l]) => (
                    <Chip key={v} active={tipo === v} onClick={() => setTipo(v)}>
                      {l}
                    </Chip>
                  ))}
                </FilterRow>
                <FilterRow label="Situación">
                  {(
                    [
                      ["all", "Todas"],
                      ["constituida", "Constituida"],
                      ["tramite", "En trámite"],
                      ["eliminada", "Eliminada"],
                    ] as [SituacionFilter, string][]
                  ).map(([v, l]) => (
                    <Chip key={v} active={situacion === v} onClick={() => setSituacion(v)}>
                      {l}
                    </Chip>
                  ))}
                </FilterRow>
              </div>
            )}
          </div>

          {/* Resultados */}
          {(mutation.isPending || mutation.data) && (
            <div className="rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg overflow-hidden flex flex-col min-h-0">
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                className="w-full px-3 py-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3 h-3" /> Resultados
                  {hasResults && ` · ${mutation.data!.results.length}`}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${panelOpen ? "" : "-rotate-90"}`}
                />
              </button>
              {panelOpen && (
                <div className="overflow-y-auto p-2 max-h-[38vh] sm:max-h-[50vh]">
                  {mutation.isPending && (
                    <div className="text-xs font-mono text-muted-foreground p-2">Buscando…</div>
                  )}
                  {mutation.data && !hasResults && (
                    <div className="text-xs font-mono text-muted-foreground p-2 leading-relaxed">
                      Sin coincidencias en cache. El mapa muestra los datos SERNAGEOMIN en vivo —
                      acércate a tu zona de interés y filtra por tipo o situación.
                    </div>
                  )}
                  <ul className="space-y-1">
                    {mutation.data?.results.map((r) => (
                      <li key={r.code}>
                        <Link
                          to="/catastro/c/$code"
                          params={{ code: r.code }}
                          className="block p-2.5 rounded border border-border hover:border-primary hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <Building2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-mono font-semibold truncate">
                                {r.name ?? r.code}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground truncate">
                                {r.holder ?? "—"}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground">
                                {r.commune ?? r.region ?? ""} ·{" "}
                                {r.area_ha ? `${r.area_ha.toLocaleString("es-CL")} ha` : "—"}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controles de mapa: basemap + geolocalización */}
        <div className="absolute top-2 right-2 z-[500] flex flex-col gap-2 sm:top-2">
          <div className="rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg flex overflow-hidden">
            <button
              type="button"
              onClick={() => setBasemap("satelite")}
              title="Satélite"
              className={`p-2 ${basemap === "satelite" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Satellite className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setBasemap("calles")}
              title="Calles"
              className={`p-2 border-l border-border ${basemap === "calles" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={locate}
            title="Mi ubicación"
            className="p-2 rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg text-muted-foreground hover:text-foreground self-end"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
        </div>

        {/* Aviso: bajo el zoom mínimo la capa no se solicita */}
        {needsZoom && !mapError && (
          <div className="absolute top-16 sm:top-3 left-1/2 -translate-x-1/2 z-[400] px-3 py-2 rounded bg-background/95 border border-border text-[11px] font-mono text-foreground backdrop-blur shadow max-w-[90%] text-center">
            Acércate (zoom {LAYER_MIN_ZOOM}+) para cargar las concesiones — la capa nacional tiene
            ~103.000 polígonos
          </div>
        )}

        {/* Cargando features */}
        {layerLoading && !needsZoom && (
          <div className="absolute top-16 sm:top-3 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded bg-background/95 border border-border text-[10px] font-mono text-muted-foreground backdrop-blur">
            Cargando concesiones SERNAGEOMIN…
          </div>
        )}

        {/* Error del servicio */}
        {mapError && (
          <div className="absolute top-16 sm:top-3 left-1/2 -translate-x-1/2 z-[400] max-w-md px-3 py-2 rounded bg-background/95 border border-danger/50 text-[11px] font-mono text-danger backdrop-blur shadow text-center">
            {mapError}
          </div>
        )}

        {/* Leyenda + stats + atribución */}
        <div className="absolute bottom-3 left-3 z-[400] px-2.5 py-2 rounded-lg bg-background/90 border border-border text-[10px] font-mono text-muted-foreground backdrop-blur space-y-1">
          <LegendRow color="#10b981" label="Constituida" />
          <LegendRow color="#f59e0b" label="En trámite" />
          <LegendRow color="#ef4444" label="Eliminada" />
          {featureCount != null && !needsZoom && (
            <div className="pt-1 border-t border-border/60 text-foreground">
              {featureCount.toLocaleString("es-CL")} concesiones en vista
            </div>
          )}
          <div className="text-muted-foreground/70">SERNAGEOMIN v2 · Esri</div>
        </div>
      </div>
    </PublicCatastroShell>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-2.5 rounded-sm border"
        style={{ borderColor: color, backgroundColor: `${color}33` }}
      />
      {label}
    </div>
  );
}

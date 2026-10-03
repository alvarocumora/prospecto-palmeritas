import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
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
  Ghost,
  Download,
  Printer,
  ExternalLink,
} from "lucide-react";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { CatastroProjectPage } from "@/features/catastro-project/CatastroProjectPage";
import { useAuth } from "@/hooks/useAuth";
import { searchConcessions } from "@/lib/catastroPublic.functions";
import { SNGM_CONCESIONES_URL, SNGM_ELIMINADAS_POLY_URL } from "@/lib/sngm";
import { searchGlobalCadastre } from "@/lib/cadastre.functions";
import { featuresToCSV, featuresToGeoJSON, type ConcesionFeature } from "@/lib/catastroExport";

const searchSchema = z.object({
  lat: z.coerce.number().optional().catch(undefined),
  lng: z.coerce.number().optional().catch(undefined),
  z: z.coerce.number().optional().catch(undefined),
  tipo: z.enum(["all", "exploracion", "explotacion"]).optional().catch(undefined),
  sit: z.enum(["all", "constituida", "tramite", "eliminada"]).optional().catch(undefined),
  base: z.enum(["satelite", "calles"]).optional().catch(undefined),
  elim: z.coerce.boolean().optional().catch(undefined),
  pais: z.enum(["CL", "PE", "BR", "ZM", "MW"]).optional().catch(undefined),
  vista: z.enum(["explorar", "proyecto"]).optional().catch(undefined),
});

export const Route = createFileRoute("/catastro/mapa")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
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
  component: CatastroUnificado,
});

/** Catastro único: un mismo módulo con dos vistas (explorar país / mis proyectos). */
function CatastroUnificado() {
  const { vista } = Route.useSearch();
  return vista === "proyecto" ? <ProjectWorkspace /> : <NationalCatastroMap />;
}

function CatastroModeTabs({ active }: { active: "explorar" | "proyecto" }) {
  const cls = (on: boolean) =>
    `px-3 py-1 rounded text-[11px] font-mono transition-colors ${
      on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
    }`;
  return (
    <div className="inline-flex gap-1 rounded-md border border-border bg-background/95 p-1 shadow-sm">
      <Link to="/catastro/mapa" search={{}} className={cls(active === "explorar")}>
        Explorar países
      </Link>
      <Link to="/catastro/mapa" search={{ vista: "proyecto" }} className={cls(active === "proyecto")}>
        Mis proyectos
      </Link>
    </div>
  );
}

function ProjectWorkspace() {
  const { user, loading } = useAuth();
  return (
    <PublicCatastroShell>
      <div className="px-4 pt-3">
        <CatastroModeTabs active="proyecto" />
      </div>
      {loading ? (
        <p className="p-8 text-sm text-muted-foreground">Cargando…</p>
      ) : user ? (
        <CatastroProjectPage />
      ) : (
        <div className="mx-auto max-w-md p-10 text-center space-y-3">
          <h2 className="font-serif text-2xl">Catastro de tus proyectos</h2>
          <p className="text-sm text-muted-foreground">
            Ingresa para ver tus concesiones, titulares, patentes, conflictos y vigilancia.
          </p>
          <Link
            to="/auth"
            search={{ redirect: "/catastro/mapa?vista=proyecto" } as never}
            className="inline-block rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Ingresar
          </Link>
        </div>
      )}
    </PublicCatastroShell>
  );
}

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

type Pais = "CL" | "PE" | "BR" | "ZM" | "MW";

/** Jurisdicciones del visor universal: centro, zoom y capa oficial (MapServer). */
const PAISES: Record<
  Pais,
  { label: string; flag: string; inst: string; center: [number, number]; zoom: number; mapServer?: string; layer?: number }
> = {
  CL: { label: "Chile", flag: "🇨🇱", inst: "SERNAGEOMIN", center: [-31.63, -71.17], zoom: 11 },
  PE: {
    label: "Perú", flag: "🇵🇪", inst: "INGEMMET", center: [-12.05, -76.2], zoom: 9,
    mapServer: "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services/SERV_CATASTRO_MINERO_WGS84/MapServer", layer: 0,
  },
  BR: {
    label: "Brasil", flag: "🇧🇷", inst: "ANM", center: [-19.92, -43.94], zoom: 9,
    mapServer: "https://geo.anm.gov.br/arcgis/rest/services/SIGMINE/dados_anm/MapServer", layer: 0,
  },
  ZM: {
    label: "Zambia", flag: "🇿🇲", inst: "Landfolio", center: [-12.8, 28.2], zoom: 9,
    mapServer: "https://ags1.landfolio.com/arcgis/rest/services/ProdPortal/ZambiaPortal/MapServer", layer: 0,
  },
  MW: {
    label: "Malawi", flag: "🇲🇼", inst: "Landfolio", center: [-13.9, 33.8], zoom: 8,
    mapServer: "https://demo.landfolio.com/arcgis/rest/services/Malawi/MapPortal_ActiveLicenses/MapServer", layer: 1,
  },
};

/** Paleta cartográfica institucional (Leaflet necesita valores literales). */
const MAP_COLORS = {
  constituida: "#0F69B4",
  tramite: "#E0A21B",
  eliminada: "#8a94a3",
  otro: "#5b6b80",
};

/** Color por situación legal (señal de due-diligence). */
function colorForSituacion(situacion: unknown): string {
  const s = String(situacion ?? "").toUpperCase();
  if (s.includes("ELIMIN")) return MAP_COLORS.eliminada;
  if (s.includes("TRAMITE") || s.includes("TRÁMITE")) return MAP_COLORS.tramite;
  if (s.includes("CONSTITU")) return MAP_COLORS.constituida;
  return MAP_COLORS.otro;
}

type SelectedProps = Record<string, unknown>;
function rolOf(p: SelectedProps): string {
  return `${p.NUMERO_ROL ?? ""}${p.DV_ROL ? `-${p.DV_ROL}` : ""}`;
}

// Nacional (todo Chile). Distinto de src/components/ops/CatastroMap.tsx, que es
// el mapa de catastro a nivel de proyecto — no confundir los dos nombres.
function NationalCatastroMap() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const mapRef = useRef<HTMLDivElement>(null);
  // Refs a objetos Leaflet para actualizarlos sin reinicializar el mapa.
  const mapObjRef = useRef<unknown>(null);
  const layerRef = useRef<unknown>(null);
  const elimLayerRef = useRef<unknown>(null);
  const baseLayerRef = useRef<unknown>(null);

  const [q, setQ] = useState("");
  const [needsZoom, setNeedsZoom] = useState(false);
  const [layerLoading, setLayerLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [featureCount, setFeatureCount] = useState<number | null>(null);

  const [tipo, setTipo] = useState<TipoFilter>(search.tipo ?? "all");
  const [situacion, setSituacion] = useState<SituacionFilter>(search.sit ?? "all");
  const [basemap, setBasemap] = useState<Basemap>(search.base ?? "satelite");
  const [showEliminadas, setShowEliminadas] = useState<boolean>(!!search.elim);
  const [showFilters, setShowFilters] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selected, setSelected] = useState<SelectedProps | null>(null);
  const [pais, setPais] = useState<Pais>(search.pais ?? "CL");
  const foreignLayerRef = useRef<unknown>(null);
  const [analysisSelection, setAnalysisSelection] = useState<SelectedProps[]>([]);

  // Espejo del estado para escribir la URL desde eventos del mapa sin closures viejos.
  const stateRef = useRef({ tipo, situacion, basemap, showEliminadas, navigate, pais });
  stateRef.current = { tipo, situacion, basemap, showEliminadas, navigate, pais };

  const syncUrl = () => {
    const map = mapObjRef.current as {
      getCenter: () => { lat: number; lng: number };
      getZoom: () => number;
    } | null;
    if (!map) return;
    const st = stateRef.current;
    const c = map.getCenter();
    st.navigate({
      to: "/catastro/mapa",
      search: {
        lat: Number(c.lat.toFixed(5)),
        lng: Number(c.lng.toFixed(5)),
        z: map.getZoom(),
        tipo: st.tipo === "all" ? undefined : st.tipo,
        sit: st.situacion === "all" ? undefined : st.situacion,
        base: st.basemap === "satelite" ? undefined : st.basemap,
        elim: st.showEliminadas ? true : undefined,
        pais: st.pais === "CL" ? undefined : st.pais,
      },
      replace: true,
    });
  };
  const syncUrlRef = useRef(syncUrl);
  syncUrlRef.current = syncUrl;

  const search$ = useServerFn(searchConcessions);
  const mutation = useMutation({
    mutationFn: (term: string) => search$({ data: { q: term, limit: 20 } }),
  });
  const hasResults = (mutation.data?.results.length ?? 0) > 0;
  const global$ = useServerFn(searchGlobalCadastre);
  const globalMutation = useMutation({
    mutationFn: (term: string) => global$({ data: { country: pais, q: term } }),
  });

  // Init del mapa (una sola vez).
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      if (!mapRef.current) return;
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        const EL = await import("esri-leaflet");
        const hasCoords = search.lat != null && search.lng != null;
        const map = L.map(mapRef.current, {
          center: hasCoords ? [search.lat!, search.lng!] : PAISES[stateRef.current.pais].center,
          zoom: search.z ?? PAISES[stateRef.current.pais].zoom,
          zoomControl: false,
        });
        mapObjRef.current = map;
        L.control.zoom({ position: "bottomright" }).addTo(map);

        const base = L.tileLayer(BASEMAPS[stateRef.current.basemap], {
          attribution: "Esri · SERNAGEOMIN",
          maxZoom: 19,
        }).addTo(map);
        baseLayerRef.current = base;
        // Toponimia sobre el satélite (mismo estilo que la vista proyecto).
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
          opacity: 0.35,
        }).addTo(map);

        const concesiones = EL.featureLayer({
          url: SNGM_CONCESIONES_URL,
          minZoom: LAYER_MIN_ZOOM,
          precision: 5,
          simplifyFactor: 0.5,
          where: buildWhere(stateRef.current.tipo, stateRef.current.situacion),
          style: (feature: { properties?: Record<string, unknown> }) => {
            const c = colorForSituacion(feature?.properties?.SITUACION_CONCESION);
            return { color: c, weight: 0.9, fillColor: c, fillOpacity: 0.12 };
          },
        });
        layerRef.current = concesiones;

        concesiones.on("click", (e: unknown) => {
          const ev = e as {
            layer?: { feature?: { properties?: Record<string, unknown> } };
            propagatedFrom?: { feature?: { properties?: Record<string, unknown> } };
          };
          const props = ev.layer?.feature?.properties ?? ev.propagatedFrom?.feature?.properties;
          if (props) setSelected(props);
        });

        const syncZoomHint = () => setNeedsZoom(map.getZoom() < LAYER_MIN_ZOOM);
        map.on("zoomend", syncZoomHint);
        map.on("moveend", () => syncUrlRef.current());
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
        if (stateRef.current.pais === "CL") concesiones.addTo(map);

        cleanup = () => map.remove();
      } catch (e) {
        console.error("[catastro.mapa] init failed", e);
        setMapError(e instanceof Error ? e.message : "No se pudo inicializar el mapa.");
      }
    })();
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplicar filtros a la capa viva (setWhere) sin reinicializar + reflejar en URL.
  useEffect(() => {
    const layer = layerRef.current as { setWhere?: (w: string) => void } | null;
    layer?.setWhere?.(buildWhere(tipo, situacion));
    syncUrlRef.current();
  }, [tipo, situacion]);

  // Cambio de jurisdicción: capa oficial del país + vuelo a su región minera.
  const firstPais = useRef(true);
  useEffect(() => {
    const map = mapObjRef.current as {
      flyTo: (c: [number, number], z: number, o?: object) => void;
      hasLayer: (l: unknown) => boolean;
      addLayer: (l: unknown) => void;
      removeLayer: (l: unknown) => void;
    } | null;
    let cancelled = false;
    (async () => {
      // Espera a que el mapa exista (init asíncrono).
      for (let i = 0; i < 40 && !mapObjRef.current; i++) await new Promise((r) => setTimeout(r, 100));
      const m = (mapObjRef.current as typeof map) ?? map;
      if (!m || cancelled) return;
      const cfg = PAISES[pais];
      (foreignLayerRef.current as { remove?: () => void } | null)?.remove?.();
      foreignLayerRef.current = null;
      const cl = layerRef.current;
      if (pais === "CL") {
        if (cl && !m.hasLayer(cl)) m.addLayer(cl);
      } else {
        if (cl && m.hasLayer(cl)) m.removeLayer(cl);
        if (showEliminadas) setShowEliminadas(false);
        const EL = await import("esri-leaflet");
        if (cancelled || !cfg.mapServer) return;
        const dyn = (EL as unknown as { dynamicMapLayer: (o: object) => { addTo: (m: unknown) => unknown; remove: () => void } }).dynamicMapLayer({
          url: cfg.mapServer,
          layers: [cfg.layer ?? 0],
          opacity: 0.75,
          f: "image",
        });
        dyn.addTo(m);
        foreignLayerRef.current = dyn;
      }
      if (!firstPais.current) m.flyTo(cfg.center, cfg.zoom, { duration: 1.2 });
      firstPais.current = false;
      mutation.reset();
      globalMutation.reset();
      setSelected(null);
      syncUrlRef.current();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pais]);

  // Cambio de basemap.
  useEffect(() => {
    const map = mapObjRef.current;
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
    syncUrlRef.current();
  }, [basemap]);

  // Overlay de concesiones eliminadas (terreno liberado).
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      if (showEliminadas) {
        if (elimLayerRef.current) return;
        const EL = await import("esri-leaflet");
        if (cancelled) return;
        const elim = EL.featureLayer({
          url: SNGM_ELIMINADAS_POLY_URL,
          minZoom: LAYER_MIN_ZOOM,
          precision: 5,
          simplifyFactor: 0.5,
          where: "1=1",
          style: () => ({
            color: MAP_COLORS.eliminada,
            weight: 0.7,
            dashArray: "3,3",
            fillColor: MAP_COLORS.eliminada,
            fillOpacity: 0.08,
          }),
        });
        elim.on("click", (e: unknown) => {
          const ev = e as { layer?: { feature?: { properties?: Record<string, unknown> } } };
          if (ev.layer?.feature?.properties)
            setSelected({ ...ev.layer.feature.properties, SITUACION_CONCESION: "ELIMINADA" });
        });
        elim.addTo(map as never);
        elimLayerRef.current = elim;
      } else if (elimLayerRef.current) {
        (elimLayerRef.current as { remove: () => void }).remove();
        elimLayerRef.current = null;
      }
    })();
    syncUrlRef.current();
    return () => {
      cancelled = true;
    };
  }, [showEliminadas]);

  const locate = () => {
    const map = mapObjRef.current as { locate?: (o: Record<string, unknown>) => void } | null;
    map?.locate?.({ setView: true, maxZoom: 13 });
  };

  const exportData = (fmt: "geojson" | "csv") => {
    const collect = (ref: unknown): ConcesionFeature[] => {
      const out: ConcesionFeature[] = [];
      const layer = ref as { eachFeature?: (cb: (l: unknown) => void) => void } | null;
      layer?.eachFeature?.((l) => {
        const f = (l as { feature?: ConcesionFeature }).feature;
        if (f) out.push(f);
      });
      return out;
    };
    const feats = [
      ...collect(layerRef.current),
      ...(showEliminadas ? collect(elimLayerRef.current) : []),
    ];
    if (feats.length === 0) return;
    const content = fmt === "geojson" ? featuresToGeoJSON(feats) : featuresToCSV(feats);
    const blob = new Blob([content], {
      type: fmt === "geojson" ? "application/geo+json" : "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `concesiones-catastro.${fmt === "geojson" ? "geojson" : "csv"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtersActive = tipo !== "all" || situacion !== "all";

  return (
    <PublicCatastroShell>
      <div className="relative h-[calc(100dvh-3.5rem)] overflow-hidden">
        {/* Mapa a pantalla completa */}
        <div ref={mapRef} className="absolute inset-0 z-0" />

        {/* Panel flotante: búsqueda + filtros + resultados */}
        <div className="absolute top-2 left-2 right-2 sm:right-auto sm:w-[360px] z-[500] flex flex-col gap-2 max-h-[calc(100%-1rem)] print:hidden">
          <div className="rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg">
            <div className="px-2.5 pt-2.5">
              <CatastroModeTabs active="explorar" />
            </div>
            {/* Jurisdicción */}
            <div className="px-2.5 pt-2.5 flex flex-wrap gap-1">
              {(Object.keys(PAISES) as Pais[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPais(k)}
                  title={PAISES[k].inst}
                  className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                    pais === k
                      ? "border-primary text-foreground bg-primary/10"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {PAISES[k].flag} {PAISES[k].label}
                </button>
              ))}
            </div>
            {/* Búsqueda */}
            <div className="p-2.5 flex items-center gap-2">
              <form
                className="relative flex-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (q.trim().length >= 2) {
                    if (pais === "CL") mutation.mutate(q.trim());
                    else globalMutation.mutate(q.trim());
                    setPanelOpen(true);
                  }
                }}
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={pais === "CL" ? "Titular, RUT, código…" : `Titular o código · ${PAISES[pais].inst}`}
                  className="w-full pl-10 pr-8 py-2 rounded border border-border bg-background font-mono text-xs focus:outline-none focus:border-primary"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      mutation.reset();
                      globalMutation.reset();
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
                  showFilters || filtersActive
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Filtros */}
            {showFilters && pais === "CL" && (
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
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                    Capa eliminadas
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowEliminadas((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                      showEliminadas
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Ghost className="w-3 h-3" /> {showEliminadas ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => exportData("geojson")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                  >
                    <Download className="w-3 h-3" /> GeoJSON
                  </button>
                  <button
                    type="button"
                    onClick={() => exportData("csv")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    title="Imprimir / PDF"
                    className="px-2 py-1.5 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                  >
                    <Printer className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Resultados otros países */}
          {pais !== "CL" && (globalMutation.isPending || globalMutation.data) && (
            <div className="rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg overflow-y-auto p-2 max-h-[38vh] sm:max-h-[50vh]">
              <div className="px-1 pb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {PAISES[pais].inst} · {globalMutation.data?.results.length ?? 0} resultados
              </div>
              {globalMutation.isPending && (
                <div className="text-xs font-mono text-muted-foreground p-2">Consultando fuente oficial…</div>
              )}
              <ul className="space-y-1">
                {globalMutation.data?.results.map((r) => (
                  <li key={r.code} className="p-2.5 rounded border border-border">
                    <div className="text-xs font-mono font-semibold truncate">{r.name ?? r.code}</div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">{r.holder ?? "—"}</div>
                    <div className="text-[10px] font-mono text-muted-foreground flex justify-between gap-2">
                      <span className="truncate">{r.status ?? "—"}</span>
                      <span>{r.areaHa ? `${Math.round(r.areaHa).toLocaleString("es-CL")} ha` : "—"}</span>
                    </div>
                    {r.sourceUrl && (
                      <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono text-primary">
                        Verificar en {r.source} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resultados */}
          {pais === "CL" && (mutation.isPending || mutation.data) && (
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
        <div className="absolute top-2 right-2 z-[500] flex flex-col gap-2 print:hidden">
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

        {/* Ficha rápida del polígono seleccionado */}
        {selected && (
          <div className="absolute bottom-3 right-3 z-[500] w-[280px] max-w-[calc(100%-1.5rem)] rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg p-3 print:hidden">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="text-xs font-mono font-semibold truncate">
                  {(selected.NOMBRE as string) ?? rolOf(selected)}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  ROL {rolOf(selected) || "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <dl className="space-y-1 text-[10px] font-mono">
              <SelRow k="Titular" v={selected.TITULAR_NOMBRE} />
              <SelRow k="Comuna" v={selected.COMUNA} />
              <SelRow k="Hectáreas" v={selected.HECTAREAS} />
              <SelRow k="Tipo" v={selected.TIPO_CONCESION} />
              <SelRow
                k="Situación"
                v={selected.SITUACION_CONCESION}
                color={colorForSituacion(selected.SITUACION_CONCESION)}
              />
            </dl>
            {rolOf(selected) && (
              <Link
                to="/catastro/c/$code"
                params={{ code: rolOf(selected) }}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-mono text-primary hover:underline"
              >
                Ver ficha completa <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}

        {analysisSelection.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg px-3 py-2 flex items-center gap-3 print:hidden">
            <div className="text-[10px] font-mono">
              <strong>{analysisSelection.length}</strong> concesión(es) en análisis
            </div>
            <Link
              to={"/dashboard/catastro" as never}
              className="rounded bg-primary px-2 py-1 text-[10px] font-mono text-primary-foreground"
            >
              Abrir Mining Intelligence
            </Link>
            <button
              type="button"
              onClick={() => setAnalysisSelection([])}
              className="text-[10px] font-mono text-muted-foreground"
            >
              Limpiar
            </button>
          </div>
        )}

        {/* Aviso: bajo el zoom mínimo la capa no se solicita */}
        {needsZoom && !mapError && (
          <div className="absolute top-16 sm:top-3 left-1/2 -translate-x-1/2 z-[400] px-3 py-2 rounded bg-background/95 border border-border text-[11px] font-mono text-foreground backdrop-blur shadow max-w-[90%] text-center print:hidden">
            Acércate (zoom {LAYER_MIN_ZOOM}+) para cargar las concesiones — la capa nacional tiene
            ~103.000 polígonos
          </div>
        )}

        {/* Cargando features */}
        {layerLoading && !needsZoom && (
          <div className="absolute top-16 sm:top-3 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded bg-background/95 border border-border text-[10px] font-mono text-muted-foreground backdrop-blur print:hidden">
            Cargando concesiones SERNAGEOMIN…
          </div>
        )}

        {/* Error del servicio */}
        {mapError && (
          <div className="absolute top-16 sm:top-3 left-1/2 -translate-x-1/2 z-[400] max-w-md px-3 py-2 rounded bg-background/95 border border-danger/50 text-[11px] font-mono text-danger backdrop-blur shadow text-center print:hidden">
            {mapError}
          </div>
        )}

        {/* Leyenda + stats + atribución (visible al imprimir) */}
        <div className="absolute bottom-3 left-3 z-[400] px-2.5 py-2 rounded-lg bg-background/90 border border-border text-[10px] font-mono text-muted-foreground backdrop-blur space-y-1">
          {pais === "CL" ? (
            <>
              <LegendRow color={MAP_COLORS.constituida} label="Constituida" />
              <LegendRow color={MAP_COLORS.tramite} label="En trámite" />
              <LegendRow color={MAP_COLORS.eliminada} label="Eliminada" />
              {featureCount != null && !needsZoom && (
                <div className="pt-1 border-t border-border/60 text-foreground">
                  {featureCount.toLocaleString("es-CL")} concesiones en vista
                </div>
              )}
            </>
          ) : (
            <div className="text-foreground">Simbología oficial de {PAISES[pais].inst}</div>
          )}
          <div className="text-muted-foreground/70">
            {pais === "CL" ? "SERNAGEOMIN v2" : PAISES[pais].inst} · Esri
          </div>
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

function SelRow({ k, v, color }: { k: string; v: unknown; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium truncate" style={color ? { color } : undefined}>
        {v == null || v === "" ? "—" : String(v)}
      </dd>
    </div>
  );
}

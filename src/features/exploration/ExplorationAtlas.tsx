import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Compass, Layers, LocateFixed, Mountain } from "lucide-react";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MLMap, StyleSpecification } from "maplibre-gl";
import { UnifiedProjectScene } from "@/components/geo/UnifiedProjectScene";
import { getTerminalProject } from "@/features/terminal/terminalProjects";
import { getProjectFacts } from "@/lib/projectFacts.functions";
import type { ProjectView } from "@/lib/projects/navigation";
import { validAtlasCentroid, type AtlasProject, type AtlasSlug } from "./atlasPoints";

const SPOTLIGHT = (["cholqui", "losverdes"] as const).flatMap((slug) => {
  const project = getTerminalProject(slug);
  if (!project?.projectId) return [];
  return [
    {
      slug,
      projectId: project.projectId,
      name: project.name,
      commodity: project.ficha.commodity,
      region: project.ficha.region,
    },
  ];
});

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "atlas-esri": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri World Imagery",
    },
    "atlas-topographic": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri World Topographic Map",
    },
  },
  layers: [
    { id: "atlas-satellite", type: "raster", source: "atlas-esri" },
    {
      id: "atlas-topo",
      type: "raster",
      source: "atlas-topographic",
      layout: { visibility: "none" },
    },
  ],
};

function fitAtlasBounds(map: MLMap, projects: AtlasProject[]) {
  const located = projects.filter((project) => project.centroid !== null);
  if (located.length === 0) return;
  if (located.length === 1) {
    map.flyTo({ center: located[0].centroid!, zoom: 9, essential: true });
    return;
  }
  const lngs = located.map((item) => item.centroid![0]);
  const lats = located.map((item) => item.centroid![1]);
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding: 65, maxZoom: 9, duration: 700 },
  );
}

function toFeatures(projects: AtlasProject[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: projects.flatMap((project) =>
      project.centroid
        ? [
            {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: project.centroid },
              properties: { slug: project.slug, name: project.name },
            },
          ]
        : [],
    ),
  };
}

export function ExplorationAtlas() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const fitted = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [selected, setSelected] = useState<AtlasSlug | null>(null);
  const [basemap, setBasemap] = useState<"satellite" | "topo">("satellite");
  const [view, setView] = useState<ProjectView>("2d");

  const fetchFacts = useServerFn(getProjectFacts);
  const query = useQuery({
    queryKey: ["exploration-atlas", SPOTLIGHT.map((project) => project.projectId).join(",")],
    queryFn: () =>
      Promise.all(
        SPOTLIGHT.map((project) => fetchFacts({ data: { projectId: project.projectId } })),
      ),
    staleTime: 5 * 60_000,
  });
  const projects = useMemo<AtlasProject[]>(
    () =>
      SPOTLIGHT.map((project, index) => ({
        ...project,
        centroid: validAtlasCentroid(query.data?.[index]?.centroid),
      })),
    [query.data],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const [maplibre] = await Promise.all([
        import("maplibre-gl"),
        import("maplibre-gl/dist/maplibre-gl.css"),
      ]);
      if (!alive || !mapContainer.current) return;
      const map = new maplibre.Map({
        container: mapContainer.current,
        style: STYLE,
        center: [-70.7, -32.8],
        zoom: 5,
        cooperativeGestures: true,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
      map.once("load", () => {
        if (alive) setMapReady(true);
      });
    })().catch(() => {
      if (alive) setMapError(true);
    });
    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const collection = toFeatures(projects);
    const existing = map.getSource("atlas-project-points") as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(collection);
    } else {
      map.addSource("atlas-project-points", { type: "geojson", data: collection });
      map.addLayer({
        id: "atlas-selected",
        type: "circle",
        source: "atlas-project-points",
        paint: { "circle-radius": 20, "circle-color": "#2B4ACB", "circle-opacity": 0.2 },
        filter: ["==", ["get", "slug"], ""],
      });
      map.addLayer({
        id: "atlas-pins",
        type: "circle",
        source: "atlas-project-points",
        paint: {
          "circle-radius": 9,
          "circle-color": "#2B4ACB",
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2.5,
        },
      });
      map.on("click", "atlas-pins", (event) => {
        const slug = event.features?.[0]?.properties?.slug;
        if (slug === "cholqui" || slug === "losverdes") setSelected(slug);
      });
      map.on("mouseenter", "atlas-pins", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "atlas-pins", () => {
        map.getCanvas().style.cursor = "";
      });
    }
    if (!fitted.current && !query.isLoading && !query.isError) {
      fitAtlasBounds(map, projects);
      fitted.current = true;
    }
  }, [projects, mapReady, query.isLoading, query.isError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setLayoutProperty(
      "atlas-satellite",
      "visibility",
      basemap === "satellite" ? "visible" : "none",
    );
    map.setLayoutProperty("atlas-topo", "visibility", basemap === "topo" ? "visible" : "none");
  }, [basemap, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer("atlas-selected")) return;
    map.setFilter("atlas-selected", ["==", ["get", "slug"], selected ?? ""]);
    const point = projects.find((project) => project.slug === selected);
    if (point?.centroid)
      map.flyTo({ center: point.centroid, zoom: 10, duration: 900, essential: true });
  }, [selected, projects, mapReady]);

  const active = projects.find((project) => project.slug === selected);

  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
            <Compass className="h-4 w-4" /> Proyectos destacados
          </div>
          <p className="text-sm text-content-subtle">
            Selecciona un proyecto para centrar el mapa y abrir su exploración técnica.
          </p>
          {projects.map((project) => (
            <button
              key={project.slug}
              type="button"
              onClick={() => setSelected(project.slug)}
              aria-pressed={selected === project.slug}
              className={`block w-full text-left border bg-surface p-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand ${selected === project.slug ? "border-accent-brand" : "border-hairline hover:border-accent-brand"}`}
            >
              <span className="block font-mono text-[10px] uppercase tracking-wider text-content-subtle">
                {project.commodity} · {project.region}
              </span>
              <span className="mt-2 block font-display text-xl text-content">{project.name}</span>
              <span className="mt-3 flex items-center justify-between text-xs text-accent-brand">
                {project.centroid ? "Explorar ubicación" : "Ver ficha técnica"}
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          ))}
          {query.isLoading && (
            <p role="status" className="text-sm text-content-subtle">
              Consultando coordenadas públicas…
            </p>
          )}
          {query.isError && (
            <div role="alert" className="text-sm text-content-subtle">
              No fue posible cargar los centros georreferenciados.
              <button
                type="button"
                className="ml-2 underline text-accent-brand"
                onClick={() => void query.refetch()}
              >
                Reintentar
              </button>
            </div>
          )}
          <p className="text-[11px] text-content-subtle">
            Solo se muestran ubicaciones presentes en los hechos públicos del proyecto. Sin
            marcadores regionales aproximados.
          </p>
        </aside>
        <div className="border border-hairline bg-surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-hairline">
            <span className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-content-subtle">
              <Mountain className="h-4 w-4 text-accent-brand" /> Chile · Atlas interactivo
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={basemap === "satellite"}
                onClick={() => setBasemap("satellite")}
                className={`px-3 py-2 text-xs border ${basemap === "satellite" ? "border-accent-brand text-accent-brand" : "border-hairline text-content-subtle"}`}
              >
                Satélite
              </button>
              <button
                type="button"
                aria-pressed={basemap === "topo"}
                onClick={() => setBasemap("topo")}
                className={`px-3 py-2 text-xs border ${basemap === "topo" ? "border-accent-brand text-accent-brand" : "border-hairline text-content-subtle"}`}
              >
                Topográfico
              </button>
              <button
                type="button"
                onClick={() => {
                  const map = mapRef.current;
                  if (map) fitAtlasBounds(map, projects);
                  setSelected(null);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs border border-hairline text-content-subtle"
              >
                <LocateFixed className="h-3.5 w-3.5" /> Vista general
              </button>
            </div>
          </div>
          <div className="relative h-[440px] sm:h-[550px]">
            <div
              ref={mapContainer}
              role="region"
              aria-label="Mapa geográfico interactivo de proyectos mineros en Chile"
              className="absolute inset-0"
            />
            {mapError && (
              <div
                role="alert"
                className="absolute inset-0 grid place-items-center bg-surface p-6 text-center text-content-subtle"
              >
                El mapa no pudo inicializarse. Puedes explorar las fichas de proyecto desde las
                tarjetas.
              </div>
            )}
            {!mapReady && !mapError && (
              <div
                role="status"
                className="pointer-events-none absolute inset-0 grid place-items-center bg-surface/90 text-sm text-content-subtle"
              >
                Cargando cartografía…
              </div>
            )}
          </div>
        </div>
      </section>

      {active && (
        <section
          aria-label={`Exploración técnica: ${active.name}`}
          className="space-y-4 border-t border-hairline pt-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-brand">
                Exploración del proyecto
              </p>
              <h2 className="mt-2 font-display text-2xl text-content">{active.name}</h2>
              <p className="text-sm text-content-subtle">
                {active.commodity} · {active.region}
              </p>
            </div>
            <div className="flex gap-2">
              {(["2d", "3d"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                  className={`inline-flex items-center gap-1 px-4 py-2 text-xs border ${view === mode ? "border-accent-brand text-accent-brand" : "border-hairline text-content-subtle"}`}
                >
                  <Layers className="h-3.5 w-3.5" /> {mode.toUpperCase()}
                </button>
              ))}
              <Link
                to="/terminal/$slug"
                params={{ slug: active.slug }}
                search={{ tab: "mapa", view }}
                className="inline-flex items-center gap-1 px-4 py-2 bg-surface-inverse text-white text-xs"
              >
                Abrir terminal <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <UnifiedProjectScene slug={active.slug} view={view} />
          <p className="text-xs text-content-subtle">
            Capas y atributos según procedencia. Anomalías y targets interpretados no son reservas
            certificadas. La información pública puede estar incompleta o sujeta a verificación.
          </p>
        </section>
      )}
    </div>
  );
}

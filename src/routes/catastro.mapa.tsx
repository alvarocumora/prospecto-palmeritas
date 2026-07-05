import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Search, Layers, Building2 } from "lucide-react";
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
          "Mapa interactivo nacional de concesiones mineras de Chile en tiempo real desde SERNAGEOMIN. Busca por titular, RUT o código.",
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

function CatastroMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [needsZoom, setNeedsZoom] = useState(false);
  const [layerLoading, setLayerLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const search = useServerFn(searchConcessions);
  const mutation = useMutation({
    mutationFn: (term: string) => search({ data: { q: term, limit: 20 } }),
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      if (!mapRef.current) return;
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        const EL = await import("esri-leaflet");
        // Abrir sobre el núcleo minero de Coquimbo (Illapel) a zoom con datos,
        // en vez de todo Chile en zoom 5 donde la capa aún no carga.
        const map = L.map(mapRef.current, {
          center: [-31.63, -71.17],
          zoom: 11,
          zoomControl: true,
        });
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Esri · SERNAGEOMIN",
            maxZoom: 19,
          },
        ).addTo(map);
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { opacity: 0.9, maxZoom: 19 },
        ).addTo(map);

        // Capa viva SERNAGEOMIN v2 (ArcGIS Online) — ver src/lib/sngm.ts
        const concesiones = EL.featureLayer({
          url: SNGM_CONCESIONES_URL,
          minZoom: LAYER_MIN_ZOOM,
          precision: 5,
          simplifyFactor: 0.5,
          where: "1=1",
          style: (feature: { properties?: Record<string, unknown> }) => {
            const tipo = String(feature?.properties?.TIPO_CONCESION ?? "").toLowerCase();
            const explor = tipo.includes("explor");
            return {
              color: explor ? "#22d3ee" : "#f97316",
              weight: 1,
              fillColor: explor ? "#22d3ee" : "#f97316",
              fillOpacity: 0.15,
            };
          },
        });
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

        // Estado visible: aviso de zoom, spinner de carga y errores del servicio
        const syncZoomHint = () => setNeedsZoom(map.getZoom() < LAYER_MIN_ZOOM);
        map.on("zoomend", syncZoomHint);
        syncZoomHint();
        concesiones.on("loading", () => setLayerLoading(true));
        concesiones.on("load", () => setLayerLoading(false));
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

  return (
    <PublicCatastroShell>
      <div className="grid lg:grid-cols-[340px_1fr] h-[calc(100vh-3.5rem-1px)]">
        {/* Sidebar */}
        <aside className="border-r border-border bg-bg-secondary/20 overflow-y-auto">
          <div className="p-4 border-b border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim().length >= 2) mutation.mutate(q.trim());
              }}
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Titular, RUT, código…"
                  className="w-full pl-10 pr-3 py-2 rounded border border-border bg-background font-mono text-xs focus:outline-none focus:border-primary"
                />
              </div>
            </form>
          </div>

          <div className="p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Layers className="w-3 h-3" /> Resultados
            </div>
            {mutation.isPending && (
              <div className="text-xs font-mono text-muted-foreground">Buscando…</div>
            )}
            {mutation.data && mutation.data.results.length === 0 && (
              <div className="text-xs font-mono text-muted-foreground">
                Sin resultados en cache. El mapa muestra datos SERNAGEOMIN en vivo.
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
        </aside>

        {/* Mapa */}
        <div className="relative">
          <div ref={mapRef} className="absolute inset-0" />

          {/* Aviso: bajo el zoom mínimo la capa no se solicita */}
          {needsZoom && !mapError && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] px-3 py-2 rounded bg-background/95 border border-border text-[11px] font-mono text-foreground backdrop-blur shadow">
              Acércate (zoom {LAYER_MIN_ZOOM}+) para cargar las concesiones — la capa nacional tiene
              ~103.000 polígonos
            </div>
          )}

          {/* Cargando features */}
          {layerLoading && !needsZoom && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded bg-background/95 border border-border text-[10px] font-mono text-muted-foreground backdrop-blur">
              Cargando concesiones SERNAGEOMIN…
            </div>
          )}

          {/* Error del servicio */}
          {mapError && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] max-w-md px-3 py-2 rounded bg-background/95 border border-danger/50 text-[11px] font-mono text-danger backdrop-blur shadow">
              {mapError}
            </div>
          )}

          {/* Leyenda + atribución */}
          <div className="absolute bottom-3 left-3 z-[400] px-2.5 py-1.5 rounded bg-background/90 border border-border text-[10px] font-mono text-muted-foreground backdrop-blur space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-2.5 rounded-sm border border-cyan-400 bg-cyan-400/20" />
              Exploración
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-2.5 rounded-sm border border-orange-500 bg-orange-500/20" />
              Explotación
            </div>
            <div>Capa viva SERNAGEOMIN v2 · Esri World Imagery</div>
          </div>
        </div>
      </div>
    </PublicCatastroShell>
  );
}

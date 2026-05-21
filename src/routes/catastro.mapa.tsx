import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Search, Layers, Building2 } from "lucide-react";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { searchConcessions } from "@/lib/catastroPublic.functions";

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
        content: "Visualiza todas las concesiones mineras vigentes en Chile sobre cartografía Esri.",
      },
      { rel: "canonical", href: "/catastro/mapa" },
    ],
  }),
  component: CatastroMap,
});

function CatastroMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const search = useServerFn(searchConcessions);
  const mutation = useMutation({
    mutationFn: (term: string) => search({ data: { q: term, limit: 20 } }),
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      if (!mapRef.current) return;
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      const map = L.map(mapRef.current, {
        center: [-30, -70.5],
        zoom: 5,
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

      // Overlay SERNAGEOMIN vivo (capa 0 = explotación, 1 = exploración)
      const explot = L.tileLayer(
        "https://catastro.sernageomin.cl/arcgis/rest/services/Concesiones_Mineras/Concesiones_Mineras/MapServer/tile/{z}/{y}/{x}",
        { opacity: 0.7, maxZoom: 18 },
      );
      explot.addTo(map);

      cleanup = () => map.remove();
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
          <div className="absolute bottom-3 left-3 z-[400] px-2.5 py-1.5 rounded bg-background/90 border border-border text-[10px] font-mono text-muted-foreground backdrop-blur">
            Capa SERNAGEOMIN · Esri World Imagery
          </div>
        </div>
      </div>
    </PublicCatastroShell>
  );
}

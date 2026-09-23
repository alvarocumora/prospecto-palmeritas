import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from "leaflet";
import { Search, Database, MapPinned, ShieldCheck } from "lucide-react";
import { searchMiningCadastre, type CadastreSearch } from "@/lib/cadastre/miningCadastreEngine";
import { buildOfficialCadastreLayer } from "@/components/map/miningCadastreLayers";

export const Route = createFileRoute("/_authenticated/dashboard/catastro")({
  component: MiningCadastrePage,
});

type Filters = Pick<CadastreSearch, "term" | "holder" | "role" | "type" | "status">;

function MiningCadastrePage() {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletGeoJSON | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [count, setCount] = useState(0);
  const [queriedAt, setQueriedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Mueva el mapa o aplique filtros para consultar el catastro oficial.");

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    let disposed = false;
    void import("leaflet").then(({ default: L }) => {
      if (disposed || !mapNode.current) return;
      const map = L.map(mapNode.current).setView([-33.45, -70.67], 7);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Imagery © Esri", maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      void refresh();
      map.on("moveend", () => void refresh());
    });
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  async function refresh(nextFilters = filters) {
    const map = mapRef.current;
    if (!map) return;
    setLoading(true);
    const b = map.getBounds();
    const result = await searchMiningCadastre({
      ...nextFilters,
      bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      limit: 2000,
    });
    const { default: L } = await import("leaflet");
    layerRef.current?.removeFrom(map);
    const layer = buildOfficialCadastreLayer(L as never, result.features);
    layer.addTo(map);
    layerRef.current = layer as LeafletGeoJSON;
    setCount(result.count);
    setQueriedAt(result.queriedAt);
    setMessage(result.count === 2000 ? "Se alcanzó el límite de 2.000 registros: acerque el mapa para completar la consulta." : "Vista sincronizada con la fuente oficial consultada.");
    setLoading(false);
  }

  const set = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value || undefined } as Filters;
    setFilters(next);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-background">
      <header className="border-b border-border px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Database className="w-5 h-5" /><h1 className="text-xl font-semibold">Mining Cadastre Intelligence</h1></div>
          <p className="text-xs text-muted-foreground mt-1">Catastro oficial SERNAGEOMIN + análisis espacial GeoCapitals. La visualización no sustituye acreditación jurídica de dominio.</p>
        </div>
        <div className="text-right text-[10px] font-mono text-muted-foreground">
          <div>SOURCE · SERNAGEOMIN</div>
          <div>{queriedAt ? new Date(queriedAt).toLocaleString("es-CL") : "SIN CONSULTA"}</div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[330px_minmax(0,1fr)] flex-1 min-h-0">
        <aside className="border-r border-border p-4 overflow-y-auto space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider"><Search className="w-4 h-4" /> Buscar concesiones</div>
          <input className="w-full rounded border border-border bg-background px-3 py-2 text-sm" placeholder="Nombre concesión" value={filters.term ?? ""} onChange={e=>set("term",e.target.value)} />
          <input className="w-full rounded border border-border bg-background px-3 py-2 text-sm" placeholder="Titular" value={filters.holder ?? ""} onChange={e=>set("holder",e.target.value)} />
          <input className="w-full rounded border border-border bg-background px-3 py-2 text-sm" placeholder="Rol nacional" value={filters.role ?? ""} onChange={e=>set("role",e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className="rounded border border-border bg-background px-2 py-2 text-xs" value={filters.type ?? ""} onChange={e=>set("type",e.target.value)}>
              <option value="">Todos los tipos</option><option value="EXPLOTACION">Explotación</option><option value="EXPLORACION">Exploración</option>
            </select>
            <select className="rounded border border-border bg-background px-2 py-2 text-xs" value={filters.status ?? ""} onChange={e=>set("status",e.target.value)}>
              <option value="">Todos los estados</option><option value="CONSTITUIDA">Constituida</option><option value="EN TRAMITE">En trámite</option>
            </select>
          </div>
          <button type="button" onClick={()=>void refresh(filters)} disabled={loading} className="w-full rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">{loading ? "Consultando…" : "Consultar vista"}</button>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-border p-3"><div className="text-[10px] text-muted-foreground">REGISTROS EN VISTA</div><div className="text-2xl font-semibold">{count.toLocaleString("es-CL")}</div></div>
            <div className="rounded border border-border p-3"><div className="text-[10px] text-muted-foreground">PROCEDENCIA</div><div className="mt-1 text-xs font-mono">OFICIAL</div></div>
          </div>
          <div className="rounded border border-border p-3 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="w-4 h-4 mb-2" />{message}</div>
          <div className="text-[10px] leading-relaxed text-muted-foreground">GeoCapitals conserva fuente y timestamp. Las geometrías se muestran en WGS84; la concesión puede tener datum/huso original distinto. El registro oficial no equivale por sí solo a verificación legal de dominio.</div>
        </aside>

        <main className="relative min-h-[600px]">
          <div ref={mapNode} className="absolute inset-0" />
          <div className="absolute top-3 right-3 z-[500] rounded bg-background/95 border border-border px-3 py-2 text-[10px] font-mono shadow">
            <MapPinned className="inline w-3 h-3 mr-1" /> AOI = EXTENSIÓN VISIBLE
          </div>
        </main>
      </div>
    </div>
  );
}

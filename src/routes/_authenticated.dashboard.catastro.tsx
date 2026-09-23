import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from "leaflet";
import { Search, Database, MapPinned, ShieldCheck, Layers3, X, Upload, ScanSearch } from "lucide-react";
import { searchMiningCadastre, cadastreRecords, summarizeCadastre, type CadastreSearch, type CadastreFeatureRecord } from "@/lib/cadastre/miningCadastreEngine";
import { buildOfficialCadastreLayer } from "@/components/map/miningCadastreLayers";
import { buildReconciliationBundle, type ReconciliationBundle } from "@/lib/cadastre/reconciliationBundle";
import { buildReconciliationLayer } from "@/lib/cadastre/reconciliationLayer";
import { buildCadastreDueDiligence } from "@/lib/cadastre/dueDiligence";

export const Route = createFileRoute("/_authenticated/dashboard/catastro")({
  component: MiningCadastrePage,
});

type Filters = Pick<CadastreSearch, "term" | "holder" | "role" | "type" | "status">;

function MiningCadastrePage() {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletGeoJSON | null>(null);
  const projectLayerRef = useRef<LeafletGeoJSON | null>(null);
  const reconciliationLayerRef = useRef<LeafletGeoJSON | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [records, setRecords] = useState<CadastreFeatureRecord[]>([]);
  const [selected, setSelected] = useState<CadastreFeatureRecord | null>(null);
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [officialFc, setOfficialFc] = useState<GeoJSON.FeatureCollection>({ type:"FeatureCollection", features:[] });
  const [projectFc, setProjectFc] = useState<GeoJSON.FeatureCollection | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationBundle | null>(null);
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
    setOfficialFc(result.features);
    const normalized = cadastreRecords(result.features);
    setRecords(normalized);
    setQueriedAt(result.queriedAt);
    setMessage(result.count === 2000 ? "Se alcanzó el límite de 2.000 registros: acerque el mapa para completar la consulta." : "Vista sincronizada con la fuente oficial consultada.");
    setLoading(false);
  }

  const stats = summarizeCadastre(records);
  const portfolioRecords = records.filter(r => portfolio.includes(r.id));
  const portfolioStats = summarizeCadastre(portfolioRecords);
  const focus = (record: CadastreFeatureRecord) => {
    setSelected(record);
    const map = mapRef.current;
    if (!map || !record.feature.geometry) return;
    void import("leaflet").then(({ default: L }) => {
      try { map.fitBounds(L.geoJSON(record.feature as never).getBounds(), { padding: [60, 60], maxZoom: 15 }); } catch { /* keep current view */ }
    });
  };
  const togglePortfolio = (id: string) => setPortfolio(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  async function importGeoJSON(file: File) {
    try {
      const raw = JSON.parse(await file.text()) as GeoJSON.FeatureCollection | GeoJSON.Feature;
      const fc: GeoJSON.FeatureCollection = raw.type === "FeatureCollection"
        ? raw
        : raw.type === "Feature" ? { type:"FeatureCollection", features:[raw] } : { type:"FeatureCollection", features:[] };
      const polygons = fc.features.filter(f => f.geometry && ["Polygon","MultiPolygon"].includes(f.geometry.type));
      if (!polygons.length) { setMessage("El archivo no contiene polígonos GeoJSON válidos."); return; }
      const clean: GeoJSON.FeatureCollection = { type:"FeatureCollection", features:polygons };
      setProjectFc(clean); setProjectName(file.name); setReconciliation(null);
      const map = mapRef.current; if (!map) return;
      const { default: L } = await import("leaflet");
      projectLayerRef.current?.removeFrom(map);
      reconciliationLayerRef.current?.removeFrom(map);
      const layer = L.geoJSON(clean as never, { style:{ color:"#a855f7", weight:3, fillOpacity:0.08, dashArray:"7 4" } }).addTo(map);
      projectLayerRef.current = layer;
      map.fitBounds(layer.getBounds(), { padding:[50,50] });
      setMessage(`${polygons.length} polígono(s) importados. Actualice el catastro en esta vista y ejecute reconciliación.`);
    } catch { setMessage("No fue posible leer el GeoJSON. Verifique formato y geometrías."); }
  }

  async function runReconciliation() {
    const map = mapRef.current;
    if (!map || !projectFc || officialFc.features.length === 0) { setMessage("Importe una propiedad y consulte el catastro oficial del área antes de reconciliar."); return; }
    const bundle = buildReconciliationBundle(projectFc, officialFc, 5);
    setReconciliation(bundle);
    const { default: L } = await import("leaflet");
    reconciliationLayerRef.current?.removeFrom(map);
    const layer = buildReconciliationLayer(L as never, bundle).addTo(map);
    reconciliationLayerRef.current = layer as LeafletGeoJSON;
    setMessage("Reconciliación completada. Revise matches, intersecciones, vecinos y geometrías sin correspondencia.");
  }

  const dueDiligence = reconciliation ? buildCadastreDueDiligence(reconciliation) : null;

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

      <div className="grid lg:grid-cols-[330px_minmax(0,1fr)_360px] flex-1 min-h-0">
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
            <div className="rounded border border-border p-3"><div className="text-[10px] text-muted-foreground">REGISTROS EN VISTA</div><div className="text-2xl font-semibold">{stats.count.toLocaleString("es-CL")}</div></div>
            <div className="rounded border border-border p-3"><div className="text-[10px] text-muted-foreground">PROCEDENCIA</div><div className="mt-1 text-xs font-mono">OFICIAL</div></div>
          </div>
          <div className="rounded border border-border p-3 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="w-4 h-4 mb-2" />{message}</div>
          {dueDiligence && <div className="rounded border border-border p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase">Due Diligence · hallazgos</div>
            {dueDiligence.findings.map(f => <div key={f.code} className="text-[10px] leading-relaxed"><strong>{f.severity}</strong> · {f.message}</div>)}
            <div className="text-[9px] text-muted-foreground">{dueDiligence.disclaimer}</div>
          </div>}
          <div className="text-[10px] leading-relaxed text-muted-foreground">GeoCapitals conserva fuente y timestamp. Las geometrías se muestran en WGS84; la concesión puede tener datum/huso original distinto. El registro oficial no equivale por sí solo a verificación legal de dominio.</div>
        </aside>

        <main className="relative min-h-[600px]">
          <div ref={mapNode} className="absolute inset-0" />
          <div className="absolute top-3 right-3 z-[500] rounded bg-background/95 border border-border px-3 py-2 text-[10px] font-mono shadow">
            <MapPinned className="inline w-3 h-3 mr-1" /> AOI = EXTENSIÓN VISIBLE
          </div>
        </main>

        <aside className="border-l border-border bg-background overflow-y-auto">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider"><Layers3 className="w-4 h-4" /> Resultados oficiales</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded border border-border p-2"><div className="text-lg font-semibold">{stats.count}</div><div className="text-[9px] text-muted-foreground">REGISTROS</div></div>
              <div className="rounded border border-border p-2"><div className="text-lg font-semibold">{Math.round(stats.hectares).toLocaleString("es-CL")}</div><div className="text-[9px] text-muted-foreground">HA DECL.</div></div>
              <div className="rounded border border-border p-2"><div className="text-lg font-semibold">{portfolio.length}</div><div className="text-[9px] text-muted-foreground">SELECCIÓN</div></div>
            </div>
            {portfolio.length > 0 && <div className="mt-2 rounded border border-primary/30 p-2 text-[10px]">Portafolio visible: {portfolioStats.count} concesiones · {Math.round(portfolioStats.hectares).toLocaleString("es-CL")} ha declaradas</div>}
          </div>

          {selected && <div className="p-4 border-b border-border bg-muted/20">
            <div className="flex justify-between gap-2"><div><div className="text-[10px] font-mono text-muted-foreground">FICHA OFICIAL</div><h2 className="font-semibold">{selected.name}</h2></div><button onClick={()=>setSelected(null)}><X className="w-4 h-4"/></button></div>
            <dl className="mt-3 grid grid-cols-[95px_1fr] gap-y-1 text-xs">
              <dt className="text-muted-foreground">Rol</dt><dd>{selected.role}</dd>
              <dt className="text-muted-foreground">Titular</dt><dd>{selected.holder}</dd>
              <dt className="text-muted-foreground">Tipo</dt><dd>{selected.type}</dd>
              <dt className="text-muted-foreground">Situación</dt><dd>{selected.status}</dd>
              <dt className="text-muted-foreground">Superficie</dt><dd>{selected.hectares?.toLocaleString("es-CL") ?? "—"} ha</dd>
              <dt className="text-muted-foreground">Comuna</dt><dd>{selected.commune}</dd>
              <dt className="text-muted-foreground">Datum / huso</dt><dd>{selected.datum} / {selected.zone}</dd>
            </dl>
            <button className="mt-3 w-full rounded border border-border px-2 py-2 text-xs" onClick={()=>togglePortfolio(selected.id)}>{portfolio.includes(selected.id) ? "Quitar de selección" : "Agregar a selección"}</button>
          </div>}

          <div className="divide-y divide-border">
            {records.slice(0, 300).map(record => <button key={record.id} type="button" onClick={()=>focus(record)} className="w-full p-3 text-left hover:bg-muted/30">
              <div className="flex justify-between gap-2"><strong className="text-xs truncate">{record.name}</strong><span className="text-[9px] font-mono">{record.role}</span></div>
              <div className="mt-1 text-[10px] text-muted-foreground truncate">{record.holder}</div>
              <div className="mt-1 flex gap-2 text-[9px] font-mono text-muted-foreground"><span>{record.type}</span><span>·</span><span>{record.status}</span><span>·</span><span>{record.hectares ?? "—"} ha</span></div>
            </button>)}
            {records.length > 300 && <div className="p-3 text-[10px] text-muted-foreground">Mostrando 300 de {records.length} resultados en el listado. Todos los polígonos consultados permanecen visibles en el mapa.</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}

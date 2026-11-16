// Mesa de trabajo catastral unificada dentro de /catastro/mapa:
// Pedimento (geometría sobre la vista actual + escrito borrador + minuta OJV),
// Prelación (semáforo SERNAGEOMIN · Boletín · OJV) y Boletín (publicaciones en vista).
// Todo se calcula sobre datos reales; vacancia y prelación son INDICATIVAS.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { FileText, Copy, Download, Loader2, Ruler, Scale, Newspaper, X, Crosshair } from "lucide-react";
import { toast } from "sonner";
import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import { proposePedimentoOnAoi } from "@/lib/pedimento.functions";
import type { PedimentoResult } from "@/lib/pedimentoGeometry";
import { downloadPedimentoEscrito, type EscritoDatos } from "@/lib/pedimentoEscritoPdf";
import { suggestTribunal } from "@/lib/cadastre/tribunales";
import { pedimentoGeoJson, pedimentoKml, downloadText } from "@/lib/cadastre/pedimentoExport";
import { PriorityCheckPanel } from "@/features/catastro-priority/PriorityCheckPanel";
import { useMiningBulletins } from "@/hooks/useMiningBulletins";

type Tab = "pedimento" | "prelacion" | "boletin";
const PED_SRC = "wb-pedimento";
const BOL_SRC = "wb-boletin";

function ensureLayers(map: MLMap) {
  if (!map.getSource(PED_SRC)) {
    map.addSource(PED_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: `${PED_SRC}-fill`, type: "fill", source: PED_SRC, paint: { "fill-color": "#c2410c", "fill-opacity": 0.22 } });
    map.addLayer({ id: `${PED_SRC}-line`, type: "line", source: PED_SRC, paint: { "line-color": "#c2410c", "line-width": 3 } });
  }
  if (!map.getSource(BOL_SRC)) {
    map.addSource(BOL_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: `${BOL_SRC}-pt`, type: "circle", source: BOL_SRC,
      paint: { "circle-radius": 7, "circle-color": "#b45309", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2, "circle-opacity": 0.9 },
    });
  }
}

export function ojvVertexText(p: PedimentoResult) {
  const r = (n: number) => Math.round(n).toLocaleString("es-CL");
  const order = ["NW", "NE", "SE", "SW"] as const;
  const lines = order.map((k, i) => `V${i + 1} (${k})\tN ${r(p.cornersUtm[k][1])}\tE ${r(p.cornersUtm[k][0])}`);
  return [
    `Datum ${p.datum} · Huso ${p.huso}S`,
    ...lines,
    `Lados: N-S ${r(p.ladosM["N-S"])} m · E-W ${r(p.ladosM["E-W"])} m`,
    `Superficie: ${p.areaHa.toLocaleString("es-CL", { maximumFractionDigits: 0 })} ha`,
    `Cara norte (centro): N ${r(p.caraNorteUtm.N)} E ${r(p.caraNorteUtm.E_centro)}`,
  ].join("\n");
}

export function CatastroWorkbench({ map, onClose }: { map: MLMap | null; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("pedimento");
  const [busy, setBusy] = useState(false);
  const [ped, setPed] = useState<PedimentoResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [datos, setDatos] = useState<EscritoDatos>({});
  const setD = (k: keyof EscritoDatos) => (e: React.ChangeEvent<HTMLInputElement>) => setDatos((p) => ({ ...p, [k]: e.target.value }));
  const propose = useServerFn(proposePedimentoOnAoi);
  const { data: bulletins, loading: bLoading } = useMiningBulletins(500, bounds);

  useEffect(() => {
    if (!map) return;
    const upd = () => {
      const c = map.getCenter();
      const b = map.getBounds();
      setCenter({ lat: c.lat, lng: c.lng });
      setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    const init = () => { ensureLayers(map); upd(); };
    if (map.isStyleLoaded()) init(); else map.once("load", init);
    map.on("moveend", upd);
    map.on("styledata", () => ensureLayers(map));
    return () => { map.off("moveend", upd); };
  }, [map]);

  const inView = useMemo(() => {
    if (!bounds) return [];
    const [w, s, e, n] = bounds;
    return bulletins.filter(
      (b) => b.centroid_lat != null && b.centroid_lng != null &&
        b.centroid_lng >= w && b.centroid_lng <= e && b.centroid_lat >= s && b.centroid_lat <= n,
    );
  }, [bulletins, bounds]);

  // Comuna sugerida: la solicitud del catastro más cercana al centro del pedimento (dato real).
  const comunaSugerida = useMemo(() => {
    if (!ped) return null;
    const c = ped.rectangleWgs84.geometry.coordinates[0];
    const lng = (c[0][0] + c[2][0]) / 2, lat = (c[0][1] + c[2][1]) / 2;
    let best: { d: number; comuna: string } | null = null;
    for (const b of bulletins) {
      if (!b.comuna || b.centroid_lat == null || b.centroid_lng == null) continue;
      const d = (b.centroid_lat - lat) ** 2 + (b.centroid_lng - lng) ** 2;
      if (!best || d < best.d) best = { d, comuna: b.comuna };
    }
    return best && best.d < 0.04 ? best.comuna : null;
  }, [ped, bulletins]);

  useEffect(() => {
    if (!comunaSugerida) return;
    setDatos((p) => p.comuna ? p : { ...p, comuna: comunaSugerida, tribunal: p.tribunal || (suggestTribunal(comunaSugerida).known ? suggestTribunal(comunaSugerida).tribunal : "") });
  }, [comunaSugerida]);

  const trib = suggestTribunal(datos.comuna);

  useEffect(() => {
    const src = map?.getSource(BOL_SRC) as GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: inView.map((b) => ({
        type: "Feature", properties: { id: b.id },
        geometry: { type: "Point", coordinates: [b.centroid_lng!, b.centroid_lat!] },
      })),
    });
  }, [inView, map]);

  useEffect(() => {
    const src = map?.getSource(PED_SRC) as GeoJSONSource | undefined;
    src?.setData(ped ? { type: "FeatureCollection", features: [ped.rectangleWgs84] } : { type: "FeatureCollection", features: [] });
  }, [ped, map]);

  const runPedimento = async () => {
    if (!map || !bounds) return;
    const [w, s, e, n] = bounds;
    // AOI = 70 % central de la vista
    const dx = (e - w) * 0.15, dy = (n - s) * 0.15;
    const aoi = { type: "Polygon" as const, coordinates: [[[w + dx, s + dy], [e - dx, s + dy], [e - dx, n - dy], [w + dx, n - dy], [w + dx, s + dy]]] };
    if ((e - w) > 0.6) { setErr("Acerca el mapa (vista < ~60 km) para trazar el pedimento."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await propose({ data: { aoi } });
      if (!r.ok) { setErr(r.error); setPed(null); return; }
      setPed(r.result);
      if (!r.result) setErr("No cabe un pedimento vacante en esta vista.");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error al calcular");
    } finally { setBusy(false); }
  };

  const tabBtn = (t: Tab, label: string, Icon: typeof Ruler) => (
    <button type="button" onClick={() => setTab(t)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border-b-2 ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );

  return (
    <div className="flex flex-col h-full rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Herramientas catastrales</span>
        <button type="button" onClick={onClose} aria-label="Cerrar herramientas" className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex border-b border-border">
        {tabBtn("pedimento", "Pedimento", Ruler)}
        {tabBtn("prelacion", "Prelación", Scale)}
        {tabBtn("boletin", `Boletín${inView.length ? ` (${inView.length})` : ""}`, Newspaper)}
      </div>
      <div className="flex-1 overflow-y-auto text-sm">
        {tab === "pedimento" && (
          <div className="p-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Encuadra el sector y calcula el mayor rectángulo N-S/E-W vacante (máx. 5.000 ha) contra el catastro SERNAGEOMIN en vivo. Vacancia indicativa: confirmar en OJV.
            </p>
            <button type="button" onClick={runPedimento} disabled={busy || !map}
              className="w-full flex items-center justify-center gap-2 rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
              {busy ? "Calculando…" : "Trazar pedimento en esta vista"}
            </button>
            {err && <div className="text-xs text-destructive">{err}</div>}
            {ped && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-border p-2"><div className="text-muted-foreground">Superficie</div><div className="font-semibold">{ped.areaHa.toLocaleString("es-CL", { maximumFractionDigits: 0 })} ha</div></div>
                  <div className="rounded border border-border p-2"><div className="text-muted-foreground">Huso / datum</div><div className="font-semibold">{ped.huso}S · {ped.datum}</div></div>
                </div>
                <div className="rounded border border-border p-2 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Datos del escrito</div>
                  {([
                    ["nombre", "Nombre del peticionario"], ["rut", "RUT"], ["nacionalidad", "Nacionalidad"],
                    ["profesion", "Profesión u oficio"], ["domicilio", "Domicilio"], ["concesion", "Nombre de la concesión"],
                    ["comuna", "Comuna"], ["region", "Región"], ["tribunal", "Tribunal"],
                  ] as const).map(([k, label]) => (
                    <input key={k} aria-label={label} placeholder={label} value={datos[k] ?? ""} onChange={setD(k)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-xs" />
                  ))}
                  {datos.comuna && (
                    <div className="text-[10px] text-muted-foreground">
                      {trib.known ? <>Tribunal sugerido: <button type="button" className="underline" onClick={() => setDatos((p) => ({ ...p, tribunal: trib.tribunal }))}>{trib.tribunal}</button> · verificar en OJV</> : "Sin tribunal conocido para esta comuna: complétalo a mano."}
                      {comunaSugerida && datos.comuna === comunaSugerida && " · comuna tomada de la solicitud más cercana del catastro."}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">Los campos vacíos quedan como [POR COMPLETAR] en el escrito.</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => downloadText(pedimentoKml(ped, datos.concesion || undefined), `pedimento-${ped.areaHa}ha.kml`, "application/vnd.google-earth.kml+xml")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded border border-border px-2 py-1.5 text-xs hover:bg-muted"><Download className="w-3.5 h-3.5" />KML (Google Earth)</button>
                  <button type="button" onClick={() => downloadText(pedimentoGeoJson(ped, datos.concesion || undefined), `pedimento-${ped.areaHa}ha.geojson`, "application/geo+json")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded border border-border px-2 py-1.5 text-xs hover:bg-muted"><Download className="w-3.5 h-3.5" />GeoJSON (QGIS)</button>
                </div>
                <pre className="rounded border border-border bg-muted/40 p-2 text-[10px] font-mono whitespace-pre-wrap">{ojvVertexText(ped)}</pre>
                <div className="text-[10px] text-muted-foreground">{ped.concessionsChecked} concesiones revisadas.</div>
                <div className="grid grid-cols-1 gap-1.5">
                  <button type="button" onClick={() => { navigator.clipboard.writeText(ojvVertexText(ped)); toast.success("Vértices copiados para OJV"); }}
                    className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"><Copy className="w-3.5 h-3.5" />Copiar minuta de vértices (OJV)</button>
                  <button type="button" onClick={() => downloadPedimentoEscrito(ped, "pedimento", datos)}
                    className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"><FileText className="w-3.5 h-3.5" />Escrito borrador · pedimento (exploración)</button>
                  <button type="button" onClick={() => downloadPedimentoEscrito(ped, "manifestacion", datos)}
                    className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"><FileText className="w-3.5 h-3.5" />Escrito borrador · manifestación (explotación)</button>
                  <button type="button" onClick={() => setTab("prelacion")}
                    className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"><Scale className="w-3.5 h-3.5" />Revisar prelación de este sector</button>
                </div>
                <p className="text-[10px] text-muted-foreground">Borrador para abogado de minería; datos del peticionario quedan [POR COMPLETAR].</p>
              </div>
            )}
          </div>
        )}
        {tab === "prelacion" && center && (
          <PriorityCheckPanel key={`${center.lat.toFixed(4)},${center.lng.toFixed(4)}`} initialLat={center.lat} initialLng={center.lng} />
        )}
        {tab === "boletin" && (
          <div className="p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Publicaciones del Boletín Oficial de Minería con ubicación dentro de la vista (puntos ámbar en el mapa). Publicar no fija prioridad: manda el ingreso judicial.</p>
            {bLoading && <div className="text-xs text-muted-foreground">Cargando…</div>}
            {!bLoading && inView.length === 0 && (
              <div className="text-xs text-muted-foreground">Sin publicaciones georreferenciadas en esta vista.</div>
            )}
            <ul className="space-y-1.5">
              {inView.slice(0, 60).map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => map?.flyTo({ center: [b.centroid_lng!, b.centroid_lat!], zoom: Math.max(map.getZoom(), 13) })}
                    className="w-full text-left rounded border border-border p-2 hover:bg-muted">
                    <div className="flex justify-between text-[10px] font-mono uppercase text-muted-foreground"><span>{b.publication_type}</span><span>{b.publication_date ?? "s/f"}</span></div>
                    <div className="text-xs font-medium">{b.concession_name ?? "Sin nombre"}</div>
                    <div className="text-[10px] text-muted-foreground">{b.holder_name ?? "Titular s/d"}{b.comuna ? ` · ${b.comuna}` : ""}</div>
                  </button>
                </li>
              ))}
            </ul>
            <Link to="/dashboard/boletin" className="block text-xs text-primary underline pt-1">Ver alertas y trámites completos</Link>
          </div>
        )}
      </div>
    </div>
  );
}

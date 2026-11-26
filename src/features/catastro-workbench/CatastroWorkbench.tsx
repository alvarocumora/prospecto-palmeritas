// Mesa de trabajo catastral unificada dentro de /catastro/mapa:
// Pedimento (geometría sobre la vista actual + escrito borrador + minuta OJV),
// Prelación (semáforo SERNAGEOMIN · Boletín · OJV) y Boletín (publicaciones en vista).
// Todo se calcula sobre datos reales; vacancia y prelación son INDICATIVAS.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { FileText, Copy, Download, Loader2, Ruler, Scale, Newspaper, X, CalendarClock, Satellite, ShieldAlert, BookmarkPlus, Briefcase } from "lucide-react";
import { toast } from "sonner";
import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import { proposePedimentoOnAoi } from "@/lib/pedimento.functions";
import type { PedimentoResult } from "@/lib/pedimentoGeometry";
import { downloadPedimentoEscrito, type EscritoDatos } from "@/lib/pedimentoEscritoPdf";
import { PRESET_VALLE_ESCONDIDO } from "@/lib/cadastre/escritoPresets";
import { suggestTribunal } from "@/lib/cadastre/tribunales";
import { pedimentoGeoJson, pedimentoKml, downloadText } from "@/lib/cadastre/pedimentoExport";
import { PriorityCheckPanel } from "@/features/catastro-priority/PriorityCheckPanel";
import { useMiningBulletins } from "@/hooks/useMiningBulletins";
import { DesignerPanel, type DesignerHandle } from "./DesignerPanel";
import { SpectralPanel } from "./SpectralPanel";
import { OwnCasesPanel } from "./OwnCasesPanel";
import { LegalTramiteModal } from "./LegalTramiteModal";
import { downloadEscritoDocx } from "@/lib/cadastre/escritoDocx";
import { pedimentoInDatum, utmToLngLat, PSAD56_NOTE, type Datum } from "@/lib/cadastre/datum";
import { loadCases, saveCases, overlapsWithOwn, type OwnCase } from "@/lib/cadastre/ownCases";
import { ENAMI_ANTECEDENTS } from "@/lib/cadastre/enamiAntecedents";

type Tab = "pedimento" | "prelacion" | "boletin" | "causas";
const ENAMI_SRC = "wb-enami";
const PED_SRC = "wb-pedimento";
const BOL_SRC = "wb-boletin";

function ensureLayers(map: MLMap) {
  if (!map.getSource(PED_SRC)) {
    map.addSource(PED_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: `${PED_SRC}-fill`, type: "fill", source: PED_SRC, paint: { "fill-color": "#c2410c", "fill-opacity": 0.22 } });
    map.addLayer({ id: `${PED_SRC}-line`, type: "line", source: PED_SRC, paint: { "line-color": "#c2410c", "line-width": 3 } });
  }
  if (!map.getSource(ENAMI_SRC)) {
    map.addSource(ENAMI_SRC, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: ENAMI_ANTECEDENTS.map((a) => ({
          type: "Feature", properties: { name: `${a.name} · ENAMI` },
          geometry: { type: "Point", coordinates: utmToLngLat(a.e, a.n, 19, "WGS84") },
        })),
      },
    });
    map.addLayer({ id: `${ENAMI_SRC}-pt`, type: "circle", source: ENAMI_SRC, paint: { "circle-radius": 8, "circle-color": "#ca8a04", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
    map.addLayer({ id: `${ENAMI_SRC}-lbl`, type: "symbol", source: ENAMI_SRC, minzoom: 10, layout: { "text-field": ["get", "name"], "text-size": 11, "text-offset": [0, 1.4] }, paint: { "text-color": "#ffffff", "text-halo-color": "#1e293b", "text-halo-width": 1.5 } });
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
  const [seed, setSeed] = useState<{ bbox: [number, number, number, number]; label: string } | null>(null);
  const [meta, setMeta] = useState<DesignerHandle>({ kind: "pedimento", pertenencias: [] });
  const [datum, setDatum] = useState<Datum>("WGS84");
  const [own, setOwn] = useState<OwnCase[]>([]);
  const [legalOpen, setLegalOpen] = useState(false);
  useEffect(() => setOwn(loadCases()), [tab]);
  const pedOut = useMemo(() => (ped ? pedimentoInDatum(ped, datum) : null), [ped, datum]);
  const ownHits = useMemo(() => (ped ? overlapsWithOwn(ped.rectangleWgs84, own) : []), [ped, own]);
  const saveAsOwn = () => {
    if (!ped) return;
    const name = (datos.concesion || "").trim() || `DISEÑO ${new Date().toISOString().slice(0, 10)}`;
    const rit = window.prompt("Rol / RIT asignado (deja vacío si aún no se ingresa):", "") || null;
    const next: OwnCase[] = [...loadCases(), {
      id: `${Date.now()}`, name, rit, court: datos.tribunal || null, filedAt: new Date().toISOString().slice(0, 10),
      ha: ped.areaHa, decision: "pagar", paid: false, geometry: ped.rectangleWgs84,
    }];
    saveCases(next); setOwn(next); toast.success(`${name} guardada en Mis causas`);
  };
  const auditSat = () => {
    if (!map || !ped) return;
    window.dispatchEvent(new CustomEvent("catastro:basemap", { detail: "satelite" }));
    const c = ped.rectangleWgs84.geometry.coordinates[0];
    const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 40, maxZoom: 17 });
  };
  const earthUrl = () => {
    if (!ped) return "#";
    const c = ped.rectangleWgs84.geometry.coordinates[0];
    return `https://earth.google.com/web/@${((c[0][1] + c[2][1]) / 2).toFixed(5)},${((c[0][0] + c[2][0]) / 2).toFixed(5)},800a,3000d,35y,0h,0t,0r`;
  };
  useEffect(() => {
    const onSeed = (e: Event) => {
      const d = (e as CustomEvent<{ bbox: [number, number, number, number]; label: string }>).detail;
      setTab("pedimento");
      setSeed(d);
    };
    window.addEventListener("catastro:design-from", onSeed);
    return () => window.removeEventListener("catastro:design-from", onSeed);
  }, []);
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
    upd();
    if (map.isStyleLoaded()) init(); else map.once("idle", init);
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
        {tabBtn("causas", "Mis causas", CalendarClock)}
      </div>
      <div className="flex-1 overflow-y-auto text-sm">
        {tab === "pedimento" && (
          <div className="p-3 space-y-3">
            <DesignerPanel map={map} ped={ped} setPed={setPed} runAuto={runPedimento} busy={busy} seedBbox={seed} onMeta={setMeta} />
            {err && <div className="text-xs text-destructive">{err}</div>}
            {ped && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-border p-2"><div className="text-muted-foreground">Superficie</div><div className="font-semibold">{(meta.kind === "manifestacion" && meta.pertenencias.length ? meta.pertenencias.reduce((a, r) => a + ((r.e - r.w) * (r.n - r.s)) / 10000, 0) : ped.areaHa).toLocaleString("es-CL", { maximumFractionDigits: 0 })} ha</div></div>
                  <div className="rounded border border-border p-2"><div className="text-muted-foreground">Huso / datum</div><div className="font-semibold">{ped.huso}S · {ped.datum}</div></div>
                </div>
                {ownHits.length > 0 && (
                  <div className="rounded border border-destructive p-2 text-xs text-destructive flex gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <div>Pisa una causa propia: {ownHits.map((h) => `${h.name} (${h.rit ?? "s/rol"}, ${h.ha} ha)`).join(" · ")}. Evita pagar dos tasas por el mismo terreno.</div>
                  </div>
                )}
                <div className="rounded border border-border p-2 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">¿Hay faena dentro?</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={auditSat} className="flex-1 flex items-center justify-center gap-1.5 rounded border border-border px-2 py-1.5 text-xs hover:bg-muted"><Satellite className="w-3.5 h-3.5" />Ver bloque en satélite</button>
                    <a href={earthUrl()} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center rounded border border-border px-2 py-1.5 text-xs hover:bg-muted">Abrir en Google Earth</a>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Confirma cortes, rajos, desmontes o caminos mineros dentro del polígono antes de firmar. Puntos dorados: eliminadas con entregas a ENAMI.</p>
                </div>
                <SpectralPanel map={map} ped={ped} />
                {meta.kind === "manifestacion" && meta.pertenencias.length > 0 && (
                  <details className="rounded border border-border p-2 text-[10px] font-mono">
                    <summary className="cursor-pointer text-xs font-sans">Pertenencias ({meta.pertenencias.length})</summary>
                    {meta.pertenencias.map((r, i) => (
                      <div key={i}>P{i + 1}: SW N {Math.round(r.s).toLocaleString("es-CL")} E {Math.round(r.w).toLocaleString("es-CL")} · {(r.e - r.w)}×{(r.n - r.s)} m · {((r.e - r.w) * (r.n - r.s)) / 10000} ha</div>
                    ))}
                  </details>
                )}
                <div className="rounded border border-border p-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Datos del escrito</div>
                    <button type="button" className="text-[10px] underline" onClick={() => setDatos((p) => ({ ...p, ...PRESET_VALLE_ESCONDIDO }))}>Usar Valle Escondido SpA</button>
                  </div>
                  {datos.representada && <p className="text-[10px] text-muted-foreground">p.p. {datos.representada} · RUT {datos.rutRepresentada} · notif. {datos.email}</p>}
                  {([
                    ["nombre", "Nombre del peticionario"], ["rut", "RUT"], ["nacionalidad", "Nacionalidad"],
                    ["profesion", "Profesión u oficio"], ["domicilio", "Domicilio"], ["concesion", "Nombre de la concesión"],
                    ["sector", "Sector (ej. Tilama)"], ["comuna", "Comuna"], ["provincia", "Provincia"], ["region", "Región (ej. de Coquimbo)"], ["tribunal", "Tribunal"],
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
                <div className="flex rounded border border-border overflow-hidden text-xs">
                  {(["WGS84", "PSAD56"] as const).map((d) => (
                    <button key={d} type="button" onClick={() => setDatum(d)} className={`flex-1 py-1 ${datum === d ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>{d}</button>
                  ))}
                </div>
                <pre className="rounded border border-border bg-muted/40 p-2 text-[10px] font-mono whitespace-pre-wrap">{ojvVertexText(pedOut!)}</pre>
                {datum === "PSAD56" && <p className="text-[10px] text-muted-foreground">{PSAD56_NOTE}</p>}
                <div className="text-[10px] text-muted-foreground">{ped.concessionsChecked} concesiones revisadas.</div>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLegalOpen(true)}
                    className="flex items-center justify-center gap-2 rounded bg-accent-brand px-3 py-2 text-xs font-semibold text-accent-brand-contrast hover:opacity-90 transition-opacity"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    Tramitar con Geocapitals Legal
                  </button>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(ojvVertexText(pedOut!)); toast.success(`Vértices ${datum} copiados para OJV`); }}
                    className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"><Copy className="w-3.5 h-3.5" />Copiar minuta de vértices (OJV)</button>
                  <button type="button" onClick={() => downloadEscritoDocx(pedOut!, "pedimento", datos)}
                    className="flex items-center gap-2 rounded border border-primary px-3 py-1.5 text-xs text-primary hover:bg-muted"><FileText className="w-3.5 h-3.5" />Word (.docx) · pedimento ({datum})</button>
                  <button type="button" onClick={() => downloadEscritoDocx(pedOut!, "manifestacion", datos)}
                    className="flex items-center gap-2 rounded border border-primary px-3 py-1.5 text-xs text-primary hover:bg-muted"><FileText className="w-3.5 h-3.5" />Word (.docx) · manifestación ({datum})</button>
                  <button type="button" onClick={saveAsOwn}
                    className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"><BookmarkPlus className="w-3.5 h-3.5" />Guardar como causa propia (blindaje y plazo TGR)</button>
                  <button type="button" onClick={() => downloadPedimentoEscrito(pedOut!, "pedimento", datos)}
                    className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"><FileText className="w-3.5 h-3.5" />Escrito borrador · pedimento (exploración)</button>
                  <button type="button" onClick={() => downloadPedimentoEscrito(pedOut!, "manifestacion", datos)}
                    className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"><FileText className="w-3.5 h-3.5" />Escrito borrador · manifestación (explotación)</button>
                  <button type="button" onClick={() => setTab("prelacion")}
                    className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"><Scale className="w-3.5 h-3.5" />Revisar prelación de este sector</button>
                </div>
                <p className="text-[10px] text-muted-foreground">Borrador para abogado de minería; campos vacíos quedan [POR COMPLETAR].</p>
              </div>
            )}
          </div>
        )}
        {tab === "prelacion" && center && (
          <PriorityCheckPanel key={`${center.lat.toFixed(4)},${center.lng.toFixed(4)}`} initialLat={center.lat} initialLng={center.lng} />
        )}
        {tab === "causas" && <OwnCasesPanel onChange={setOwn} />}
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
      {pedOut && (
        <LegalTramiteModal
          open={legalOpen}
          onOpenChange={setLegalOpen}
          source="catastro-legal-tramite"
          context={{ kind: meta.kind, ped: pedOut, datos, pertenencias: meta.pertenencias }}
        />
      )}
    </div>
  );
}

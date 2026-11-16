// Diseñador sobre el mapa: tipo de solicitud, punto de partida (automático, dibujo,
// caducada), vértices arrastrables con snap a 100 m, celdas de 1 ha para
// manifestaciones y conflictos contra el catastro vivo. Emite un PedimentoResult.
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crosshair, Loader2, MousePointer2, Grid3x3, AlertTriangle } from "lucide-react";
import type { Map as MLMap, GeoJSONSource, MapMouseEvent } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { PedimentoResult } from "@/lib/pedimentoGeometry";
import {
  RULES, type SolicitudKind, type Rect, type Utm, utmFor, snapRect, clampRectHa, rectToResult, rectHa,
  dragCorner, rectCells, cellsBounds, cellsContiguous, partitionPertenencias, conflictingCells, cellKey, parseCell, rectToWgs, STEP_M,
} from "@/lib/cadastre/designer";
import { getOccupiedInBbox } from "@/lib/cadastre/designer.functions";

const VTX = "wb-vtx", CELLS = "wb-cells", CONF = "wb-conf";
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

function ensure(map: MLMap) {
  if (!map.getSource(CELLS)) {
    map.addSource(CELLS, { type: "geojson", data: EMPTY });
    map.addLayer({ id: `${CELLS}-line`, type: "line", source: CELLS, paint: { "line-color": "#f59e0b", "line-width": 0.6, "line-opacity": 0.8 } });
  }
  if (!map.getSource(CONF)) {
    map.addSource(CONF, { type: "geojson", data: EMPTY });
    map.addLayer({ id: `${CONF}-fill`, type: "fill", source: CONF, paint: { "fill-color": "#dc2626", "fill-opacity": 0.45 } });
  }
  if (!map.getSource(VTX)) {
    map.addSource(VTX, { type: "geojson", data: EMPTY });
    map.addLayer({ id: VTX, type: "circle", source: VTX, paint: { "circle-radius": 7, "circle-color": "#ffffff", "circle-stroke-color": "#c2410c", "circle-stroke-width": 3 } });
  }
}

export type DesignerHandle = { kind: SolicitudKind; pertenencias: Rect[] };

export function DesignerPanel({
  map, ped, setPed, runAuto, busy, seedBbox, onMeta,
}: {
  map: MLMap | null;
  ped: PedimentoResult | null;
  setPed: (p: PedimentoResult | null) => void;
  runAuto: () => void;
  busy: boolean;
  seedBbox: { bbox: [number, number, number, number]; label: string } | null;
  onMeta: (m: DesignerHandle) => void;
}) {
  const [kind, setKind] = useState<SolicitudKind>("pedimento");
  const [mode, setMode] = useState<"idle" | "draw" | "cells">("idle");
  const [cells, setCells] = useState<Set<string>>(new Set());
  const [occupied, setOccupied] = useState<FeatureCollection | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const fetchOcc = useServerFn(getOccupiedInBbox);
  const drawPts = useRef<[number, number][]>([]);

  const utm: Utm | null = useMemo(() => (ped ? utmFor(ped.cornersWgs84.NW[0]) : null), [ped?.huso, ped?.cornersWgs84.NW[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const rect: Rect | null = ped ? { w: ped.cornersUtm.SW[0], s: ped.cornersUtm.SW[1], e: ped.cornersUtm.NE[0], n: ped.cornersUtm.NE[1] } : null;
  const maxHa = RULES[kind].maxHa;

  const applyRect = (r: Rect, u: Utm, label?: string) => {
    const fixed = clampRectHa(snapRect(r), maxHa);
    setPed(rectToResult(fixed, u, occupied?.features.length ?? 0));
    if (kind === "manifestacion") setCells(new Set(rectCells(fixed)));
    if (label) setOrigin(label);
  };

  // Semilla externa (caducada desde la ficha del mapa).
  useEffect(() => {
    if (!seedBbox) return;
    const [w, s, e, n] = seedBbox.bbox;
    const u = utmFor((w + e) / 2);
    const a = u.fwd(w, s), b = u.fwd(e, n);
    applyRect({ w: a[0], s: a[1], e: b[0], n: b[1] }, u, seedBbox.label);
  }, [seedBbox]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar de tipo, reaplicar topes y celdas.
  useEffect(() => {
    if (!rect || !utm) return;
    applyRect(rect, utm);
    if (kind === "pedimento") setCells(new Set());
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // Catastro ocupado alrededor del diseño.
  const rectKey = rect ? `${rect.w},${rect.s},${rect.e},${rect.n}` : "";
  useEffect(() => {
    if (!ped) { setOccupied(null); return; }
    const c = ped.rectangleWgs84.geometry.coordinates[0];
    const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
    const t = setTimeout(() => {
      fetchOcc({ data: { bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] } })
        .then((r) => setOccupied(r.ok ? r.catastro : null)).catch(() => setOccupied(null));
    }, 400);
    return () => clearTimeout(t);
  }, [rectKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCells = useMemo(() => (kind === "manifestacion" ? cells : rect ? new Set(rect && rectHa(rect) <= 5000 ? rectCells(rect) : []) : new Set<string>()), [kind, cells, rectKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const conflicts = useMemo(() => (occupied && utm ? conflictingCells(activeCells, occupied, utm) : new Set<string>()), [activeCells, occupied, utm]);
  const validCells = useMemo(() => new Set([...cells].filter((k) => !conflicts.has(k))), [cells, conflicts]);
  const pertenencias = useMemo(() => (kind === "manifestacion" ? partitionPertenencias(validCells) : []), [kind, validCells]);
  const contiguous = kind === "manifestacion" ? cellsContiguous(validCells) : true;
  const cellHa = validCells.size;

  // En manifestación, la minuta usa la envolvente de las celdas válidas.
  useEffect(() => {
    if (kind !== "manifestacion" || !utm) return;
    const b = cellsBounds(validCells);
    if (b) setPed(rectToResult(b, utm, occupied?.features.length ?? 0));
  }, [kind, validCells]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onMeta({ kind, pertenencias }); }, [kind, pertenencias]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capas: vértices, celdas, conflictos.
  useEffect(() => {
    if (!map) return;
    const draw = () => {
      ensure(map);
      const vtx = ped && kind === "pedimento"
        ? (["NW", "NE", "SE", "SW"] as const).map((k) => ({ type: "Feature" as const, properties: { corner: k }, geometry: { type: "Point" as const, coordinates: ped.cornersWgs84[k] } }))
        : [];
      (map.getSource(VTX) as GeoJSONSource).setData({ type: "FeatureCollection", features: vtx });
      const toPoly = (k: string) => { const [c, r] = parseCell(k); return rectToWgs({ w: c * STEP_M, s: r * STEP_M, e: (c + 1) * STEP_M, n: (r + 1) * STEP_M }, utm!); };
      (map.getSource(CELLS) as GeoJSONSource).setData({ type: "FeatureCollection", features: utm && kind === "manifestacion" ? [...validCells].map(toPoly) : [] });
      (map.getSource(CONF) as GeoJSONSource).setData({ type: "FeatureCollection", features: utm ? [...conflicts].slice(0, 3000).map(toPoly) : [] });
    };
    if (map.isStyleLoaded()) draw(); else map.once("idle", draw);
  }, [map, ped, kind, validCells, conflicts, utm]);

  // Arrastre de vértices.
  useEffect(() => {
    if (!map || !ped || kind !== "pedimento" || !utm || !rect) return;
    let corner: "NW" | "NE" | "SE" | "SW" | null = null;
    let live = rect;
    const down = (e: MapMouseEvent & { features?: { properties: Record<string, unknown> }[] }) => {
      corner = (e.features?.[0]?.properties.corner as typeof corner) ?? null;
      if (!corner) return;
      e.preventDefault();
      map.dragPan.disable();
      map.getCanvas().style.cursor = "grabbing";
    };
    const move = (e: MapMouseEvent) => {
      if (!corner) return;
      const [x, y] = utm.fwd(e.lngLat.lng, e.lngLat.lat);
      live = dragCorner(rect, corner, x, y);
      (map.getSource("wb-pedimento") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: [rectToWgs(live, utm)] });
    };
    const up = () => {
      if (!corner) return;
      corner = null;
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
      applyRect(live, utm);
    };
    const enter = () => { map.getCanvas().style.cursor = "grab"; };
    const leave = () => { if (!corner) map.getCanvas().style.cursor = ""; };
    map.on("mousedown", VTX, down);
    map.on("mouseenter", VTX, enter);
    map.on("mouseleave", VTX, leave);
    map.on("mousemove", move);
    map.on("mouseup", up);
    return () => {
      map.off("mousedown", VTX, down); map.off("mouseenter", VTX, enter); map.off("mouseleave", VTX, leave);
      map.off("mousemove", move); map.off("mouseup", up);
    };
  }, [map, rectKey, kind, utm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dibujo (2 esquinas) y edición de celdas por clic.
  useEffect(() => {
    if (!map || mode === "idle") return;
    map.getCanvas().style.cursor = "crosshair";
    const click = (e: MapMouseEvent) => {
      if (mode === "draw") {
        drawPts.current.push([e.lngLat.lng, e.lngLat.lat]);
        if (drawPts.current.length === 2) {
          const [[x1, y1], [x2, y2]] = drawPts.current;
          drawPts.current = [];
          const u = utmFor((x1 + x2) / 2);
          const a = u.fwd(x1, y1), b = u.fwd(x2, y2);
          applyRect({ w: a[0], s: a[1], e: b[0], n: b[1] }, u, "Dibujado en el mapa");
          setMode("idle");
        }
      } else if (mode === "cells" && utm) {
        const [x, y] = utm.fwd(e.lngLat.lng, e.lngLat.lat);
        const k = cellKey(x, y);
        setCells((prev) => {
          const next = new Set(prev);
          if (next.has(k)) next.delete(k); else if (next.size < RULES.manifestacion.maxHa) next.add(k);
          return next;
        });
      }
    };
    map.on("click", click);
    return () => { map.off("click", click); map.getCanvas().style.cursor = ""; };
  }, [map, mode, utm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpiar capas al desmontar.
  useEffect(() => () => {
    if (!map) return;
    for (const id of [VTX, CELLS, CONF]) (map.getSource(id) as GeoJSONSource | undefined)?.setData(EMPTY);
  }, [map]);

  const btn = (on: boolean) => `flex-1 rounded border px-2 py-1.5 text-xs ${on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(["pedimento", "manifestacion"] as const).map((k) => (
          <button key={k} type="button" className={btn(kind === k)} onClick={() => { setKind(k); setMode("idle"); }}>{RULES[k].label}</button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">{RULES[kind].note}. Topes según Código de Minería; validar con abogado.</p>

      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={runAuto} disabled={busy || !map}
          className="col-span-2 flex items-center justify-center gap-2 rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          {busy ? "Calculando…" : "Automático: mayor área libre en la vista"}
        </button>
        <button type="button" className={btn(mode === "draw")} onClick={() => { drawPts.current = []; setMode(mode === "draw" ? "idle" : "draw"); }}>
          <MousePointer2 className="inline w-3.5 h-3.5 mr-1" />{mode === "draw" ? "Toca 2 esquinas…" : "Dibujar"}
        </button>
        <button type="button" disabled={kind !== "manifestacion" || !ped} className={`${btn(mode === "cells")} disabled:opacity-40`} onClick={() => setMode(mode === "cells" ? "idle" : "cells")}>
          <Grid3x3 className="inline w-3.5 h-3.5 mr-1" />{mode === "cells" ? "Listo" : "Editar celdas"}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Tip: toca un polígono gris (caducado) en el mapa y usa «Diseñar sobre esta caducada». {kind === "pedimento" ? "Arrastra los vértices blancos para ajustar; se ajustan a 100 m." : "Con «Editar celdas» agrega o quita hectáreas con un toque."}
      </p>

      {origin && ped && <div className="text-[10px] font-mono text-muted-foreground">Origen: {origin}</div>}
      {origin?.startsWith("Caducada") && (
        <div className="flex gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[10px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
          Una caducada puede tener una solicitud posterior aún no graficada. Revisa la pestaña Prelación antes de presentar.
        </div>
      )}

      {ped && (
        <div className="rounded border border-border p-2 text-xs space-y-1">
          {kind === "manifestacion" ? (
            <>
              <div>{cellHa} ha válidas · {pertenencias.length} pertenencias (≤ 10 ha c/u)</div>
              {!contiguous && <div className="text-destructive">Las celdas no son continuas: divide en manifestaciones separadas.</div>}
            </>
          ) : (
            <div>{ped.ladosM["E-W"].toLocaleString("es-CL")} m E-W × {ped.ladosM["N-S"].toLocaleString("es-CL")} m N-S</div>
          )}
          {occupied == null ? <div className="text-muted-foreground">Revisando catastro…</div>
            : conflicts.size > 0 ? <div className="text-destructive">{conflicts.size} ha chocan con concesiones vigentes o en trámite (en rojo){kind === "manifestacion" ? " y se excluyen." : ". Ajusta los vértices."}</div>
            : <div className="text-emerald-600">Sin choques con el catastro SERNAGEOMIN (indicativo).</div>}
        </div>
      )}
    </div>
  );
}

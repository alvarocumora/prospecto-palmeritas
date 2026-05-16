// Sprint 6.7 — UI control for raster swipe comparison.
// Shows two raster selectors (A = left/before, B = right/after) and a draggable
// vertical divider over the map when active.

import { useEffect, useRef, useState } from "react";
import { GitCompareArrows, X } from "lucide-react";
import type { Map as LeafletMap } from "leaflet";
import type { DroneRaster } from "@/hooks/useDroneFlights";
import type { LeafletNS } from "@/components/map/types";
import { buildRasterSwipeLayer, type SwipeController } from "./rasterSwipeLayer";

type Props = {
  rasters: DroneRaster[];
  mapInst: { map: LeafletMap; L: LeafletNS } | null;
};

export function RasterSwipePanel({ rasters, mapInst }: Props) {
  const [open, setOpen] = useState(false);
  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");
  const [active, setActive] = useState(false);
  const [splitPx, setSplitPx] = useState(0);
  const ctlRef = useRef<SwipeController | null>(null);
  const dragRef = useRef(false);

  // Pre-fill defaults: oldest as A, newest as B.
  useEffect(() => {
    if (rasters.length < 2) return;
    const sorted = [...rasters].sort((a, b) => {
      const ta = a.captured_at ? Date.parse(a.captured_at) : 0;
      const tb = b.captured_at ? Date.parse(b.captured_at) : 0;
      return ta - tb;
    });
    if (!aId) setAId(sorted[0].id);
    if (!bId) setBId(sorted[sorted.length - 1].id);
  }, [rasters, aId, bId]);

  // Activate / teardown swipe layer.
  useEffect(() => {
    if (!active || !mapInst) return;
    const a = rasters.find((r) => r.id === aId);
    const b = rasters.find((r) => r.id === bId);
    if (!a || !b || a.id === b.id) return;
    let cancelled = false;
    void buildRasterSwipeLayer(mapInst.L, mapInst.map, a, b).then((ctl) => {
      if (cancelled || !ctl) return;
      ctlRef.current = ctl;
      const w = mapInst.map.getContainer().getBoundingClientRect().width;
      const initial = w / 2;
      setSplitPx(initial);
      ctl.setSplit(initial);
    });
    return () => {
      cancelled = true;
      ctlRef.current?.destroy();
      ctlRef.current = null;
    };
  }, [active, aId, bId, mapInst, rasters]);

  // Update divider position.
  useEffect(() => {
    ctlRef.current?.setSplit(splitPx);
  }, [splitPx]);

  // Drag handlers.
  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current || !mapInst) return;
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      const rect = mapInst.map.getContainer().getBoundingClientRect();
      const px = Math.max(0, Math.min(rect.width, x - rect.left));
      setSplitPx(px);
    };
    const onUp = () => {
      dragRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [active, mapInst]);

  if (rasters.length < 2) return null;

  return (
    <>
      {/* Trigger button + selectors */}
      <div className="absolute top-3 right-3 z-[700] flex flex-col items-end gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-md bg-bg-secondary/95 backdrop-blur px-2.5 py-1.5 text-xs border border-border hover:bg-bg-tertiary"
          title="Comparar rasters"
        >
          <GitCompareArrows className="h-3.5 w-3.5 text-gold" />
          Swipe
        </button>
        {open && (
          <div className="rounded-md bg-bg-secondary/95 backdrop-blur border border-border p-3 w-72 space-y-2 shadow-lg">
            <div className="text-[11px] font-mono text-muted-foreground uppercase">
              Comparar (antes / después)
            </div>
            <label className="block text-xs">
              <span className="text-muted-foreground">A · izquierda</span>
              <select
                value={aId}
                onChange={(e) => setAId(e.target.value)}
                className="mt-0.5 w-full rounded bg-bg-tertiary border border-border px-2 py-1 text-xs"
              >
                {rasters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.captured_at ? `· ${r.captured_at.slice(0, 10)}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">B · derecha</span>
              <select
                value={bId}
                onChange={(e) => setBId(e.target.value)}
                className="mt-0.5 w-full rounded bg-bg-tertiary border border-border px-2 py-1 text-xs"
              >
                {rasters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.captured_at ? `· ${r.captured_at.slice(0, 10)}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setActive(true)}
                disabled={!aId || !bId || aId === bId}
                className="flex-1 rounded bg-gold text-bg-primary text-xs font-medium py-1.5 disabled:opacity-40"
              >
                Activar swipe
              </button>
              {active && (
                <button
                  onClick={() => setActive(false)}
                  className="rounded bg-bg-tertiary border border-border px-2 text-xs flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Salir
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      {active && (
        <div
          className="absolute top-0 bottom-0 w-1 bg-gold/80 z-[999] cursor-ew-resize shadow-[0_0_12px_rgba(240,201,107,0.6)]"
          style={{ left: `${splitPx}px` }}
          onMouseDown={() => {
            dragRef.current = true;
          }}
          onTouchStart={() => {
            dragRef.current = true;
          }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gold flex items-center justify-center">
            <GitCompareArrows className="h-3.5 w-3.5 text-bg-primary" />
          </div>
        </div>
      )}
    </>
  );
}

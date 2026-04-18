import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import type { Map as LeafletMap } from "leaflet";

interface Props {
  map: LeafletMap | null;
}

export function CoordinateFooter({ map }: Props) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!map) return;
    const onMove = (ev: { latlng: { lat: number; lng: number } }) => setPos(ev.latlng);
    const onZoom = () => setZoom(map.getZoom());
    setZoom(map.getZoom());
    map.on("mousemove", onMove);
    map.on("zoomend", onZoom);
    return () => {
      map.off("mousemove", onMove);
      map.off("zoomend", onZoom);
    };
  }, [map]);

  const copy = async () => {
    if (!pos) return;
    try {
      await navigator.clipboard.writeText(`${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="absolute bottom-2 left-2 z-[1000] flex items-center gap-2 px-2 py-1 rounded border border-border bg-background/95 backdrop-blur shadow text-[10px] font-mono text-muted-foreground">
      {pos ? (
        <>
          <span className="text-foreground">
            {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
          </span>
          <button
            type="button"
            onClick={copy}
            className="text-muted-foreground hover:text-foreground"
            title="Copiar coordenadas"
          >
            {copied ? <Check className="w-3 h-3 text-gold" /> : <Copy className="w-3 h-3" />}
          </button>
        </>
      ) : (
        <span>mueve el cursor sobre el mapa</span>
      )}
      {zoom != null && <span className="border-l border-border pl-2">z{zoom}</span>}
    </div>
  );
}

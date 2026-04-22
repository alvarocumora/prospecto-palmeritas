import { useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Camera, Crosshair, Layers, Loader2, Compass } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { RasterSettings } from "@/components/drones/RasterControlPanel";
import type { DroneRaster } from "@/hooks/useDroneFlights";
import { toast } from "sonner";

interface Props {
  map: LeafletMap | null;
  rasters: DroneRaster[];
  rasterSettings: RasterSettings;
  onRasterChange: (id: string, patch: Partial<RasterSettings[string]>) => void;
  onSnapshot: () => void;
  snapshotting: boolean;
}

export function MobileMapInspector({
  map,
  rasters,
  rasterSettings,
  onRasterChange,
  onSnapshot,
  snapshotting,
}: Props) {
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    if (!map) {
      toast.error("Mapa no disponible");
      return;
    }
    if (!("geolocation" in navigator)) {
      toast.error("GPS no disponible en este dispositivo");
      return;
    }
    setLocating(true);
    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true, timeout: 10000 });
    const onFound = () => {
      setLocating(false);
      toast.success("Ubicación encontrada");
      map.off("locationfound", onFound);
      map.off("locationerror", onError);
    };
    const onError = () => {
      setLocating(false);
      toast.error("No se pudo obtener la ubicación");
      map.off("locationfound", onFound);
      map.off("locationerror", onError);
    };
    map.on("locationfound", onFound);
    map.on("locationerror", onError);
  };

  const visibleCount = Object.values(rasterSettings).filter((s) => s?.visible).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Inspector del mapa"
          className="md:hidden absolute z-[600] right-3 inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold text-background shadow-lg active:scale-95 transition-transform"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}
          title="Inspector"
        >
          <Compass className="w-5 h-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Compass className="w-4 h-4 text-gold" />
            Inspector del mapa
          </SheetTitle>
        </SheetHeader>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating || !map}
            className="inline-flex items-center justify-center gap-2 h-12 rounded-md border border-border bg-background hover:bg-accent text-sm font-mono disabled:opacity-50 active:scale-95 transition"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4 text-gold" />}
            <span>Mi ubicación</span>
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onSnapshot(); }}
            disabled={snapshotting || !map}
            className="inline-flex items-center justify-center gap-2 h-12 rounded-md border border-border bg-background hover:bg-accent text-sm font-mono disabled:opacity-50 active:scale-95 transition"
          >
            {snapshotting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 text-gold" />}
            <span>Snapshot</span>
          </button>
        </div>

        {/* Raster layer toggles */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-gold" />
              <span className="text-[11px] font-mono uppercase text-muted-foreground">
                Capas raster ({rasters.length})
              </span>
            </div>
            {visibleCount > 0 && (
              <span className="text-[10px] font-mono text-gold">{visibleCount} activas</span>
            )}
          </div>

          {rasters.length === 0 ? (
            <div className="text-xs font-mono text-muted-foreground text-center py-6 border border-dashed border-border rounded">
              Sin rasters cargados
            </div>
          ) : (
            <div className="space-y-2 max-h-[40dvh] overflow-y-auto pr-1">
              {rasters.map((r) => {
                const s = rasterSettings[r.id] ?? { visible: false, opacity: 0.75, colormap: "none" as const };
                return (
                  <div key={r.id} className="border border-border rounded p-2.5 bg-bg-secondary/40">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono font-semibold truncate">{r.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">
                          {r.raster_type}
                        </div>
                      </div>
                      <Switch
                        checked={!!s.visible}
                        onCheckedChange={(v) => onRasterChange(r.id, { visible: v })}
                      />
                    </div>
                    {s.visible && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-12">Opacidad</span>
                        <Slider
                          value={[Math.round((s.opacity ?? 0.75) * 100)]}
                          min={0}
                          max={100}
                          step={5}
                          onValueChange={([v]) => onRasterChange(r.id, { opacity: v / 100 })}
                          className="flex-1"
                        />
                        <span className="text-[10px] font-mono text-foreground w-8 text-right">
                          {Math.round((s.opacity ?? 0.75) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

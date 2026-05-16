// Sprint 6.2 — Command Palette ⌘K para el Centro de Operaciones.
// Acceso instantáneo a: sondajes, targets, rasters, navegación, y acciones rápidas
// (toggle 2D/3D, snapshot, ir a coordenadas, etc.). Atajo global: Cmd/Ctrl+K.

import { useEffect, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Crosshair,
  Drill,
  Target,
  Layers,
  Box,
  Map as MapIcon,
  Sparkles,
  Flame,
  Scissors,
  Camera,
  FileText,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { DrillHole } from "@/hooks/useDrilling";
import type { ExplorationTarget } from "@/hooks/useExplorationTargets";
import type { DroneRaster } from "@/hooks/useDroneFlights";
import type { ViewMode } from "./ViewModeToggle";

interface Props {
  map: LeafletMap | null;
  holes: DrillHole[];
  targets: ExplorationTarget[];
  rasters: DroneRaster[];
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  onSnapshot?: () => void;
}

export function MapCommandPalette({
  map,
  holes,
  targets,
  rasters,
  viewMode,
  onViewModeChange,
  onSnapshot,
}: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const flyToHole = (h: DrillHole) => {
    if (map && h.northing != null && h.easting != null) {
      // Note: easting/northing aquí son lat/lng aproximados en muchos proyectos seed.
      // Si tu proyecto usa UTM real, esto debería pasar por una conversión.
      map.setView([h.northing, h.easting], 17);
    }
    setOpen(false);
  };

  const flyToTarget = (t: ExplorationTarget) => {
    if (map && t.lat != null && t.lng != null) {
      map.setView([t.lat, t.lng], 16);
    }
    setOpen(false);
  };

  const flyToRaster = (r: DroneRaster) => {
    if (!map) return;
    const bbox = r.bounds_geojson as { bbox?: number[] } | number[] | null;
    if (!bbox) return;
    const arr = Array.isArray(bbox) ? bbox : bbox.bbox;
    if (!arr || arr.length < 4) return;
    const [minLng, minLat, maxLng, maxLat] = arr;
    map.fitBounds(
      [
        [minLat, minLng],
        [maxLat, maxLng],
      ],
      { padding: [40, 40] },
    );
    setOpen(false);
  };

  const go = (path: string) => {
    setOpen(false);
    navigate({ to: path });
  };

  return (
    <>
      {/* Hint flotante en el header */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-background hover:bg-accent text-[11px] font-mono text-muted-foreground transition-colors whitespace-nowrap"
        title="Búsqueda global y comandos"
      >
        <Crosshair className="w-3 h-3 text-gold" />
        <span>Buscar</span>
        <kbd className="ml-1 px-1 py-0 rounded bg-bg-secondary border border-border text-[9px]">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar sondajes, targets, rasters, comandos…" />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>

          <CommandGroup heading="Acciones rápidas">
            <CommandItem
              onSelect={() => {
                onViewModeChange(viewMode === "2d" ? "3d" : "2d");
                setOpen(false);
              }}
            >
              {viewMode === "2d" ? <Box className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
              <span>Cambiar a vista {viewMode === "2d" ? "3D" : "2D"}</span>
              <CommandShortcut>V</CommandShortcut>
            </CommandItem>
            {onSnapshot && viewMode === "2d" && (
              <CommandItem
                onSelect={() => {
                  onSnapshot();
                  setOpen(false);
                }}
              >
                <Camera className="w-4 h-4" />
                <span>Capturar snapshot PNG</span>
              </CommandItem>
            )}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Herramientas">
            <CommandItem
              onSelect={() => {
                document.querySelector<HTMLButtonElement>('[title*="Geo-Intel Brief"]')?.click();
                setOpen(false);
              }}
            >
              <Sparkles className="w-4 h-4" />
              <span>Generar Geo-Intel Brief</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                document.querySelector<HTMLButtonElement>('[title*="Prospectividad"]')?.click();
                setOpen(false);
              }}
            >
              <Flame className="w-4 h-4" />
              <span>Heatmap de prospectividad IA</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                document.querySelector<HTMLButtonElement>('[title*="Sección 2D"]')?.click();
                setOpen(false);
              }}
            >
              <Scissors className="w-4 h-4" />
              <span>Construir sección 2D</span>
            </CommandItem>
          </CommandGroup>

          {holes.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={`Sondajes (${holes.length})`}>
                {holes.slice(0, 50).map((h) => (
                  <CommandItem
                    key={h.id}
                    value={`hole ${h.hole_id} ${h.target_zone ?? ""}`}
                    onSelect={() => flyToHole(h)}
                  >
                    <Drill className="w-4 h-4" />
                    <span className="font-mono">{h.hole_id}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {h.actual_depth ?? h.planned_depth ?? "—"} m · {h.status}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {targets.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={`Targets (${targets.length})`}>
                {targets.slice(0, 30).map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`target ${t.code} ${t.name}`}
                    onSelect={() => flyToTarget(t)}
                  >
                    <Target className="w-4 h-4" />
                    <span className="font-mono">{t.code}</span>
                    <span className="text-muted-foreground truncate">— {t.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {t.priority} · {t.score ?? "—"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {rasters.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={`Rasters drone (${rasters.length})`}>
                {rasters.slice(0, 20).map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`raster ${r.name} ${r.raster_type}`}
                    onSelect={() => flyToRaster(r)}
                  >
                    <Layers className="w-4 h-4" />
                    <span className="truncate">{r.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground uppercase">
                      {r.raster_type}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading="Ir a">
            <CommandItem onSelect={() => go("/dashboard")}>
              <MapIcon className="w-4 h-4" /> <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/dashboard/drilling")}>
              <Drill className="w-4 h-4" /> <span>Sondajes</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/dashboard/targets")}>
              <Target className="w-4 h-4" /> <span>Targets</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/dashboard/drones")}>
              <Layers className="w-4 h-4" /> <span>Drones & rasters</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/dashboard/reports")}>
              <FileText className="w-4 h-4" /> <span>Reportes</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

import { useMemo } from "react";
import type { ExplorationTarget } from "@/hooks/useExplorationTargets";
import { PRIORITY_META } from "@/hooks/useExplorationTargets";
import {
  bearingDegrees,
  compassPoint,
  haversineMeters,
  type GeoPosition,
} from "@/hooks/useGeolocation";
import { Navigation } from "lucide-react";

function formatDistance(m: number): string {
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function NearestTargetPanel({
  position,
  targets,
  onGoTo,
}: {
  position: GeoPosition | null;
  targets: ExplorationTarget[];
  onGoTo?: (t: ExplorationTarget) => void;
}) {
  const nearest = useMemo(() => {
    if (!position) return null;
    let best: { t: ExplorationTarget; dist: number; bearing: number } | null = null;
    for (const t of targets) {
      if (t.lat == null || t.lng == null) continue;
      const dist = haversineMeters(position, { lat: Number(t.lat), lng: Number(t.lng) });
      if (!best || dist < best.dist) {
        const bearing = bearingDegrees(position, { lat: Number(t.lat), lng: Number(t.lng) });
        best = { t, dist, bearing };
      }
    }
    return best;
  }, [position, targets]);

  if (!position) {
    return (
      <div className="text-[10px] font-mono text-muted-foreground">
        Activa GPS para ver el target más cercano
      </div>
    );
  }

  if (!nearest) {
    return <div className="text-[10px] font-mono text-muted-foreground">Sin targets visibles</div>;
  }

  const { t, dist, bearing } = nearest;
  const pri = PRIORITY_META[t.priority];

  return (
    <div className="flex items-center gap-3 text-[11px] font-mono">
      <Navigation
        className="w-4 h-4 text-sky-400 shrink-0"
        style={{ transform: `rotate(${bearing}deg)` }}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold truncate">{t.code}</span>
          <span className={`text-[9px] uppercase px-1 py-0.5 rounded border ${pri.color}`}>
            {pri.label}
          </span>
        </div>
        <div className="text-muted-foreground text-[10px] truncate">{t.name}</div>
      </div>
      <div className="ml-auto text-right shrink-0">
        <div className="text-sky-300 font-semibold">{formatDistance(dist)}</div>
        <div className="text-[10px] text-muted-foreground">
          {bearing.toFixed(0)}° {compassPoint(bearing)}
        </div>
      </div>
      {onGoTo && (
        <button
          type="button"
          onClick={() => onGoTo(t)}
          className="px-2 py-1 rounded border border-sky-500/40 text-sky-300 bg-sky-500/5 hover:bg-sky-500/10 text-[10px]"
        >
          Ir
        </button>
      )}
    </div>
  );
}

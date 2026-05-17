import { Compass, Navigation } from "lucide-react";
import type { ArProjectedObject } from "@/types/ar";

function relativeDirection(relativeBearingDeg: number | null) {
  if (relativeBearingDeg == null) return "•";
  if (relativeBearingDeg > 135) return "⬅";
  if (relativeBearingDeg > 45) return "↖";
  if (relativeBearingDeg > -45) return "↑";
  if (relativeBearingDeg > -135) return "↗";
  return "➡";
}

function typeColor(type: ArProjectedObject["type"]) {
  switch (type) {
    case "magnetic_anomaly":
      return "text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/10";
    case "satellite_anomaly":
      return "text-cyan-300 border-cyan-500/30 bg-cyan-500/10";
    case "alteration":
      return "text-amber-300 border-amber-500/30 bg-amber-500/10";
    case "structure":
      return "text-orange-300 border-orange-500/30 bg-orange-500/10";
    default:
      return "text-gold border-gold/30 bg-gold/10";
  }
}

export function ArRadarOverlay({
  objects,
  headingDeg,
}: {
  objects: ArProjectedObject[];
  headingDeg?: number | null;
}) {
  const nearest = objects.slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-background/85 backdrop-blur shadow-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-sky-300">
          <Compass className="w-3 h-3" /> AR Radar
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          Heading {headingDeg != null ? `${Math.round(headingDeg)}°` : "—"}
        </div>
      </div>

      {nearest.length === 0 ? (
        <div className="px-3 py-4 text-[11px] font-mono text-muted-foreground">
          Sin anomalías ni targets cercanos.
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {nearest.map((o) => (
            <div key={`${o.type}:${o.id}`} className="px-3 py-2 flex items-start gap-3">
              <div className="text-lg leading-none pt-0.5">{relativeDirection(o.relativeBearingDeg)}</div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[9px] font-mono uppercase ${typeColor(o.type)}`}
                  >
                    {o.type.replaceAll("_", " ")}
                  </span>
                  {o.isNearby && (
                    <span className="px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-mono uppercase text-emerald-300">
                      nearby
                    </span>
                  )}
                </div>

                <div className="mt-1 text-sm font-medium text-foreground truncate">
                  {o.label}
                </div>

                <div className="mt-1 flex items-center gap-3 text-[10px] font-mono text-muted-foreground flex-wrap">
                  <span>{Math.round(o.distanceM)} m</span>
                  <span>{Math.round(o.bearingDeg)}°</span>
                  {o.relativeElevationM != null && (
                    <span>{Math.round(o.relativeElevationM)} m elev.</span>
                  )}
                </div>
              </div>

              <Navigation
                className="w-4 h-4 text-sky-300 shrink-0"
                style={{
                  transform: `rotate(${o.relativeBearingDeg ?? 0}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

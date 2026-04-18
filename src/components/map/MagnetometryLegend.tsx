import { magColor, type MagStats } from "./geophysicsLayers";

export function MagnetometryLegend({ stats }: { stats: MagStats | null }) {
  if (!stats || stats.count === 0) {
    return (
      <span className="text-muted-foreground/70 font-mono text-[11px]">
        Sin estaciones de magnetometría en la campaña activa.
      </span>
    );
  }
  const span = Math.max(
    Math.abs(stats.max - stats.baseline),
    Math.abs(stats.min - stats.baseline),
    1
  );
  // 7 stops -1..+1
  const stops = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];
  return (
    <div className="inline-flex items-center gap-2 font-mono text-[11px]">
      <span className="text-muted-foreground/70 uppercase">Magnetometría</span>
      <span className="text-muted-foreground">{stats.min.toFixed(0)} nT</span>
      <span className="inline-flex h-3 rounded overflow-hidden border border-border">
        {stops.map((t) => (
          <span
            key={t}
            className="block w-4 h-full"
            style={{ background: magColor(t * span, span) }}
          />
        ))}
      </span>
      <span className="text-muted-foreground">{stats.max.toFixed(0)} nT</span>
      <span className="text-muted-foreground/70">
        · base <strong className="text-foreground">{stats.baseline.toFixed(0)}</strong> · n={stats.count}
      </span>
    </div>
  );
}

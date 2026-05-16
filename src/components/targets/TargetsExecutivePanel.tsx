import { useEffect, useMemo, useRef, useState } from "react";
import type { ExplorationTarget, TargetPriority } from "@/hooks/useExplorationTargets";
import { PRIORITY_META } from "@/hooks/useExplorationTargets";
import { Trophy, TrendingUp, Crown, Star, Medal, Navigation, NavigationOff, Compass, Signal, SignalLow, SignalZero, RefreshCw } from "lucide-react";
import { useGeolocation, haversineMeters, type GeoPosition } from "@/hooks/useGeolocation";
import { toast } from "sonner";

function fmtDistance(m: number): string {
  if (!Number.isFinite(m)) return "—";
  if (m < 1000) return `${m.toFixed(0)} m`;
  if (m < 10000) return `${(m / 1000).toFixed(2)} km`;
  return `${(m / 1000).toFixed(1)} km`;
}

type AccuracyTier = { label: string; color: string; bg: string; border: string; Icon: typeof Signal };

function accuracyTier(acc: number | null): AccuracyTier {
  if (acc == null) return { label: "sin señal", color: "text-muted-foreground", bg: "bg-muted/20", border: "border-border", Icon: SignalZero };
  if (acc <= 15) return { label: "excelente", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/40", Icon: Signal };
  if (acc <= 50) return { label: "buena", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/40", Icon: Signal };
  if (acc <= 150) return { label: "regular", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/40", Icon: SignalLow };
  return { label: "pobre", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/40", Icon: SignalZero };
}

const ACCURACY_THRESHOLDS = [20, 50, 100, 250, 1000] as const;
const DEFAULT_ACCURACY_THRESHOLD = 100;

type Metrics = { cu_ppm: number; mo_ppm: number; au_ppb: number; ag_ppm: number };

function extractMetrics(t: ExplorationTarget): Metrics {
  const e = (t.evidence ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    cu_ppm: n(e.cu_ppm),
    mo_ppm: n(e.mo_ppm),
    au_ppb: n(e.au_ppb),
    ag_ppm: n(e.ag_ppm),
  };
}

const PRIORITY_ORDER: TargetPriority[] = ["critical", "high", "medium"];

const PRIORITY_STYLE: Record<TargetPriority, { bar: string; chip: string; icon: typeof Trophy }> = {
  critical: { bar: "bg-destructive", chip: "text-destructive border-destructive/40 bg-destructive/10", icon: Crown },
  high:     { bar: "bg-gold",        chip: "text-gold border-gold/40 bg-gold/10",                       icon: Trophy },
  medium:   { bar: "bg-info",        chip: "text-info border-info/30 bg-info/10",                       icon: Medal },
  low:      { bar: "bg-muted",       chip: "text-muted-foreground border-border",                       icon: Star },
};

function fmt(n: number, suffix: string, decimals = 0): string {
  if (n === 0) return "—";
  if (suffix === "%") return `${n.toFixed(decimals)}%`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: decimals })} ${suffix}`;
}

export function TargetsExecutivePanel({ targets }: { targets: ExplorationTarget[] }) {
  const [gpsOn, setGpsOn] = useState(false);
  const [accuracyThreshold, setAccuracyThreshold] = useState<number>(DEFAULT_ACCURACY_THRESHOLD);
  const { position: rawPosition, status } = useGeolocation(gpsOn);

  // Only accept positions whose accuracy is within the threshold.
  // We keep the last "trusted" position so the ranking doesn't jump around
  // every time the device returns a noisy fix.
  const trustedRef = useRef<GeoPosition | null>(null);
  const [trustedPos, setTrustedPos] = useState<GeoPosition | null>(null);

  useEffect(() => {
    if (!gpsOn) {
      trustedRef.current = null;
      setTrustedPos(null);
      return;
    }
    if (!rawPosition) return;
    if (rawPosition.accuracy <= accuracyThreshold) {
      trustedRef.current = rawPosition;
      setTrustedPos(rawPosition);
    }
  }, [gpsOn, rawPosition, accuracyThreshold]);

  const position = trustedPos;
  const currentAccuracy = rawPosition?.accuracy ?? null;
  const trustedAccuracy = trustedPos?.accuracy ?? null;
  const sortByDistance = gpsOn && !!position;
  const accuracyOk = currentAccuracy != null && currentAccuracy <= accuracyThreshold;

  const enriched = useMemo(
    () => targets.map((t) => {
      const lat = t.lat != null ? Number(t.lat) : null;
      const lng = t.lng != null ? Number(t.lng) : null;
      const hasCoord = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
      const distance = position && hasCoord
        ? haversineMeters(position, { lat: lat as number, lng: lng as number })
        : null;
      return { t, m: extractMetrics(t), distance };
    }),
    [targets, position],
  );

  const grouped = useMemo(() => {
    const g: Record<TargetPriority, typeof enriched> = { critical: [], high: [], medium: [], low: [] };
    enriched.forEach((row) => g[row.t.priority].push(row));
    (Object.keys(g) as TargetPriority[]).forEach((k) => {
      if (sortByDistance) {
        g[k].sort((a, b) => {
          const da = a.distance ?? Number.POSITIVE_INFINITY;
          const db = b.distance ?? Number.POSITIVE_INFINITY;
          if (da !== db) return da - db;
          return (b.t.score ?? 0) - (a.t.score ?? 0);
        });
      } else {
        g[k].sort((a, b) => (b.t.score ?? 0) - (a.t.score ?? 0) || b.m.cu_ppm - a.m.cu_ppm);
      }
    });
    return g;
  }, [enriched, sortByDistance]);

  function toggleGps() {
    if (gpsOn) {
      setGpsOn(false);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocalización no soportada en este dispositivo");
      return;
    }
    setGpsOn(true);
    toast.info("Solicitando GPS… el ranking se ordenará por distancia");
  }

  const [refreshing, setRefreshing] = useState(false);
  function refreshLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocalización no soportada en este dispositivo");
      return;
    }
    setGpsOn(true);
    setRefreshing(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const gp: GeoPosition = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          altitude: p.coords.altitude,
          altitudeAccuracy: p.coords.altitudeAccuracy,
          heading: p.coords.heading,
          speed: p.coords.speed,
          timestamp: p.timestamp,
        };
        // Manual refresh: trust this fix even if outside the accuracy threshold
        trustedRef.current = gp;
        setTrustedPos(gp);
        setRefreshing(false);
        toast.success(`Ubicación actualizada · ±${gp.accuracy.toFixed(0)} m`);
      },
      (err) => {
        setRefreshing(false);
        if (err.code === err.PERMISSION_DENIED) toast.error("Permiso de ubicación denegado");
        else toast.error(`GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  const aggregate = useMemo(() => {
    const all = enriched.map((r) => r.m);
    const sum = (k: keyof Metrics) => all.reduce((s, m) => s + m[k], 0);
    const max = (k: keyof Metrics) => all.reduce((s, m) => Math.max(s, m[k]), 0);
    const avgNonZero = (k: keyof Metrics) => {
      const nz = all.filter((m) => m[k] > 0);
      return nz.length ? nz.reduce((s, m) => s + m[k], 0) / nz.length : 0;
    };
    return {
      total: enriched.length,
      perPriority: {
        critical: grouped.critical.length,
        high: grouped.high.length,
        medium: grouped.medium.length,
        low: grouped.low.length,
      },
      cu: { max_pct: max("cu_ppm") / 10000, avg_pct: avgNonZero("cu_ppm") / 10000, sum_ppm: sum("cu_ppm") },
      mo: { max_ppm: max("mo_ppm"), avg_ppm: avgNonZero("mo_ppm") },
      au: { max_ppb: max("au_ppb"), avg_ppb: avgNonZero("au_ppb") },
      ag: { max_ppm: max("ag_ppm"), avg_ppm: avgNonZero("ag_ppm") },
    };
  }, [enriched, grouped]);

  // global max for normalized bars
  const globalMax = useMemo(() => ({
    cu: Math.max(1, ...enriched.map((r) => r.m.cu_ppm)),
    mo: Math.max(1, ...enriched.map((r) => r.m.mo_ppm)),
    au: Math.max(1, ...enriched.map((r) => r.m.au_ppb)),
    ag: Math.max(1, ...enriched.map((r) => r.m.ag_ppm)),
  }), [enriched]);

  if (targets.length === 0) return null;

  const tier = accuracyTier(currentAccuracy);
  const TierIcon = tier.Icon;
  const gpsStateLabel =
    status === "denied" ? "GPS denegado" :
    status === "unavailable" ? "GPS no soportado" :
    status === "error" ? "GPS error" :
    !gpsOn ? "GPS apagado" :
    !rawPosition ? "Buscando señal…" :
    accuracyOk ? "Señal confiable" : `Señal débil — descartando fixes >${accuracyThreshold} m`;

  return (
    <div className="space-y-4">
      {/* GPS / sort toggle */}
      <div className="rounded border border-border bg-bg-secondary px-3 py-2 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono flex-wrap">
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-muted-foreground">Orden:</span>
            <span className="text-foreground">
              {sortByDistance ? "Distancia desde mi ubicación" : "Score / ley Cu"}
            </span>

            {gpsOn && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${tier.border} ${tier.bg} ${tier.color}`}
                title={`Precisión actual del GPS · ${tier.label}`}
              >
                <TierIcon className="w-3 h-3" />
                {currentAccuracy != null ? `±${currentAccuracy.toFixed(0)} m` : "—"}
                <span className="opacity-70">· {tier.label}</span>
              </span>
            )}

            <span className={`${status === "denied" || status === "error" ? "text-destructive" : accuracyOk ? "text-emerald-400" : "text-muted-foreground"}`}>
              · {gpsStateLabel}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={refreshLocation}
              disabled={refreshing}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-sky-500/40 text-sky-300 bg-sky-500/5 hover:bg-sky-500/10 disabled:opacity-50 text-[10px] font-mono"
              title="Solicitar una nueva lectura GPS y recalcular ranking"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Actualizando…" : "Actualizar ubicación"}
            </button>
            <button
              type="button"
              onClick={toggleGps}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono ${
                gpsOn
                  ? "border-emerald-500/50 text-emerald-300 bg-emerald-500/10"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
              title={gpsOn ? "Apagar GPS y ordenar por score" : "Activar GPS y ordenar por distancia"}
            >
              {gpsOn ? <Navigation className="w-3 h-3" /> : <NavigationOff className="w-3 h-3" />}
              {gpsOn ? "Ordenando por distancia" : "Ordenar por distancia (GPS)"}
            </button>
          </div>
        </div>

        {gpsOn && (
          <div className="flex items-center justify-between gap-3 flex-wrap text-[10px] font-mono pt-1 border-t border-border/60">
            <label className="inline-flex items-center gap-1.5 text-muted-foreground">
              Umbral de precisión:
              <select
                value={accuracyThreshold}
                onChange={(e) => setAccuracyThreshold(Number(e.target.value))}
                className="px-1.5 py-0.5 rounded border border-border bg-background text-foreground text-[10px] font-mono"
              >
                {ACCURACY_THRESHOLDS.map((v) => (
                  <option key={v} value={v}>±{v} m</option>
                ))}
              </select>
              <span className="opacity-70">solo se actualiza el ranking con fixes mejores que esto</span>
            </label>
            {trustedAccuracy != null && (
              <span className="text-muted-foreground">
                Última posición usada: <span className="text-foreground">±{trustedAccuracy.toFixed(0)} m</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Cu máx" value={fmt(aggregate.cu.max_pct, "%", 3)} sub={`Prom. ${fmt(aggregate.cu.avg_pct, "%", 3)}`} color="text-copper" />
        <MetricCard label="Mo máx" value={fmt(aggregate.mo.max_ppm, "ppm")} sub={`Prom. ${fmt(aggregate.mo.avg_ppm, "ppm", 1)}`} color="text-info" />
        <MetricCard label="Au máx" value={fmt(aggregate.au.max_ppb, "ppb")} sub={`Prom. ${fmt(aggregate.au.avg_ppb, "ppb", 1)}`} color="text-gold" />
        <MetricCard label="Ag máx" value={fmt(aggregate.ag.max_ppm, "ppm", 1)} sub={`Prom. ${fmt(aggregate.ag.avg_ppm, "ppm", 1)}`} color="text-teal" />
      </div>

      {/* Ranking by priority */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {PRIORITY_ORDER.map((priority) => {
          const rows = grouped[priority].slice(0, 10);
          const style = PRIORITY_STYLE[priority];
          const Icon = style.icon;
          return (
            <div key={priority} className="rounded border border-border bg-bg-secondary overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <div className="inline-flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-mono font-semibold">{PRIORITY_META[priority].label}</span>
                  <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${style.chip}`}>
                    {aggregate.perPriority[priority]}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">Top {rows.length}</span>
              </div>

              {rows.length === 0 ? (
                <div className="p-4 text-center text-[10px] font-mono text-muted-foreground opacity-60">
                  Sin targets en esta categoría
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {rows.map(({ t, m, distance }, idx) => (
                    <li key={t.id} className="px-3 py-2 hover:bg-accent/30 transition-colors">
                      <div className="flex items-start gap-2">
                        <div className="text-[10px] font-mono text-muted-foreground w-5 pt-0.5">#{idx + 1}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-mono font-semibold truncate">{t.code}</div>
                            <div className="inline-flex items-center gap-2 shrink-0">
                              {sortByDistance && (
                                <span
                                  className={`inline-flex items-center gap-0.5 text-[10px] font-mono ${
                                    distance == null ? "text-muted-foreground" : "text-sky-400"
                                  }`}
                                  title={distance == null ? "Sin coordenadas" : "Distancia desde tu ubicación"}
                                >
                                  <Compass className="w-2.5 h-2.5" />
                                  {distance == null ? "—" : fmtDistance(distance)}
                                </span>
                              )}
                              {t.score != null && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-gold">
                                  <Star className="w-2.5 h-2.5 fill-gold" /> {Number(t.score).toFixed(0)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground truncate">{t.name}</div>

                          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                            <MiniBar label="Cu" value={fmt(m.cu_ppm / 10000, "%", 2)} pct={(m.cu_ppm / globalMax.cu) * 100} color="bg-copper" />
                            <MiniBar label="Mo" value={fmt(m.mo_ppm, "", 0)} pct={(m.mo_ppm / globalMax.mo) * 100} color="bg-info" />
                            <MiniBar label="Au" value={fmt(m.au_ppb, "", 0)} pct={(m.au_ppb / globalMax.au) * 100} color="bg-gold" />
                            <MiniBar label="Ag" value={fmt(m.ag_ppm, "", 1)} pct={(m.ag_ppm / globalMax.ag) * 100} color="bg-teal" />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded border border-border bg-bg-secondary p-3">
      <div className="text-[10px] font-mono uppercase text-muted-foreground inline-flex items-center gap-1">
        <TrendingUp className="w-3 h-3" /> {label}
      </div>
      <div className={`text-lg font-mono font-bold mt-1 ${color}`}>{value}</div>
      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function MiniBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[9px] font-mono text-muted-foreground">{label}</span>
        <span className="text-[9px] font-mono truncate">{value}</span>
      </div>
      <div className="h-1 rounded bg-muted/30 overflow-hidden mt-0.5">
        <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

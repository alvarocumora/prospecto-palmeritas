import { useMemo } from "react";
import type { DrillCoreLog } from "@/hooks/useDrilling";
import { computeIntercepts, formatIntercept } from "@/lib/drilling/intercepts";

/** Heat color for Au g/t value (null/0 → muted). */
function auColor(au: number | null | undefined): string {
  if (au == null || au <= 0) return "hsl(var(--muted-foreground) / 0.15)";
  if (au < 0.3) return "#1e3a8a";
  if (au < 0.5) return "#0891b2";
  if (au < 1) return "#84cc16";
  if (au < 2) return "#facc15";
  if (au < 5) return "#f97316";
  if (au < 10) return "#dc2626";
  return "#7f1d1d";
}

/** Geology-conventional lithology palette (keyed by lowercased substring match). */
const LITHOLOGY_COLORS: Record<string, string> = {
  granite: "#fcd9b6",
  granito: "#fcd9b6",
  andesite: "#7c8a99",
  andesita: "#7c8a99",
  basalt: "#3d3d3d",
  basalto: "#3d3d3d",
  rhyolite: "#e8a598",
  riolita: "#e8a598",
  dacite: "#b89968",
  dacita: "#b89968",
  diorite: "#5a6b7a",
  diorita: "#5a6b7a",
  breccia: "#a0522d",
  brecha: "#a0522d",
  vein: "#fbbf24",
  veta: "#fbbf24",
  vetilla: "#fbbf24",
  skarn: "#84cc16",
  shale: "#4a5568",
  lutita: "#4a5568",
  sandstone: "#f5d491",
  arenisca: "#f5d491",
  limestone: "#e8e0d0",
  caliza: "#e8e0d0",
  tuff: "#d4b8a8",
  toba: "#d4b8a8",
};

/** Porphyry-system alteration palette (Lowell-Guilbert convention). */
const ALTERATION_COLORS: Record<string, string> = {
  // Potásica — rosa/rojo (biotita-K-feldespato)
  potassic: "#c0392b",
  potasica: "#c0392b",
  "k-feldspar": "#c0392b",
  biotita: "#c0392b",
  // Sericítica / fílica — verde-amarillo (cuarzo-sericita-pirita)
  phyllic: "#9acd32",
  filica: "#9acd32",
  sericitic: "#9acd32",
  sericitica: "#9acd32",
  qsp: "#9acd32",
  // Argílica — celeste (caolinita/illita)
  argillic: "#7fb3d5",
  argilica: "#7fb3d5",
  // Argílica avanzada — azul más intenso (alunita/pirofilita)
  "advanced argillic": "#2874a6",
  "argilica avanzada": "#2874a6",
  alunita: "#2874a6",
  // Propilítica — verde oscuro (clorita-epidota-calcita)
  propylitic: "#2e7d32",
  propilitica: "#2e7d32",
  clorita: "#2e7d32",
  epidota: "#2e7d32",
  // Silícea / silicificación — gris claro
  silicic: "#bdc3c7",
  silica: "#bdc3c7",
  silicea: "#bdc3c7",
  silicification: "#bdc3c7",
  silicificacion: "#bdc3c7",
  // Skarn / calc-silicato — oliva
  calcsilicate: "#827717",
  "calc-silicate": "#827717",
  // Sin alteración / fresca
  fresh: "#ecf0f1",
  fresca: "#ecf0f1",
};

/** Stable hash → HSL fallback for unknown lithology codes. */
function hashHsl(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 35% 60%)`;
}

function lithoColor(code: string | null | undefined): string {
  if (!code || !code.trim()) return "hsl(var(--muted-foreground) / 0.15)";
  const lc = code.toLowerCase();
  for (const key of Object.keys(LITHOLOGY_COLORS)) {
    if (lc.includes(key)) return LITHOLOGY_COLORS[key];
  }
  return hashHsl(lc);
}

function altColor(code: string | null | undefined): string {
  if (!code || !code.trim()) return "hsl(var(--muted-foreground) / 0.15)";
  const lc = code.toLowerCase();
  // longer keys first to prefer "advanced argillic" over "argillic"
  const keys = Object.keys(ALTERATION_COLORS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lc.includes(key)) return ALTERATION_COLORS[key];
  }
  return hashHsl("alt:" + lc);
}

/** Choose readable text color (black/white) over a given hex/hsl bg. Heuristic on luminance. */
function textOn(bg: string): string {
  // crude: only pick black for known light hex codes
  if (/^#([efd][0-9a-f]|f[ce][0-9a-f]|[ef][8a][0-9a-f])/i.test(bg)) return "#1a1a1a";
  if (bg.startsWith("#") && bg.length === 7) {
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? "#1a1a1a" : "#ffffff";
  }
  return "#1a1a1a";
}

function abbr(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
}

/**
 * Vertical strip-log: Au heat column + lithology column side-by-side, sharing depth axis.
 */
export function StripLog({
  logs,
  height = 600,
  auWidth = 36,
  lithoWidth = 48,
  altWidth = 48,
  intWidth = 10,
  hoveredId = null,
  onHover,
}: {
  logs: DrillCoreLog[];
  height?: number;
  auWidth?: number;
  lithoWidth?: number;
  altWidth?: number;
  intWidth?: number;
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
}) {
  const sorted = useMemo(
    () => [...logs].sort((a, b) => a.depth_from - b.depth_from),
    [logs]
  );

  const { min, max } = useMemo(() => {
    if (!sorted.length) return { min: 0, max: 1 };
    return {
      min: sorted[0].depth_from,
      max: sorted[sorted.length - 1].depth_to,
    };
  }, [sorted]);

  const span = Math.max(max - min, 0.01);
  const scale = (d: number) => ((d - min) / span) * height;

  const ticks = useMemo(() => {
    const n = 6;
    const out: number[] = [];
    for (let i = 0; i <= n; i++) out.push(min + (span * i) / n);
    return out;
  }, [min, span]);

  // Unique lithologies present (preserve first-seen order)
  const presentLithos = useMemo(() => {
    const seen = new Map<string, string>(); // key=lower, value=original
    for (const l of sorted) {
      const c = (l.lithology ?? "").trim();
      if (!c) continue;
      const k = c.toLowerCase();
      if (!seen.has(k)) seen.set(k, c);
    }
    return Array.from(seen.values());
  }, [sorted]);

  // Unique alterations present (preserve first-seen order)
  const presentAlts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of sorted) {
      const c = (l.alteration ?? "").trim();
      if (!c) continue;
      const k = c.toLowerCase();
      if (!seen.has(k)) seen.set(k, c);
    }
    return Array.from(seen.values());
  }, [sorted]);

  const intercepts = useMemo(() => computeIntercepts(sorted, 0.5, 2), [sorted]);

  if (!sorted.length) return null;

  const headerH = 14;

  return (
    <div className="flex gap-1 select-none" style={{ height: height + headerH }}>
      {/* Depth axis */}
      <div className="flex flex-col" style={{ width: 28 }}>
        <div style={{ height: headerH }} className="text-[9px] font-mono font-semibold text-foreground text-right pr-1">
          m
        </div>
        <div className="relative text-[9px] font-mono text-text-secondary flex-1">
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute right-0 -translate-y-1/2 pr-1"
              style={{ top: scale(t) }}
            >
              {t.toFixed(0)}
            </div>
          ))}
        </div>
      </div>

      {/* Au column */}
      <div className="flex flex-col" style={{ width: auWidth }}>
        <div style={{ height: headerH }} className="text-[9px] font-mono font-semibold text-foreground text-center">
          Au
        </div>
        <div className="relative border border-border bg-bg-secondary rounded-sm overflow-hidden flex-1">
          {sorted.map((l) => {
            const top = scale(l.depth_from);
            const h = Math.max(scale(l.depth_to) - scale(l.depth_from), 1);
            return (
              <div
                key={l.id}
                title={`${l.depth_from}–${l.depth_to} m · Au ${l.au_gpt ?? "—"} g/t`}
                className="absolute left-0 right-0 border-t border-background/40 hover:outline hover:outline-1 hover:outline-foreground/60 cursor-help"
                style={{ top, height: h, background: auColor(l.au_gpt) }}
              />
            );
          })}
        </div>
      </div>

      {/* Lithology column */}
      <div className="flex flex-col" style={{ width: lithoWidth }}>
        <div style={{ height: headerH }} className="text-[9px] font-mono font-semibold text-foreground text-center">
          Lito
        </div>
        <div className="relative border border-border bg-bg-secondary rounded-sm overflow-hidden flex-1">
          {sorted.map((l) => {
            const top = scale(l.depth_from);
            const h = Math.max(scale(l.depth_to) - scale(l.depth_from), 1);
            const bg = lithoColor(l.lithology);
            const code = l.lithology?.trim() || "";
            const label = code ? abbr(code) : "";
            const showLabel = h >= 14 && label.length > 0;
            return (
              <div
                key={l.id}
                title={`${l.depth_from}–${l.depth_to} m${code ? ` · ${code}` : " · sin litología"}`}
                className="absolute left-0 right-0 border-t border-background/40 hover:outline hover:outline-1 hover:outline-foreground/60 cursor-help flex items-center justify-center font-mono font-semibold"
                style={{
                  top,
                  height: h,
                  background: bg,
                  fontSize: 9,
                  color: textOn(bg),
                  letterSpacing: "0.03em",
                }}
              >
                {showLabel ? label : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Alteration column */}
      <div className="flex flex-col" style={{ width: altWidth }}>
        <div style={{ height: headerH }} className="text-[9px] font-mono font-semibold text-foreground text-center">
          Alt
        </div>
        <div className="relative border border-border bg-bg-secondary rounded-sm overflow-hidden flex-1">
          {sorted.map((l) => {
            const top = scale(l.depth_from);
            const h = Math.max(scale(l.depth_to) - scale(l.depth_from), 1);
            const bg = altColor(l.alteration);
            const code = l.alteration?.trim() || "";
            const label = code ? abbr(code) : "";
            const showLabel = h >= 14 && label.length > 0;
            return (
              <div
                key={l.id}
                title={`${l.depth_from}–${l.depth_to} m${code ? ` · ${code}` : " · sin alteración"}`}
                className="absolute left-0 right-0 border-t border-background/40 hover:outline hover:outline-1 hover:outline-foreground/60 cursor-help flex items-center justify-center font-mono font-semibold"
                style={{
                  top,
                  height: h,
                  background: bg,
                  fontSize: 9,
                  color: textOn(bg),
                  letterSpacing: "0.03em",
                }}
              >
                {showLabel ? label : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Intercept marker rail */}
      <div className="flex flex-col" style={{ width: intWidth }}>
        <div style={{ height: headerH }} className="text-[9px] font-mono font-semibold text-foreground text-center">
          Int
        </div>
        <div className="relative border border-border bg-bg-secondary rounded-sm overflow-hidden flex-1">
          {intercepts.map((it, i) => {
            const top = scale(it.from);
            const h = Math.max(scale(it.to) - scale(it.from), 2);
            return (
              <div
                key={i}
                title={formatIntercept(it)}
                className="absolute left-0 right-0 cursor-help"
                style={{
                  top,
                  height: h,
                  background: "#fbbf24",
                  border: "1px solid #b45309",
                  boxShadow: "0 0 4px rgba(251,191,36,0.6)",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Legends */}
      <div className="flex flex-col text-[9px] font-mono text-text-secondary gap-2 pl-1" style={{ marginTop: headerH }}>
        <div className="flex flex-col gap-0.5">
          <div className="font-semibold text-foreground">Au g/t</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#7f1d1d" }} />≥10</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#dc2626" }} />5–10</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#f97316" }} />2–5</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#facc15" }} />1–2</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#84cc16" }} />0.5–1</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#0891b2" }} />0.3–0.5</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#1e3a8a" }} />&lt;0.3</div>
        </div>

        {presentLithos.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <div className="font-semibold text-foreground">Lito</div>
            {presentLithos.map((c) => (
              <div key={c} className="flex items-center gap-1" title={c}>
                <span className="w-2.5 h-2.5 rounded-sm border border-border/50" style={{ background: lithoColor(c) }} />
                <span className="truncate max-w-[70px]">{c}</span>
              </div>
            ))}
          </div>
        )}

        {presentAlts.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <div className="font-semibold text-foreground">Alt</div>
            {presentAlts.map((c) => (
              <div key={c} className="flex items-center gap-1" title={c}>
                <span className="w-2.5 h-2.5 rounded-sm border border-border/50" style={{ background: altColor(c) }} />
                <span className="truncate max-w-[70px]">{c}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

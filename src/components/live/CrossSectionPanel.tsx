// Panel de sección transversal (cross-section) para Los Verdes.
// Recibe A-B (lng/lat) + samples de elevación + intersecciones con vetas/fases
// y dibuja un perfil topográfico SVG con marcadores de intersección.
import { X } from "lucide-react";

export type SectionSample = { dist_m: number; elev_m: number };
export type SectionVeinHit = {
  vein_code: string;
  vein_name: string;
  commodity: string;
  color: string;
  dist_m: number;
  surface_elev_m: number;
  depth_top_m: number;
  depth_bottom_m: number;
};
export type SectionPhaseHit = {
  phase_no: number;
  name: string;
  method: string;
  color: string;
  dist_m_in: number;
  dist_m_out: number;
  base_m: number;
  top_m: number;
};

export function CrossSectionPanel({
  samples,
  veinHits,
  phaseHits,
  onClose,
}: {
  samples: SectionSample[];
  veinHits: SectionVeinHit[];
  phaseHits: SectionPhaseHit[];
  onClose: () => void;
}) {
  if (!samples.length) return null;
  const W = 720;
  const H = 240;
  const padL = 44;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const totalDist = samples[samples.length - 1].dist_m;
  const elevs = samples.map((s) => s.elev_m);
  const depthMin = Math.min(
    ...veinHits.map((v) => v.surface_elev_m - v.depth_bottom_m),
    ...phaseHits.map((p) => p.base_m),
    Math.min(...elevs),
  );
  const elevMax = Math.max(
    ...elevs,
    ...phaseHits.map((p) => p.top_m),
  );
  const yMin = Math.floor((depthMin - 30) / 50) * 50;
  const yMax = Math.ceil((elevMax + 30) / 50) * 50;

  const x = (d: number) => padL + (d / totalDist) * innerW;
  const y = (e: number) => padT + (1 - (e - yMin) / (yMax - yMin)) * innerH;

  const profilePath =
    "M " +
    samples
      .map((s) => `${x(s.dist_m).toFixed(1)},${y(s.elev_m).toFixed(1)}`)
      .join(" L ");
  const fillPath =
    profilePath +
    ` L ${x(totalDist).toFixed(1)},${y(yMin).toFixed(1)}` +
    ` L ${x(0).toFixed(1)},${y(yMin).toFixed(1)} Z`;

  // Ejes Y
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax; v += Math.max(100, Math.round((yMax - yMin) / 5 / 50) * 50)) {
    yTicks.push(v);
  }

  return (
    <div className="absolute inset-x-3 bottom-3 z-30 bg-bg-secondary/98 backdrop-blur border border-gold/40 rounded-lg shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-primary/60">
        <div className="text-[10px] font-mono uppercase tracking-wider text-gold">
          Sección transversal · {(totalDist / 1000).toFixed(2)} km · {samples.length} samples
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar sección"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-3 p-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="flex-1 min-w-0"
          style={{ background: "#0b1220", borderRadius: 6 }}
        >
          {/* Grid + ticks Y */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y(v)}
                y2={y(v)}
                stroke="#1e293b"
                strokeWidth={1}
              />
              <text
                x={padL - 4}
                y={y(v) + 3}
                fontSize={9}
                textAnchor="end"
                fill="#94a3b8"
                fontFamily="ui-monospace,monospace"
              >
                {v}
              </text>
            </g>
          ))}
          {/* Línea AMSL 0 */}
          {yMin < 0 && yMax > 0 && (
            <line
              x1={padL}
              x2={W - padR}
              y1={y(0)}
              y2={y(0)}
              stroke="#475569"
              strokeDasharray="3 3"
            />
          )}

          {/* Fases (rectángulos en profundidad) */}
          {phaseHits.map((p, i) => (
            <rect
              key={`ph-${i}`}
              x={x(p.dist_m_in)}
              y={y(p.top_m)}
              width={Math.max(2, x(p.dist_m_out) - x(p.dist_m_in))}
              height={Math.max(2, y(p.base_m) - y(p.top_m))}
              fill={p.color}
              fillOpacity={0.35}
              stroke={p.color}
              strokeWidth={1}
            />
          ))}

          {/* Perfil topográfico */}
          <path d={fillPath} fill="#1e293b" fillOpacity={0.6} />
          <path d={profilePath} fill="none" stroke="#fbbf24" strokeWidth={1.6} />

          {/* Vetas: línea vertical desde top a bottom en depth */}
          {veinHits.map((v, i) => {
            const topY = y(v.surface_elev_m - v.depth_top_m);
            const botY = y(v.surface_elev_m - v.depth_bottom_m);
            const cx = x(v.dist_m);
            return (
              <g key={`v-${i}`}>
                <line
                  x1={cx}
                  y1={topY}
                  x2={cx}
                  y2={botY}
                  stroke={v.color}
                  strokeWidth={2.2}
                  opacity={0.9}
                />
                <circle cx={cx} cy={y(v.surface_elev_m)} r={3} fill={v.color} />
                <text
                  x={cx + 4}
                  y={y(v.surface_elev_m) - 4}
                  fontSize={9}
                  fill={v.color}
                  fontFamily="ui-monospace,monospace"
                >
                  {v.vein_code}
                </text>
              </g>
            );
          })}

          {/* Eje X */}
          <line
            x1={padL}
            x2={W - padR}
            y1={H - padB}
            y2={H - padB}
            stroke="#475569"
          />
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const dx = padL + t * innerW;
            const d = totalDist * t;
            return (
              <g key={t}>
                <line x1={dx} y1={H - padB} x2={dx} y2={H - padB + 4} stroke="#475569" />
                <text
                  x={dx}
                  y={H - padB + 14}
                  fontSize={9}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontFamily="ui-monospace,monospace"
                >
                  {(d / 1000).toFixed(2)} km
                </text>
              </g>
            );
          })}
          {/* Etiquetas A / B */}
          <text x={padL} y={padT + 8} fontSize={10} fill="#fde047" fontFamily="ui-monospace,monospace">
            A
          </text>
          <text
            x={W - padR}
            y={padT + 8}
            fontSize={10}
            textAnchor="end"
            fill="#fde047"
            fontFamily="ui-monospace,monospace"
          >
            B
          </text>
        </svg>

        <div className="w-[220px] shrink-0 text-[10px] font-mono space-y-2 max-h-[220px] overflow-auto pr-1">
          <div>
            <div className="text-gold uppercase tracking-wider mb-1">Vetas interceptadas</div>
            {veinHits.length === 0 && (
              <div className="text-muted-foreground italic">Sin intersecciones.</div>
            )}
            {veinHits.map((v, i) => (
              <div key={i} className="flex items-center justify-between gap-1 border-b border-border/40 py-0.5">
                <span className="flex items-center gap-1 min-w-0">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: v.color }} />
                  <span className="truncate text-foreground">{v.vein_code}</span>
                </span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {(v.dist_m / 1000).toFixed(2)}km
                </span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-gold uppercase tracking-wider mb-1">Fases interceptadas</div>
            {phaseHits.length === 0 && (
              <div className="text-muted-foreground italic">Sin intersecciones.</div>
            )}
            {phaseHits.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-1 border-b border-border/40 py-0.5">
                <span className="flex items-center gap-1 min-w-0">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
                  <span className="truncate text-foreground">F{p.phase_no} {p.method}</span>
                </span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {((p.dist_m_out - p.dist_m_in) / 1000).toFixed(2)}km
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

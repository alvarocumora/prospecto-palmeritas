// Panel de perfil del corte A-A'. Escala vertical = horizontal (sin exageración)
// para que los manteos aparentes se lean con su ángulo real.
import type { ProfileSample, SectionStructure } from "../sectionProfile";

export function SectionProfilePanel({
  length,
  azimuth,
  profile,
  structures,
  corridor,
  onCorridor,
  onClose,
}: {
  length: number;
  azimuth: number;
  profile: ProfileSample[];
  structures: SectionStructure[];
  corridor: number;
  onCorridor: (m: number) => void;
  onClose: () => void;
}) {
  const known = profile.filter((p) => p.z != null) as { d: number; z: number }[];
  const W = 560;
  const H = 180;
  const pad = 28;
  const zMin = known.length ? Math.min(...known.map((p) => p.z)) : 0;
  const zMax = known.length ? Math.max(...known.map((p) => p.z)) : 1;
  // Same scale both axes when it fits; otherwise flag the vertical exaggeration.
  const sx = (W - pad * 2) / Math.max(1, length);
  const sz = Math.min(sx * 1, (H - pad * 2) / Math.max(1, zMax - zMin)) || sx;
  const vex = sz / sx;
  const scaleZ = vex < 1 ? sx : sz;
  const X = (d: number) => pad + d * sx;
  const Y = (z: number) => H - pad - (z - zMin) * scaleZ;
  const segments: string[] = [];
  let cur = "";
  for (const p of profile) {
    if (p.z == null) {
      if (cur) segments.push(cur);
      cur = "";
      continue;
    }
    cur += `${cur ? "L" : "M"}${X(p.d).toFixed(1)},${Y(p.z).toFixed(1)}`;
  }
  if (cur) segments.push(cur);
  const zAt = (d: number) => {
    let best: { d: number; z: number } | null = null;
    for (const p of known) if (!best || Math.abs(p.d - d) < Math.abs(best.d - d)) best = p;
    return best?.z ?? null;
  };

  return (
    <div className="absolute left-3 right-3 bottom-12 z-20 rounded border border-border bg-bg-secondary/95 p-3 font-mono text-[10px] text-muted-foreground backdrop-blur sm:right-auto sm:w-[600px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">
          Corte A–A′ · {Math.round(length)} m · az {Math.round(azimuth)}°
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            Franja
            <select
              value={corridor}
              onChange={(e) => onCorridor(Number(e.target.value))}
              className="min-h-[32px] rounded border border-border bg-bg-panel px-1 text-foreground"
            >
              {[10, 25, 50, 100].map((m) => (
                <option key={m} value={m}>{m} m</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={onClose} className="min-h-[32px] rounded border border-border px-2 text-foreground hover:bg-bg-panel">
            Cerrar
          </button>
        </div>
      </div>
      {known.length < 2 ? (
        <p className="py-6 text-center">
          Sin relieve disponible para este corte. Usa Perspectiva con el relieve activo.
        </p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Perfil topográfico del corte">
          <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="stroke-border" />
          {segments.map((d, i) => (
            <path key={i} d={d} fill="none" className="stroke-foreground" strokeWidth={1.5} />
          ))}
          {structures.map((s) => {
            const z = zAt(s.d);
            if (z == null) return null;
            const x = X(s.d);
            const y = Y(z);
            const L = 40;
            const a = s.apparentDipDeg != null ? (s.apparentDipDeg * Math.PI) / 180 : null;
            const dir = s.towardB ?? 1;
            return (
              <g key={s.code + s.d} className="text-accent-brand">
                {a != null ? (
                  <line x1={x} y1={y} x2={x + dir * Math.cos(a) * L} y2={y + Math.sin(a) * L} stroke="currentColor" strokeWidth={2} />
                ) : (
                  <line x1={x} y1={y} x2={x} y2={y + 14} stroke="currentColor" strokeWidth={1} strokeDasharray="2 2" />
                )}
                <text x={x + 3} y={y - 4} fill="currentColor" fontSize={9}>{s.code}</text>
              </g>
            );
          })}
          <text x={pad} y={pad - 10} fill="currentColor" fontSize={9}>A</text>
          <text x={W - pad - 6} y={pad - 10} fill="currentColor" fontSize={9}>A′</text>
          <text x={pad} y={H - 8} fill="currentColor" fontSize={9}>
            {Math.round(zMin)}–{Math.round(zMax)} m s.n.m. · {vex < 1 ? "escala 1:1" : `exageración vertical ×${vex.toFixed(1)}`}
          </text>
        </svg>
      )}
      <p className="mt-1 leading-snug">
        Relieve muestreado del terreno mostrado (CAD del titular dentro de su cobertura, DEM regional fuera).
        Trazos: manteo aparente de vetas con manteo MEDIDO; punteado = sin manteo medido, no se proyecta en profundidad.
        Es una proyección geométrica, no una interpretación de continuidad.
      </p>
      {structures.length > 0 && (
        <p className="mt-1">
          {structures.map((s) => `${s.code} @${Math.round(s.d)} m${s.apparentDipDeg != null ? ` (aparente ${Math.round(s.apparentDipDeg)}°)` : ""}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

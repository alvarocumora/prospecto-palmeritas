/**
 * ProjectCover — cover procedural para tarjetas de proyecto sin imagen.
 * Genera una "vista satelital estilizada" única y determinista por proyecto:
 * curvas topográficas + grilla + reticle animado + coordenadas mock.
 * Coloreada por commodity para diferenciar de un vistazo.
 */

type Props = {
  seed: string;
  commodity?: string | null;
  region?: string | null;
  className?: string;
};

// Colores por commodity — sutil, coherente con el theme institucional
const COMMODITY_COLOR: Record<string, { bg: string; line: string; accent: string }> = {
  Au: { bg: "#1a1408", line: "#b8860b", accent: "#f5c452" },
  "Au-Ag": { bg: "#1a1408", line: "#b8860b", accent: "#f5c452" },
  "Au-Cu": { bg: "#1a1206", line: "#c76f1e", accent: "#f19947" },
  Ag: { bg: "#0f1114", line: "#94a3b8", accent: "#e2e8f0" },
  Cu: { bg: "#180d06", line: "#c2410c", accent: "#f97316" },
  "Cu-Au": { bg: "#180d06", line: "#c2410c", accent: "#f97316" },
  "Cu-Zn": { bg: "#0d1116", line: "#0891b2", accent: "#22d3ee" },
  Li: { bg: "#06141a", line: "#0d9488", accent: "#5eead4" },
  Co: { bg: "#0a0b18", line: "#4f46e5", accent: "#a5b4fc" },
  Ni: { bg: "#0b1210", line: "#059669", accent: "#6ee7b7" },
  Fe: { bg: "#180909", line: "#991b1b", accent: "#ef4444" },
};

const DEFAULT_COLOR = { bg: "#0b1220", line: "#2b4acb", accent: "#8fa8ff" };

// PRNG simple determinista por string
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ProjectCover({ seed, commodity, region, className = "" }: Props) {
  const key = commodity ?? "";
  const color = COMMODITY_COLOR[key] ?? COMMODITY_COLOR[key.split("-")[0]] ?? DEFAULT_COLOR;
  const rand = mulberry32(hash(seed));

  // Genera 6-8 curvas topográficas onduladas
  const contours = Array.from({ length: 7 }, (_, i) => {
    const yBase = 20 + i * 22 + rand() * 10;
    const amp = 8 + rand() * 14;
    const freq = 0.02 + rand() * 0.02;
    const phase = rand() * Math.PI * 2;
    const pts: string[] = [];
    for (let x = 0; x <= 400; x += 8) {
      const y = yBase + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3) * (amp / 3);
      pts.push(`${x},${y.toFixed(1)}`);
    }
    return { d: `M ${pts.join(" L ")}`, op: 0.14 + i * 0.05 };
  });

  // Punto de anomalía (target)
  const target = { x: 60 + rand() * 280, y: 80 + rand() * 100 };

  // Coordenada mock (LatAm-ish)
  const lat = -(10 + rand() * 30).toFixed(2);
  const lon = -(50 + rand() * 30).toFixed(2);

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ background: `radial-gradient(ellipse at 30% 30%, ${color.bg} 0%, #05070a 100%)` }}
    >
      <svg
        viewBox="0 0 400 225"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
      >
        {/* Grid tenue */}
        <defs>
          <pattern id={`g-${seed}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.3" opacity="0.08" />
          </pattern>
          <radialGradient id={`glow-${seed}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color.accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color.accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="225" fill={`url(#g-${seed})`} />

        {/* Contornos topográficos */}
        {contours.map((c, i) => (
          <path
            key={i}
            d={c.d}
            fill="none"
            stroke={color.line}
            strokeWidth="0.9"
            opacity={c.op}
          />
        ))}

        {/* Glow del target */}
        <circle cx={target.x} cy={target.y} r="45" fill={`url(#glow-${seed})`} />

        {/* Reticle animado */}
        <g transform={`translate(${target.x}, ${target.y})`}>
          <circle
            r="14"
            fill="none"
            stroke={color.accent}
            strokeWidth="1"
            opacity="0.7"
            className="origin-center"
            style={{ animation: "pc-pulse 2.4s ease-out infinite" }}
          />
          <circle r="4" fill={color.accent} />
          <line x1="-20" y1="0" x2="-8" y2="0" stroke={color.accent} strokeWidth="0.8" opacity="0.8" />
          <line x1="8" y1="0" x2="20" y2="0" stroke={color.accent} strokeWidth="0.8" opacity="0.8" />
          <line x1="0" y1="-20" x2="0" y2="-8" stroke={color.accent} strokeWidth="0.8" opacity="0.8" />
          <line x1="0" y1="8" x2="0" y2="20" stroke={color.accent} strokeWidth="0.8" opacity="0.8" />
        </g>

        {/* Corner brackets */}
        <g stroke="white" strokeWidth="0.7" fill="none" opacity="0.35">
          <path d="M 6 6 L 6 16 M 6 6 L 16 6" />
          <path d="M 394 6 L 394 16 M 394 6 L 384 6" />
          <path d="M 6 219 L 6 209 M 6 219 L 16 219" />
          <path d="M 394 219 L 394 209 M 394 219 L 384 219" />
        </g>

        {/* Coordenadas mock */}
        <text
          x="10"
          y="216"
          fill="white"
          opacity="0.55"
          fontSize="7"
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
          letterSpacing="1"
        >
          {lat}° / {lon}°
        </text>
        {region && (
          <text
            x="390"
            y="216"
            fill="white"
            opacity="0.55"
            fontSize="7"
            textAnchor="end"
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
            letterSpacing="1"
          >
            {region.slice(0, 24).toUpperCase()}
          </text>
        )}
      </svg>

      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(255,255,255,0.06) 2px, rgba(255,255,255,0.06) 3px)",
        }}
      />

      <style>{`
        @keyframes pc-pulse {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          circle[style*="pc-pulse"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

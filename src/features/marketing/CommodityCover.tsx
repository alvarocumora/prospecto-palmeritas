// Portada generativa para lotes de commodities: patrón determinístico por
// forma del material (concentrado granular, cátodos apilados, lingotes doré,
// roca angular, cristales) teñido por el color del commodity. Sin imágenes
// externas — todo SVG, estable por seed (id del lote).
import { useMemo } from "react";
import { commodityColor, commodityShort, formLabel } from "@/lib/commodityLabels";

function mulberry32(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type PatternKind = "granular" | "plates" | "ingots" | "rock" | "crystal";

function patternFor(form: string | null): PatternKind {
  switch (form) {
    case "cathode":
      return "plates";
    case "dore":
    case "bullion":
      return "ingots";
    case "ore":
      return "rock";
    case "carbonate":
    case "hydroxide":
    case "sulphate":
    case "oxide":
      return "crystal";
    default:
      return "granular"; // concentrate y fallback
  }
}

export function CommodityCover({
  seed,
  commodity,
  form,
  className = "",
}: {
  seed: string;
  commodity: string | null;
  form: string | null;
  className?: string;
}) {
  const color = commodityColor(commodity);
  const kind = patternFor(form);

  const shapes = useMemo(() => {
    const rnd = mulberry32(`${seed}:${kind}`);
    const out: React.ReactNode[] = [];
    const W = 420;
    const H = 160;

    if (kind === "granular") {
      for (let i = 0; i < 90; i++) {
        const x = rnd() * W;
        const y = H * 0.35 + rnd() * H * 0.65;
        const r = 1.2 + rnd() * 3.4;
        out.push(<circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.14 + rnd() * 0.3} />);
      }
    } else if (kind === "plates") {
      for (let i = 0; i < 7; i++) {
        const w = 90 + rnd() * 60;
        const x = 40 + i * 44 + rnd() * 10;
        const y = H - 26 - i * 13;
        out.push(
          <rect
            key={i}
            x={x - w / 2}
            y={y}
            width={w}
            height={9}
            rx={1.5}
            fill={color}
            opacity={0.18 + i * 0.05}
            transform={`skewX(-18)`}
          />,
        );
      }
    } else if (kind === "ingots") {
      for (let i = 0; i < 6; i++) {
        const x = 60 + i * 62 + rnd() * 14;
        const y = H - 34 - (i % 2) * 22;
        out.push(
          <path
            key={i}
            d={`M ${x} ${y} l 44 0 l -7 16 l -30 0 z`}
            fill={color}
            opacity={0.22 + rnd() * 0.22}
          />,
        );
      }
    } else if (kind === "rock") {
      for (let i = 0; i < 8; i++) {
        const cx = rnd() * W;
        const cy = H * 0.5 + rnd() * H * 0.5;
        const s = 14 + rnd() * 26;
        const pts = Array.from({ length: 6 }, (_, k) => {
          const ang = (k / 6) * Math.PI * 2 + rnd() * 0.5;
          const rr = s * (0.7 + rnd() * 0.5);
          return `${cx + Math.cos(ang) * rr},${cy + Math.sin(ang) * rr * 0.7}`;
        }).join(" ");
        out.push(<polygon key={i} points={pts} fill={color} opacity={0.12 + rnd() * 0.2} />);
      }
    } else {
      // crystal
      for (let i = 0; i < 14; i++) {
        const cx = rnd() * W;
        const cy = H * 0.4 + rnd() * H * 0.6;
        const s = 8 + rnd() * 16;
        out.push(
          <path
            key={i}
            d={`M ${cx} ${cy - s} L ${cx + s * 0.6} ${cy} L ${cx} ${cy + s} L ${cx - s * 0.6} ${cy} Z`}
            fill={color}
            opacity={0.14 + rnd() * 0.26}
          />,
        );
      }
    }
    return out;
  }, [seed, kind, color]);

  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 420 160"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <linearGradient id={`cc-bg-${seed}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#101826" />
            <stop offset="100%" stopColor="#0a0f18" />
          </linearGradient>
          <radialGradient id={`cc-glow-${seed}`} cx="75%" cy="20%" r="70%">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="420" height="160" fill={`url(#cc-bg-${seed})`} />
        <rect width="420" height="160" fill={`url(#cc-glow-${seed})`} />
        {/* Grid sutil */}
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * 52.5}
            y1="0"
            x2={i * 52.5}
            y2="160"
            stroke="#ffffff"
            strokeOpacity="0.03"
          />
        ))}
        {shapes}
        {/* Watermark del commodity */}
        <text
          x="16"
          y="42"
          fontFamily="ui-monospace, monospace"
          fontSize="30"
          fontWeight="700"
          fill={color}
          opacity="0.85"
          letterSpacing="1"
        >
          {commodityShort(commodity)}
        </text>
        <text
          x="17"
          y="58"
          fontFamily="ui-monospace, monospace"
          fontSize="9"
          fill="#ffffff"
          opacity="0.45"
          letterSpacing="2"
        >
          {(formLabel(form) ?? "").toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

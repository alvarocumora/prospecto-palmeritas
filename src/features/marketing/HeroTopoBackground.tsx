/* Fondo topográfico SVG con "drift" lento. Puramente decorativo. */
export function HeroTopoBackground() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.14] topo-drift"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <defs>
        <radialGradient id="topo-mask" cx="55%" cy="45%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="topo-fade">
          <rect width="1200" height="800" fill="url(#topo-mask)" />
        </mask>
      </defs>
      <g stroke="#ffffff" strokeWidth="0.6" mask="url(#topo-fade)">
        {Array.from({ length: 16 }).map((_, i) => {
          const r = 60 + i * 55;
          return (
            <path
              key={i}
              d={`M ${600 - r},400
                  Q ${600 - r * 0.6},${400 - r * 0.5} 600,${400 - r * 0.7}
                  Q ${600 + r * 0.6},${400 - r * 0.5} ${600 + r},400
                  Q ${600 + r * 0.6},${400 + r * 0.55} 600,${400 + r * 0.72}
                  Q ${600 - r * 0.6},${400 + r * 0.55} ${600 - r},400 Z`}
              opacity={0.5 + (i % 4) * 0.12}
            />
          );
        })}
      </g>
    </svg>
  );
}

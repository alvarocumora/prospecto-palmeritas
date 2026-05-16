const CROSS_SECTION_LAYERS = [
  { y: 30, h: 40, color: "var(--gold)", label: "Cap supérgeno", depth: "0–15 m" },
  { y: 70, h: 60, color: "var(--copper)", label: "Zona oxidada", depth: "15–50 m" },
  { y: 130, h: 80, color: "var(--info)", label: "Sulfuros primarios", depth: "50–150 m" },
  { y: 210, h: 60, color: "var(--teal)", label: "Drill target", depth: "150–300 m" },
] as const;

export function CrossSection() {
  return (
    <div className="relative h-72 rounded border border-border bg-bg-secondary overflow-hidden p-4">
      <svg viewBox="0 0 400 280" className="w-full h-full">
        <line x1="40" y1="20" x2="40" y2="270" stroke="var(--border)" strokeWidth="1" />
        {[0, 75, 150, 225, 300].map((depth, index) => (
          <g key={depth}>
            <line x1="36" y1={30 + index * 60} x2="40" y2={30 + index * 60} stroke="var(--hint)" />
            <text
              x="32"
              y={34 + index * 60}
              fontSize="9"
              fill="var(--muted-foreground)"
              textAnchor="end"
              fontFamily="monospace"
            >
              {depth}m
            </text>
          </g>
        ))}

        {CROSS_SECTION_LAYERS.map((layer) => (
          <g key={layer.label}>
            <rect
              x="50"
              y={layer.y}
              width="220"
              height={layer.h}
              fill={layer.color}
              fillOpacity="0.25"
              stroke={layer.color}
            />
            <text
              x="60"
              y={layer.y + 16}
              fontSize="10"
              fill="var(--foreground)"
              fontFamily="monospace"
            >
              {layer.label}
            </text>
            <text
              x="60"
              y={layer.y + 28}
              fontSize="9"
              fill="var(--muted-foreground)"
              fontFamily="monospace"
            >
              {layer.depth}
            </text>
          </g>
        ))}

        <line x1="140" y1="30" x2="180" y2="270" stroke="var(--gold-light)" strokeWidth="3" />
        <text x="190" y="50" fontSize="9" fill="var(--gold-light)" fontFamily="monospace">
          Veta Au–Cu
        </text>

        <line
          x1="290"
          y1="30"
          x2="340"
          y2="240"
          stroke="var(--alert)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <text x="300" y="25" fontSize="9" fill="var(--alert)" fontFamily="monospace">
          DDH-001
        </text>
      </svg>
    </div>
  );
}

import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SectionHeading } from "@/components/brand";
import { Reveal } from "@/features/marketing/Reveal";

const MAP_DOTS = [
  { x: "31%", y: "38%", color: "#fcd34d", ring: "#fcd34d22", label: "Au-Ag · JV", price: "8.5M" },
  { x: "54%", y: "52%", color: "#10b981", ring: "#10b98122", label: "Li · Venta", price: "4.2M" },
  { x: "72%", y: "29%", color: "#60a5fa", ring: "#60a5fa22", label: "Au-Cu · JV", price: "6.8M" },
  { x: "19%", y: "61%", color: "#fcd34d", ring: "#fcd34d22", label: "Au · Royalty", price: "3%" },
  {
    x: "63%",
    y: "68%",
    color: "#f472b6",
    ring: "#f472b622",
    label: "Ag · Opción",
    price: "12M",
  },
];

const MINI_CHART_PTS = [
  45, 42, 38, 40, 35, 30, 32, 28, 25, 22, 20, 18, 15, 18, 12, 10, 8, 12, 8, 5, 3,
];

const LISTINGS = [
  { title: "Prospecto Las Palmeras", c: "Au-Ag", price: "US$ 8.5M", modality: "JV", up: true },
  { title: "Salar Atacama Norte", c: "Li", price: "US$ 4.2M", modality: "Venta", up: true },
  { title: "Río Blanco Sur", c: "Au-Cu", price: "US$ 6.8M", modality: "JV", up: false },
  { title: "Mina Santa Rosa", c: "Ag", price: "US$ 12M", modality: "Opción", up: true },
];

const KPIS = [
  { v: "47k+", l: "Concesiones" },
  { v: "124", l: "Proyectos" },
  { v: "312", l: "Inversores" },
  { v: "18", l: "Países" },
];

export function PlatformPreview() {
  const W = 220,
    H = 64;
  const pts = MINI_CHART_PTS;
  const xStep = W / (pts.length - 1);
  const polyPts = pts.map((y, i) => `${i * xStep},${y}`).join(" ");
  const areaPts = `${polyPts} ${(pts.length - 1) * xStep},${H} 0,${H}`;

  return (
    <section className="max-w-7xl mx-auto px-5 py-20">
      <Reveal className="text-center mb-12">
        <SectionHeading
          align="center"
          eyebrow="Terminal en acción"
          title="Una interfaz diseñada para decisiones rápidas"
          description="Catastro, geología 3D, deal flow y cumplimiento NI 43-101 en un solo lugar."
          className="max-w-2xl mx-auto"
        />
      </Reveal>

      {/* Browser mock — horizontally scrollable on small screens */}
      <Reveal delay={120} className="overflow-x-auto -mx-5 px-5">
        <div
          className="min-w-[780px] rounded-2xl border border-white/10 shadow-[0_40px_100px_-20px_rgba(11,42,91,0.45)] overflow-hidden"
          style={{ background: "#07111f" }}
        >
          {/* Chrome bar */}
          <div
            className="h-9 border-b flex items-center px-3 gap-2"
            style={{ background: "#0d1e38", borderColor: "rgba(255,255,255,0.07)" }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
            <div
              className="mx-4 flex-1 max-w-xs h-5 rounded flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                geocapitals.io/terminal
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#10b981" }}
              />
              <span className="text-[9px] font-mono" style={{ color: "rgba(16,185,129,0.8)" }}>
                LIVE
              </span>
            </div>
          </div>

          {/* App top-nav */}
          <div
            className="h-8 border-b flex items-center px-4 gap-5"
            style={{
              background: "#0b1628",
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            {["MAPA", "3D", "CATASTRO", "DEALS", "NI 43-101", "LEGAL"].map((tab, i) => (
              <span
                key={tab}
                className="text-[10px] font-mono tracking-wider"
                style={{
                  color: i === 0 ? "var(--accent-brand-subtle)" : "rgba(255,255,255,0.25)",
                  borderBottom: i === 0 ? "1.5px solid var(--accent-brand-subtle)" : "none",
                  paddingBottom: i === 0 ? "2px" : undefined,
                }}
              >
                {tab}
              </span>
            ))}
            <span
              className="ml-auto text-[9px] font-mono"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              TRK-ALH-001 · Palmeras · Au-Ag
            </span>
          </div>

          {/* Main area */}
          <div className="flex" style={{ height: 400 }}>
            {/* Left: satellite map panel */}
            <div
              className="flex-1 relative overflow-hidden"
              style={{
                background: "linear-gradient(160deg, #0b2240 0%, #0d1a30 60%, #08111e 100%)",
                backgroundImage: [
                  "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
                  "linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
                ].join(", "),
                backgroundSize: "36px 36px",
              }}
            >
              {/* Terrain SVG */}
              <svg
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="xMidYMid slice"
                aria-hidden="true"
              >
                {/* Elevation blobs */}
                <radialGradient id="blob1" cx="35%" cy="45%" r="30%">
                  <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#0b1628" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="blob2" cx="68%" cy="35%" r="25%">
                  <stop offset="0%" stopColor="#162a48" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#0b1628" stopOpacity="0" />
                </radialGradient>
                <rect width="100%" height="100%" fill="url(#blob1)" />
                <rect width="100%" height="100%" fill="url(#blob2)" />

                {/* Concession polygons */}
                <polygon
                  points="155,70 245,52 288,118 235,162 148,138"
                  fill="rgba(99,102,241,0.18)"
                  stroke="rgba(99,102,241,0.55)"
                  strokeWidth="1"
                />
                <polygon
                  points="295,96 368,82 398,152 348,175 285,148"
                  fill="rgba(99,102,241,0.15)"
                  stroke="rgba(99,102,241,0.45)"
                  strokeWidth="1"
                />
                <polygon
                  points="75,178 145,158 178,222 115,246 65,218"
                  fill="rgba(99,102,241,0.15)"
                  stroke="rgba(99,102,241,0.45)"
                  strokeWidth="1"
                />
                <polygon
                  points="330,200 400,188 430,250 385,278 318,255"
                  fill="rgba(99,102,241,0.12)"
                  stroke="rgba(99,102,241,0.38)"
                  strokeWidth="1"
                />

                {/* Anomaly halos */}
                <circle
                  cx="195"
                  cy="107"
                  r="28"
                  fill="rgba(232,121,249,0.1)"
                  stroke="rgba(232,121,249,0.38)"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
                <circle
                  cx="328"
                  cy="128"
                  r="20"
                  fill="rgba(232,121,249,0.1)"
                  stroke="rgba(232,121,249,0.38)"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
                <circle
                  cx="108"
                  cy="210"
                  r="14"
                  fill="rgba(232,121,249,0.08)"
                  stroke="rgba(232,121,249,0.3)"
                  strokeWidth="0.8"
                  strokeDasharray="2 4"
                />

                {/* Drill-hole traces */}
                {[
                  [195, 107],
                  [210, 112],
                  [183, 100],
                  [200, 125],
                  [207, 99],
                ].map(([x, y], i) => (
                  <g key={i}>
                    <line
                      x1={x}
                      y1={y}
                      x2={x}
                      y2={y + 35}
                      stroke="rgba(252,211,77,0.55)"
                      strokeWidth="1.2"
                      strokeDasharray="2 2"
                    />
                    <circle cx={x} cy={y} r="3" fill="#fcd34d" stroke="#07111f" strokeWidth="1" />
                  </g>
                ))}

                {/* Satellite path arc */}
                <path
                  d="M 20 20 Q 250 -10 480 40"
                  fill="none"
                  stroke="rgba(96,165,250,0.15)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                <circle cx="480" cy="40" r="4" fill="rgba(96,165,250,0.4)" />
              </svg>

              {/* Project marker dots */}
              {MAP_DOTS.map((d) => (
                <div
                  key={d.label}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: d.x, top: d.y }}
                >
                  {/* outer halo */}
                  <div
                    className="absolute -inset-3 rounded-full animate-pulse opacity-40"
                    style={{ background: d.ring }}
                  />
                  {/* dot */}
                  <div
                    className="relative w-3 h-3 rounded-full border-2 z-10"
                    style={{ background: d.color, borderColor: "#07111f" }}
                  />
                  {/* tooltip */}
                  <div
                    className="absolute top-4 left-1/2 -translate-x-1/2 rounded text-[8px] font-mono px-1.5 py-0.5 whitespace-nowrap border z-20"
                    style={{
                      background: "rgba(7,17,31,0.92)",
                      color: "rgba(255,255,255,0.8)",
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    {d.label}
                  </div>
                </div>
              ))}

              {/* Map legend */}
              <div
                className="absolute bottom-3 left-3 rounded-md border px-2.5 py-2 text-[9px] font-mono space-y-1.5"
                style={{
                  background: "rgba(7,17,31,0.88)",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-2.5 rounded-sm opacity-60"
                    style={{ background: "#6366f1" }}
                  />
                  Concesión minera
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full border"
                    style={{
                      borderColor: "#e879f9",
                      borderStyle: "dashed",
                      background: "rgba(232,121,249,0.1)",
                    }}
                  />
                  Anomalía satelital
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: "#fcd34d" }} />
                  Sondaje
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
                  Listado activo
                </div>
              </div>

              {/* Source badge */}
              <div
                className="absolute bottom-3 right-3 text-[8px] font-mono"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                PostGIS · Sentinel-2 · SERNAGEOMIN
              </div>

              {/* Top pill stats */}
              <div className="absolute top-3 left-3 flex gap-2">
                {[
                  { label: "5 listados", color: "#fcd34d" },
                  { label: "12 anomalías", color: "#e879f9" },
                ].map((p) => (
                  <span
                    key={p.label}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-mono border"
                    style={{
                      background: "rgba(7,17,31,0.88)",
                      borderColor: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: data panels */}
            <div
              className="w-64 border-l flex flex-col shrink-0"
              style={{ background: "#0d1e38", borderColor: "rgba(255,255,255,0.07)" }}
            >
              {/* Listings panel */}
              <div
                className="border-b p-3"
                style={{ borderColor: "rgba(255,255,255,0.07)", flex: "0 0 auto" }}
              >
                <div
                  className="text-[8px] font-mono uppercase tracking-widest mb-2.5"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Listados activos · {LISTINGS.length}
                </div>
                {LISTINGS.map((l) => (
                  <div
                    key={l.title}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  >
                    <div className="min-w-0">
                      <div
                        className="text-[10px] font-mono leading-tight truncate max-w-[120px]"
                        style={{ color: "rgba(255,255,255,0.75)" }}
                      >
                        {l.title}
                      </div>
                      <div
                        className="text-[8px] font-mono mt-0.5"
                        style={{ color: "var(--accent-brand-subtle)" }}
                      >
                        {l.c} · {l.modality}
                      </div>
                    </div>
                    <div
                      className="text-[10px] font-mono font-semibold shrink-0 ml-2"
                      style={{ color: l.up ? "#10b981" : "#f87171" }}
                    >
                      {l.price}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mini price chart */}
              <div
                className="border-b p-3"
                style={{ borderColor: "rgba(255,255,255,0.07)", flex: "0 0 auto" }}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div
                    className="text-[8px] font-mono uppercase tracking-widest"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    XAU Spot · 30d
                  </div>
                  <div className="text-[11px] font-mono font-semibold" style={{ color: "#fcd34d" }}>
                    3,247.80
                  </div>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 52 }}>
                  <defs>
                    <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#fcd34d" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={areaPts} fill="url(#chart-fill)" className="chart-fade" />
                  <polyline
                    className="chart-line"
                    pathLength={1}
                    points={polyPts}
                    fill="none"
                    stroke="#fcd34d"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <text
                    x="2"
                    y={H - 2}
                    fill="rgba(255,255,255,0.2)"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    US$2,950
                  </text>
                  <text
                    x={W - 2}
                    y="10"
                    fill="rgba(252,211,77,0.7)"
                    fontSize="7"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    US$3,247
                  </text>
                </svg>
                <div
                  className="text-[9px] font-mono mt-1"
                  style={{ color: "rgba(16,185,129,0.8)" }}
                >
                  +9.8% · 30 días
                </div>
              </div>

              {/* KPI grid */}
              <div className="p-3 grid grid-cols-2 gap-1.5">
                {KPIS.map(({ v, l }) => (
                  <div
                    key={l}
                    className="rounded p-2"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div
                      className="font-mono text-base font-semibold"
                      style={{ color: "rgba(255,255,255,0.9)" }}
                    >
                      {v}
                    </div>
                    <div
                      className="text-[8px] font-mono uppercase tracking-wider mt-0.5"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {l}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* status bar */}
          <div
            className="h-7 border-t flex items-center justify-between px-4"
            style={{ background: "#0b1628", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <span className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
              Sentinel-2 L2A · 2024-07-01 · Coquimbo Region · Chile
            </span>
            <div className="flex items-center gap-4">
              <span
                className="flex items-center gap-1 text-[9px] font-mono"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10b981" }} />
                Conexión segura · TLS 1.3
              </span>
              <span className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                PostGIS 16 · AES-256
              </span>
            </div>
          </div>
        </div>
      </Reveal>

      {/* CTA below preview */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/terminal"
          className="inline-flex items-center gap-2 bg-accent-brand text-white px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition"
        >
          Abrir terminal en vivo <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 border border-hairline text-content px-5 py-2.5 rounded-md text-sm font-medium hover:border-accent-brand hover:text-accent-brand transition"
        >
          Solicitar acceso institucional
        </Link>
      </div>
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowRight, Layers, Crosshair, Compass, Satellite, BarChart3, ClipboardCheck } from "lucide-react";
import relief from "@/assets/hero-chile-relief.jpg";

/** Proyectos reales del portafolio; posición aproximada en % del lienzo. */
const MARKERS = [
  { slug: "losverdes", name: "Los Verdes", region: "Coquimbo", x: 63, y: 38 },
  { slug: "cholqui", name: "Cholqui", region: "RM", x: 66, y: 56 },
  { slug: "palmeritas", name: "Palmeritas", region: "Atacama", x: 61, y: 22 },
];

const VALUES = [
  { icon: Layers, label: "Datos geoespaciales", sub: "más ricos" },
  { icon: Crosshair, label: "Análisis", sub: "más preciso" },
  { icon: Compass, label: "Decisiones", sub: "mejor fundadas" },
];

const INTEL = [
  { icon: Layers, label: "Capas geológicas", to: "/catastro/mapa" },
  { icon: Satellite, label: "Imágenes satelitales", to: "/terminal/cholqui" },
  { icon: BarChart3, label: "Análisis de datos", to: "/terminal/losverdes" },
  { icon: ClipboardCheck, label: "Evaluación de proyectos", to: "/terminal" },
];

const LEGEND = [
  { label: "Cobre", cls: "bg-copper" },
  { label: "Litio", cls: "bg-signal-cyan" },
  { label: "Oro", cls: "bg-signal-amber" },
  { label: "Otros", cls: "bg-muted-foreground" },
];

export function HeroGeospatial() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background text-foreground min-h-[680px]">
      <img src={relief} alt="Relieve satelital de Chile" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />

      {/* Retículo táctico + marcadores reales */}
      <svg aria-hidden className="absolute inset-0 h-full w-full text-signal-cyan" preserveAspectRatio="none">
        {[90, 160, 240].map((r) => (
          <circle key={r} cx="66%" cy="56%" r={r} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeDasharray="3 6" />
        ))}
        <line x1="66%" y1="0" x2="66%" y2="100%" stroke="currentColor" strokeOpacity={0.12} />
        <line x1="0" y1="56%" x2="100%" y2="56%" stroke="currentColor" strokeOpacity={0.12} />
      </svg>
      <div className="absolute left-[71%] top-[62%] hidden md:block font-mono text-xs tracking-[0.5em] text-muted-foreground">CHILE</div>
      {MARKERS.map((m) => (
        <Link
          key={m.slug}
          to="/terminal/$slug"
          params={{ slug: m.slug }}
          className="group absolute hidden md:flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
        >
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute h-4 w-4 animate-ping rounded-full bg-copper/40" />
            <span className="h-0 w-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-signal-amber" />
          </span>
          <span className="rounded-sm border border-border bg-background/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest opacity-70 backdrop-blur transition group-hover:opacity-100 group-hover:border-signal-cyan">
            {m.name} · {m.region}
          </span>
        </Link>
      ))}

      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pt-20 pb-16 lg:grid-cols-[1.2fr_1fr] lg:pt-28">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Geocapitals · Inteligencia minera geoespacial
          </div>
          <h1 className="mt-6 font-serif text-5xl leading-[1.02] sm:text-7xl">
            De la geología
            <span className="block bg-gradient-to-r from-copper via-signal-amber to-copper bg-clip-text text-transparent">
              a la oportunidad
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Explora proyectos mineros de Chile con catastro oficial, satélite real y relieve 3D en una sola plataforma.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/catastro/mapa" className="inline-flex items-center gap-2 rounded-sm bg-copper px-6 py-3 text-sm font-medium text-background transition hover:opacity-90">
              Explorar oportunidades mineras <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/inversion-colateral" className="inline-flex items-center gap-2 rounded-sm border border-border px-6 py-3 text-sm transition hover:border-signal-cyan">
              Invertir con colateral
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-6">
            {VALUES.map(({ icon: I, label, sub }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-border text-signal-cyan"><I className="h-4 w-4" /></span>
                <div className="font-mono text-[10px] uppercase tracking-widest leading-tight">
                  {label}<div className="text-muted-foreground">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 lg:justify-end">
          <div className="w-full max-w-xs rounded-sm border border-border bg-background/70 p-4 backdrop-blur-md">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Potencial mineral</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {LEGEND.map((l) => (
                <div key={l.label} className="flex items-center gap-2 text-xs">
                  <span className={`h-2 w-2 rounded-full ${l.cls}`} /> {l.label}
                </div>
              ))}
            </div>
          </div>
          <div className="w-full max-w-xs rounded-sm border border-border bg-background/70 p-4 backdrop-blur-md">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Geo-inteligencia</div>
            <ul className="mt-3 divide-y divide-border">
              {INTEL.map(({ icon: I, label, to }) => (
                <li key={label}>
                  <Link to={to} className="flex items-center justify-between py-2 text-sm transition hover:text-signal-cyan">
                    <span className="flex items-center gap-2"><I className="h-4 w-4 text-signal-cyan" /> {label}</span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-50" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

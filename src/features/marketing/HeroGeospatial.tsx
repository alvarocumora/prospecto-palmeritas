import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Layers,
  Crosshair,
  Compass,
  Satellite,
  BarChart3,
  ClipboardCheck,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { PUBLIC_INTELLIGENCE_PATHS } from "./landingNavigation";
import featureCatastro from "@/assets/feature-catastro.jpg";

const HeroTerrain3D = lazy(() => import("./HeroTerrain3D"));

const VALUES = [
  { icon: Layers, label: "Datos geoespaciales", sub: "más ricos" },
  { icon: Crosshair, label: "Análisis", sub: "más preciso" },
  { icon: Compass, label: "Decisiones", sub: "mejor fundadas" },
];

const INTEL = [
  { icon: Layers, label: "Capas geológicas", to: PUBLIC_INTELLIGENCE_PATHS.geologicalLayers },
  {
    icon: Satellite,
    label: "Imágenes satelitales",
    to: PUBLIC_INTELLIGENCE_PATHS.satelliteImagery,
  },
  { icon: BarChart3, label: "Análisis de datos", to: PUBLIC_INTELLIGENCE_PATHS.dataAnalysis },
  {
    icon: ClipboardCheck,
    label: "Evaluación de proyectos",
    to: PUBLIC_INTELLIGENCE_PATHS.projectEvaluation,
  },
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
      <div className="absolute inset-y-0 right-0 w-full md:w-[62%]">
        {/* Bundled imagery remains visible when WebGL, remote DEM or SSR is unavailable.
            This is decorative context, NOT a georeferenced analytical layer. */}
        <img
          src={featureCatastro}
          alt=""
          aria-hidden="true"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-25 saturate-75"
        />
        <ClientOnly fallback={null}>
          <Suspense fallback={null}>
            <HeroTerrain3D />
          </Suspense>
        </ClientOnly>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent md:via-background/40" />

      <div className="pointer-events-none relative mx-auto grid max-w-7xl gap-10 px-5 pt-20 pb-16 lg:grid-cols-[1.2fr_1fr] lg:pt-28">
        <div className="pointer-events-auto">
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
            Explora proyectos mineros de Chile con catastro oficial, satélite real y relieve 3D en
            una sola plataforma.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#invertir"
              className="inline-flex items-center gap-2 rounded-sm bg-copper px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
            >
              Ver proyectos en explotación <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              to="/proyectos"
              className="inline-flex items-center gap-2 rounded-sm border border-border px-6 py-3 text-sm transition hover:border-signal-cyan"
            >
              Catálogo de proyectos
            </Link>
          </div>
          <Link
            to="/inversion-colateral"
            className="mt-3 inline-block text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Alternativa: renta fija con parcela en garantía →
          </Link>
          <div className="mt-10 flex flex-wrap gap-6">
            {VALUES.map(({ icon: I, label, sub }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-border text-signal-cyan">
                  <I className="h-4 w-4" />
                </span>
                <div className="font-mono text-[10px] uppercase tracking-widest leading-tight">
                  {label}
                  <div className="text-muted-foreground">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-4 lg:justify-start">
          <div className="w-full max-w-xs rounded-sm border border-border bg-background/70 p-4 backdrop-blur-md">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Potencial mineral
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {LEGEND.map((l) => (
                <div key={l.label} className="flex items-center gap-2 text-xs">
                  <span className={`h-2 w-2 rounded-full ${l.cls}`} /> {l.label}
                </div>
              ))}
            </div>
          </div>
          <div className="w-full max-w-xs rounded-sm border border-border bg-background/70 p-4 backdrop-blur-md">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Geo-inteligencia
            </div>
            <ul className="mt-3 divide-y divide-border">
              {INTEL.map(({ icon: I, label, to }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="flex items-center justify-between py-2 text-sm transition hover:text-signal-cyan"
                  >
                    <span className="flex items-center gap-2">
                      <I className="h-4 w-4 text-signal-cyan" /> {label}
                    </span>
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

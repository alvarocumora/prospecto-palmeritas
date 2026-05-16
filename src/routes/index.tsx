import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Map,
  Activity,
  Drill,
  TestTube2,
  ArrowRight,
  Shield,
  Layers,
  Zap,
  Play,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import heroImage from "@/assets/hero-mining.jpg";
import featureCatastro from "@/assets/feature-catastro.jpg";
import featureGeophysics from "@/assets/feature-geophysics.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Geocapitals — Plataforma para exploración minera moderna" },
      {
        name: "description",
        content:
          "Geocapitals: gestiona campañas de exploración, catastro minero, geofísica y sondajes en una plataforma limpia, rápida y diseñada por geólogos.",
      },
      { property: "og:title", content: "Geocapitals — Exploración minera moderna" },
      {
        property: "og:description",
        content:
          "Catastro, geofísica, sondajes y muestreo en una sola plataforma para geólogos profesionales.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="group">
            <Logo size={22} textClassName="text-sm group-hover:text-gold transition-colors" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden sm:inline-block px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/auth"
              className="px-3 py-1.5 text-xs font-mono rounded-md bg-gold text-background hover:bg-gold-light transition-colors shadow-[0_0_20px_-5px_oklch(0.78_0.13_75/0.5)]"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero with image */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            alt="Exploración minera en los Andes"
            width={1920}
            height={1080}
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-20 pb-28 text-center">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gold/30 bg-gold/5 text-[10px] font-mono uppercase tracking-wider text-gold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            Para geólogos de exploración
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Inteligencia geológica para
            <br />
            <span className="bg-gradient-to-r from-gold via-gold-light to-copper bg-clip-text text-transparent">
              exploración minera moderna.
            </span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Geocapitals reúne catastro minero, campañas geofísicas, sondajes y muestreo en una
            plataforma limpia, rápida y diseñada por geólogos.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-gold text-background font-mono text-sm font-semibold hover:bg-gold-light transition-all shadow-[0_0_30px_-5px_oklch(0.78_0.13_75/0.6)] hover:shadow-[0_0_40px_-5px_oklch(0.78_0.13_75/0.8)]"
            >
              Crear cuenta gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/dashboard/palmeras"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-border bg-bg-secondary/80 backdrop-blur text-foreground font-mono text-sm hover:bg-accent hover:border-gold/40 transition-colors"
            >
              <Play className="w-3.5 h-3.5" /> Ver demo
            </Link>
          </div>

          {/* Trust strip */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
            <span>Datos SERNAGEOMIN</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>WMS Geofísica EMAG2</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>Macrostrat Geology</span>
          </div>
        </div>
      </section>

      {/* Feature visuals */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-4">
          <VisualFeature
            image={featureCatastro}
            tag="Catastro"
            title="Concesiones mineras en tiempo real"
            desc="Búsqueda contra SERNAGEOMIN, alertas de vencimiento, intersección con AOI y exportación a PDF."
          />
          <VisualFeature
            image={featureGeophysics}
            tag="Geofísica"
            title="Anomalías Mag · IP · CSAMT"
            desc="Planifica líneas, captura estaciones y visualiza heatmaps directamente sobre el mapa del proyecto."
          />
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="text-center mb-10">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gold">Módulos</span>
          <h2 className="text-2xl md:text-3xl font-bold mt-2">Todo lo que tu campaña necesita</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <FeatureCard
            icon={<Map className="w-5 h-5 text-gold" />}
            title="Catastro minero integrado"
            desc="Búsqueda en tiempo real contra SERNAGEOMIN. Alertas de vencimiento, intersección con AOI, exportación a PDF."
          />
          <FeatureCard
            icon={<Activity className="w-5 h-5 text-info" />}
            title="Campañas geofísicas"
            desc="Planifica y ejecuta levantamientos Mag, IP, CSAMT. Líneas, estaciones y resultados sobre el mapa."
          />
          <FeatureCard
            icon={<Drill className="w-5 h-5 text-copper" />}
            title="Sondajes y testigos"
            desc="Diseña programas DDH, registra avance, log de testigos con leyes Au/Cu/Ag, RQD y recovery."
          />
          <FeatureCard
            icon={<TestTube2 className="w-5 h-5 text-teal" />}
            title="Muestreo y laboratorio"
            desc="Captura muestras superficiales y de canal. Trazabilidad de lab, certificados y mapas de anomalías."
          />
        </div>
      </section>

      {/* Why */}
      <section className="border-t border-border bg-bg-secondary/40">
        <div className="max-w-5xl mx-auto px-4 py-20 grid md:grid-cols-3 gap-8 text-sm">
          <Why
            icon={<Shield className="w-4 h-4 text-gold" />}
            title="Datos seguros por proyecto"
            desc="Cada proyecto con su equipo, roles y permisos. RLS a nivel de fila."
          />
          <Why
            icon={<Layers className="w-4 h-4 text-gold" />}
            title="Mapa con todas tus capas"
            desc="Catastro, geofísica WMS regional, geología Macrostrat, opacidad por capa."
          />
          <Why
            icon={<Zap className="w-4 h-4 text-gold" />}
            title="Sin instalación"
            desc="Funciona en el navegador. Tus geólogos de campo trabajan desde el celular."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="relative max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-48 bg-gradient-to-r from-transparent via-gold/10 to-transparent blur-3xl pointer-events-none" />
        <div className="relative">
          <Logo size={32} showText={false} className="mb-6 justify-center" />
          <h2 className="text-2xl md:text-3xl font-bold">¿Listo para tu próxima campaña?</h2>
          <p className="mt-3 text-muted-foreground">
            Crea tu cuenta y empieza a gestionar proyectos en minutos.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-md bg-gold text-background font-mono text-sm font-semibold hover:bg-gold-light transition-colors shadow-[0_0_30px_-5px_oklch(0.78_0.13_75/0.6)]"
          >
            Empezar ahora <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-muted-foreground">
          <Logo size={16} textClassName="text-[11px]" />
          <span>© {new Date().getFullYear()} Geocapitals · Hecho para geólogos</span>
        </div>
      </footer>
    </div>
  );
}

function VisualFeature({
  image,
  tag,
  title,
  desc,
}: {
  image: string;
  tag: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="group relative rounded-lg border border-border bg-bg-secondary overflow-hidden hover:border-gold/40 transition-colors">
      <div className="aspect-[4/3] overflow-hidden bg-background">
        <img
          src={image}
          alt={title}
          loading="lazy"
          width={1024}
          height={768}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
        />
      </div>
      <div className="p-5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-gold">{tag}</span>
        <h3 className="font-mono font-semibold text-foreground mt-1">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-5 hover:border-gold/40 hover:bg-bg-secondary/70 transition-colors">
      <div className="w-9 h-9 rounded-md border border-border bg-background inline-flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-mono font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function Why({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 mb-2">
        {icon}
        <span className="font-mono font-semibold text-foreground text-xs uppercase tracking-wider">
          {title}
        </span>
      </div>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

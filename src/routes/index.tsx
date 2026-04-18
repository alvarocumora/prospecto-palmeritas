import { createFileRoute, Link } from "@tanstack/react-router";
import { Mountain, Map, Activity, Drill, TestTube2, ArrowRight, Shield, Layers, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trackmin GeoIntel — Plataforma para exploración minera" },
      {
        name: "description",
        content:
          "Sistema completo para gestión de campañas de exploración minera: catastro, geofísica, sondajes y muestreo. Diseñado para geólogos profesionales.",
      },
      { property: "og:title", content: "Trackmin GeoIntel — Exploración minera moderna" },
      {
        property: "og:description",
        content: "Catastro, geofísica, sondajes y muestreo en una sola plataforma.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <Mountain className="w-5 h-5 text-gold transition-transform group-hover:scale-110" />
            <span className="font-mono font-bold text-sm tracking-tight">TRACKMIN GEOINTEL</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/auth"
              className="px-3 py-1.5 text-xs font-mono rounded bg-gold text-background hover:bg-gold-light transition-colors"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-bg-secondary text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
          Para geólogos de exploración
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          La plataforma para exploración
          <br />
          <span className="bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent">
            minera moderna.
          </span>
        </h1>
        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Gestiona campañas de exploración, catastro minero, geofísica y sondajes en una sola plataforma.
          Limpia, rápida y diseñada por geólogos.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-gold text-background font-mono text-sm font-semibold hover:bg-gold-light transition-colors"
          >
            Crear cuenta gratis <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/dashboard/palmeras"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded border border-border bg-bg-secondary text-foreground font-mono text-sm hover:bg-accent transition-colors"
          >
            Ver demo
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
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
          <Why icon={<Shield className="w-4 h-4 text-gold" />} title="Datos seguros por proyecto" desc="Cada proyecto con su equipo, roles y permisos. RLS a nivel de fila." />
          <Why icon={<Layers className="w-4 h-4 text-gold" />} title="Mapa con todas tus capas" desc="Catastro, geofísica WMS regional, geología Macrostrat, opacidad por capa." />
          <Why icon={<Zap className="w-4 h-4 text-gold" />} title="Sin instalación" desc="Funciona en el navegador. Tus geólogos de campo trabajan desde el celular." />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl md:text-3xl font-bold">¿Listo para tu próxima campaña?</h2>
        <p className="mt-3 text-muted-foreground">Crea tu cuenta y empieza a gestionar proyectos en minutos.</p>
        <Link
          to="/auth"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded bg-gold text-background font-mono text-sm font-semibold hover:bg-gold-light transition-colors"
        >
          Empezar ahora <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span>© {new Date().getFullYear()} Trackmin GeoIntel</span>
          <span>Hecho para geólogos en Chile</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded border border-border bg-bg-secondary p-5 hover:border-gold/40 transition-colors">
      <div className="w-9 h-9 rounded border border-border bg-background inline-flex items-center justify-center mb-3">
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
        <span className="font-mono font-semibold text-foreground text-xs uppercase tracking-wider">{title}</span>
      </div>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

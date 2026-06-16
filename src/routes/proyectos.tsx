import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Mountain, Activity, Satellite, FileText } from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { BrandButton, Eyebrow } from "@/components/brand";

export const Route = createFileRoute("/proyectos")({
  head: () => ({
    meta: [
      { title: "Proyectos — Geocapitals" },
      {
        name: "description",
        content:
          "Proyectos mineros gestionados sobre Geocapitals. Catastro, sondajes, satélite y NI 43-101 en una sola vista.",
      },
      { property: "og:title", content: "Proyectos mineros — Geocapitals" },
      { property: "og:description", content: "Activos reales operando en la plataforma." },
    ],
  }),
  component: ProyectosPage,
});

const SHOWCASE = [
  {
    code: "PALMERAS",
    name: "Prospecto Las Palmeras",
    region: "Illapel · Coquimbo",
    commodity: "Au-Ag",
    to: "/live/palmeras",
    bullets: ["74 concesiones · 12.807 ha", "16 sondajes · 4.426 m", "12 anomalías satelitales"],
  },
  {
    code: "LOSVERDES",
    name: "Los Verdes",
    region: "Petorca · Valparaíso",
    commodity: "Cu-Mo",
    to: "/live/losverdes",
    bullets: [
      "AOI 3D + satélite multi-índice",
      "Targets generados por IA",
      "Compliance NI 43-101 en curso",
    ],
  },
  {
    code: "TILAMA",
    name: "Tilama Norte",
    region: "Choapa · Coquimbo",
    commodity: "Cu-Au",
    to: "/live/tilama",
    bullets: [
      "Catastro + boletines vigilados",
      "Geofísica MAG correlacionada",
      "Pre-feasibility activa",
    ],
  },
  {
    code: "FRANCO",
    name: "Distrito Franco",
    region: "Atacama",
    commodity: "Au",
    to: "/live/franco",
    bullets: [
      "Borrador NI 43-101 asistido",
      "Datos de campo geo-referenciados",
      "Data room institucional",
    ],
  },
];

function ProyectosPage() {
  return (
    <MarketingPage
      eyebrow="Proyectos"
      title="Activos reales operando sobre Geocapitals"
      intro="Una muestra de los proyectos mineros que usan la plataforma para integrar catastro, exploración, monitoreo satelital y reporte NI 43-101."
    >
      <div className="grid md:grid-cols-2 gap-5" id="publicar">
        {SHOWCASE.map((p) => (
          <Link
            key={p.code}
            to={p.to}
            className="group rounded-2xl border border-hairline bg-white p-6 hover:border-accent-brand hover:shadow-[0_20px_40px_-25px_rgba(11,42,91,0.35)] transition block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-accent-brand">
                {p.code}
              </span>
              <ArrowRight className="w-4 h-4 text-content-subtle group-hover:text-accent-brand group-hover:translate-x-0.5 transition" />
            </div>
            <div className="mt-3 font-display text-xl text-content">{p.name}</div>
            <div className="text-sm text-content-subtle mt-1">
              {p.region} · {p.commodity}
            </div>
            <ul className="mt-5 space-y-1.5 text-[13px] text-content">
              {p.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-accent-brand" /> {b}
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>

      <section className="mt-20 rounded-2xl bg-surface-inverse text-white p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <Eyebrow className="mb-2 text-white/60">Publica tu proyecto</Eyebrow>
          <h2 className="brand-display text-2xl md:text-3xl">
            Eleva tu activo al estándar institucional
          </h2>
          <p className="mt-3 text-white/70 max-w-xl">
            Crea un perfil profesional, conecta tu catastro, sube tu data room y recibe interés de
            inversionistas calificados. Onboarding asistido por nuestro equipo.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono uppercase tracking-wider text-white/60">
            <span className="flex items-center gap-2">
              <Mountain className="w-3.5 h-3.5 text-accent-brand-subtle" /> Catastro
            </span>
            <span className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-accent-brand-subtle" /> Geofísica
            </span>
            <span className="flex items-center gap-2">
              <Satellite className="w-3.5 h-3.5 text-accent-brand-subtle" /> Satélite
            </span>
            <span className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-accent-brand-subtle" /> NI 43-101
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <BrandButton asChild>
            <Link to="/auth">
              Crear cuenta <ArrowRight className="w-4 h-4" />
            </Link>
          </BrandButton>
          <Link
            to="/contacto"
            className="inline-flex items-center justify-center gap-2 border border-white/30 text-white px-5 py-3 rounded-md text-sm hover:bg-white/10"
          >
            Habla con nosotros
          </Link>
        </div>
      </section>
    </MarketingPage>
  );
}

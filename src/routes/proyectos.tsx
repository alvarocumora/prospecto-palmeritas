import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Mountain,
  Activity,
  Satellite,
  FileText,
  MapPin,
  Box as BoxIcon,
} from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { BrandButton, Eyebrow } from "@/components/brand";
import { getPublicListings } from "@/lib/publicListings.functions";
import { fmtUSD } from "@/modules/deals/domain/format";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";
import { ListingsMap } from "@/features/proyectos/ListingsMap";

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
  const fetchListings = useServerFn(getPublicListings);
  const { data, isLoading } = useQuery({
    queryKey: ["public-listings"],
    queryFn: () => fetchListings(),
    staleTime: 60_000,
  });
  const listings = data?.listings ?? [];

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

      {/* Herramientas de inteligencia geológica */}
      <section className="mt-14 grid sm:grid-cols-2 gap-4">
        <Link
          to="/satelital"
          className="group rounded-xl border border-hairline bg-white p-5 flex items-center gap-4 hover:border-accent-brand transition"
        >
          <span className="grid place-items-center w-11 h-11 rounded-lg bg-accent-brand-subtle text-accent-brand shrink-0">
            <Satellite className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <div className="font-display text-[15px] text-content">Monitoreo satelital</div>
            <div className="text-xs text-content-subtle mt-0.5">
              Anomalías multiespectrales e InSAR sobre los proyectos demo
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-content-subtle group-hover:text-accent-brand group-hover:translate-x-0.5 transition" />
        </Link>
        <Link
          to="/visor-3d"
          className="group rounded-xl border border-hairline bg-white p-5 flex items-center gap-4 hover:border-accent-brand transition"
        >
          <span className="grid place-items-center w-11 h-11 rounded-lg bg-accent-brand-subtle text-accent-brand shrink-0">
            <BoxIcon className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <div className="font-display text-[15px] text-content">Visor 3D geocientífico</div>
            <div className="text-xs text-content-subtle mt-0.5">
              Terreno, sondajes y anomalías georreferenciadas en 3D
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-content-subtle group-hover:text-accent-brand group-hover:translate-x-0.5 transition" />
        </Link>
      </section>

      {/* Oportunidades publicadas (datos reales) */}
      <section className="mt-20">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <Eyebrow className="mb-2">Oportunidades publicadas</Eyebrow>
            <h2 className="brand-display text-2xl md:text-3xl text-content">
              Deal flow abierto a inversionistas
            </h2>
          </div>
          <BrandButton asChild variant="outline">
            <Link to="/inversionistas">
              Ver deal flow completo <ArrowRight className="w-4 h-4" />
            </Link>
          </BrandButton>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-hairline bg-white p-5 animate-pulse space-y-3"
              >
                <div className="h-3 bg-slate-100 rounded w-1/3" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-10 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <p className="text-sm text-content-subtle italic">
            No hay oportunidades publicadas en este momento.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.slice(0, 6).map((l) => (
              <Link
                key={l.id}
                to="/proyectos/$listingId"
                params={{ listingId: l.id }}
                className="group rounded-xl border border-hairline bg-white p-5 flex flex-col hover:border-accent-brand hover:shadow-[0_16px_36px_-24px_rgba(11,42,91,0.35)] transition"
              >
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
                  <span className="text-accent-brand">
                    {MODALITY_LABEL[l.modality ?? ""] ?? l.modality ?? "—"}
                  </span>
                  <span className="text-content-subtle">
                    {STAGE_LABEL[l.stage ?? ""] ?? l.stage ?? ""}
                  </span>
                </div>
                <div className="mt-2.5 font-display text-lg text-content leading-snug group-hover:text-accent-brand transition-colors line-clamp-2">
                  {l.title}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] font-mono text-content-subtle">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {[l.region, l.country].filter(Boolean).join(", ") || "—"}
                  </span>
                  {l.commodity && <span className="ml-auto">{l.commodity}</span>}
                </div>
                <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-content">
                    {l.modality === "royalty" && l.royalty_pct != null
                      ? `${l.royalty_pct}% NSR`
                      : fmtUSD(l.asking_price_usd)}
                  </span>
                  <ArrowRight className="w-4 h-4 text-content-subtle group-hover:text-accent-brand group-hover:translate-x-0.5 transition" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

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

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Mountain, TrendingUp, Clock, Sparkles, Filter } from "lucide-react";
import { BrandButton, SectionHeading } from "@/components/brand";
import { fmtUSD } from "@/modules/deals/domain/format";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";
import type { PublicListing } from "@/lib/publicListings.functions";

type FeaturedProject = PublicListing & {
  irr_pct: number;
  payback_years: number;
};

const PROJECTS: FeaturedProject[] = [
  {
    id: "p1",
    title: "Prospecto Las Palmeras",
    code: "TRK-ALH-001",
    commodity: "Au-Ag",
    country: "Chile",
    region: "Coquimbo",
    area_ha: 12807,
    stage: "prefeasibility",
    modality: "jv",
    asking_price_usd: 8_500_000,
    royalty_pct: null,
    summary:
      "74 concesiones en Illapel con anomalías satelitales confirmadas y 16 sondajes de hasta 350 m completados.",
    cover_image_url: null,
    data_available: ["geophysics", "drilling", "satellite", "ni43101"],
    views_count: 142,
    is_featured: true,
    has_geometry: true,
    centroid: [-71.2, -31.6],
    irr_pct: 28,
    payback_years: 4.2,
  },
  {
    id: "p2",
    title: "Salar Atacama Norte",
    code: "GEO-LI-004",
    commodity: "Li",
    country: "Chile",
    region: "Antofagasta",
    area_ha: 4200,
    stage: "scoping",
    modality: "sale",
    asking_price_usd: 4_200_000,
    royalty_pct: null,
    summary:
      "Salar de alta concentración en salmuera con perforaciones de caracterización completadas.",
    cover_image_url: null,
    data_available: ["geochemistry", "drilling"],
    views_count: 98,
    is_featured: true,
    has_geometry: true,
    centroid: [-68.3, -23.1],
    irr_pct: 35,
    payback_years: 3.5,
  },
  {
    id: "p3",
    title: "Cerro Amarillo",
    code: "GEO-AU-012",
    commodity: "Au",
    country: "Perú",
    region: "Cajamarca",
    area_ha: 8940,
    stage: "brownfield",
    modality: "royalty",
    asking_price_usd: null,
    royalty_pct: 3,
    summary:
      "Depósito epitermal de baja sulfuración con historia de producción artesanal y estudios de roca en curso.",
    cover_image_url: null,
    data_available: ["geophysics", "geochemistry", "satellite"],
    views_count: 67,
    is_featured: false,
    has_geometry: true,
    centroid: [-78.5, -7.2],
    irr_pct: 22,
    payback_years: 5.1,
  },
  {
    id: "p4",
    title: "Prospecto Los Verdes",
    code: "LV5-CU-008",
    commodity: "Cu-Au",
    country: "Chile",
    region: "Coquimbo",
    area_ha: 3560,
    stage: "greenfield",
    modality: "jv",
    asking_price_usd: 2_100_000,
    royalty_pct: null,
    summary:
      "Zona pórfido Cu-Au de tipo andino con geoquímica coherente y anomalías magnéticas definidas.",
    cover_image_url: null,
    data_available: ["geophysics", "geochemistry"],
    views_count: 53,
    is_featured: false,
    has_geometry: true,
    centroid: [-71.4, -31.2],
    irr_pct: 41,
    payback_years: 2.8,
  },
  {
    id: "p5",
    title: "Mina Santa Rosa",
    code: "SR-AG-003",
    commodity: "Ag",
    country: "México",
    region: "Zacatecas",
    area_ha: 6200,
    stage: "feasibility",
    modality: "option",
    asking_price_usd: 12_000_000,
    royalty_pct: null,
    summary:
      "Yacimiento de plata de alta ley con estudio de factibilidad completo y permisos en trámite.",
    cover_image_url: null,
    data_available: ["geophysics", "drilling", "ni43101"],
    views_count: 119,
    is_featured: true,
    has_geometry: true,
    centroid: [-102.4, 23.0],
    irr_pct: 19,
    payback_years: 6.3,
  },
  {
    id: "p6",
    title: "Río Blanco Sur",
    code: "RB-CUAU-007",
    commodity: "Au-Cu",
    country: "Argentina",
    region: "San Juan",
    area_ha: 9800,
    stage: "prefeasibility",
    modality: "jv",
    asking_price_usd: 6_800_000,
    royalty_pct: null,
    summary:
      "Pórfido Au-Cu adyacente a producción histórica, con modelo 3D completo y estimación preliminar de recursos.",
    cover_image_url: null,
    data_available: ["geophysics", "drilling", "satellite"],
    views_count: 88,
    is_featured: false,
    has_geometry: true,
    centroid: [-70.0, -30.1],
    irr_pct: 31,
    payback_years: 3.9,
  },
];

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "precious", label: "Au · Ag" },
  { key: "base", label: "Cu" },
  { key: "critical", label: "Li · Críticos" },
];

function matchFilter(p: FeaturedProject, key: string) {
  if (key === "all") return true;
  const c = p.commodity ?? "";
  if (key === "precious") return /Au|Ag/.test(c);
  if (key === "base") return /Cu/.test(c);
  if (key === "critical") return /Li|Co|Ni|Mo/.test(c);
  return true;
}

const COMMODITY_TINT: Record<string, { from: string; icon: string }> = {
  Au: { from: "from-amber-50 to-yellow-100", icon: "text-amber-500" },
  "Au-Ag": { from: "from-amber-50 to-yellow-100", icon: "text-amber-500" },
  "Au-Cu": { from: "from-amber-50 to-orange-100", icon: "text-amber-500" },
  Ag: { from: "from-slate-50 to-gray-100", icon: "text-slate-400" },
  Cu: { from: "from-orange-50 to-amber-100", icon: "text-orange-500" },
  "Cu-Au": { from: "from-orange-50 to-amber-100", icon: "text-orange-500" },
  Li: { from: "from-teal-50 to-emerald-100", icon: "text-teal-500" },
};

const DEFAULT_TINT = { from: "from-slate-50 to-gray-100", icon: "text-slate-400" };

export function InvestableProjects() {
  const [activeFilter, setActiveFilter] = useState("all");
  const filtered = PROJECTS.filter((p) => matchFilter(p, activeFilter));

  return (
    <section className="max-w-7xl mx-auto px-5 py-20">
      <div className="flex flex-col lg:flex-row lg:items-end gap-6 mb-10">
        <SectionHeading
          eyebrow="Proyectos disponibles para invertir"
          title="Oportunidades verificadas en minería activa"
          description="Proyectos con información técnica auditada, modelo económico y múltiples modalidades de entrada para inversionistas."
          className="flex-1"
        />
        <BrandButton asChild variant="outline" className="shrink-0">
          <Link to="/inversionistas">
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </BrandButton>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <Filter className="w-4 h-4 text-content-subtle" />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors border ${
              activeFilter === f.key
                ? "bg-accent-brand text-white border-accent-brand"
                : "border-hairline text-content-subtle hover:border-accent-brand hover:text-accent-brand"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] font-mono text-content-subtle">
          {filtered.length} de {PROJECTS.length} proyectos
        </span>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((p) => (
          <FeaturedProjectCard key={p.id} project={p} />
        ))}
      </div>

      <div className="mt-10 text-center">
        <p className="text-sm text-content-subtle mb-4">
          ¿Tienes un proyecto que quieras listar para inversión?
        </p>
        <BrandButton asChild>
          <Link to="/contacto">
            Publicar mi proyecto <ArrowRight className="w-4 h-4" />
          </Link>
        </BrandButton>
      </div>
    </section>
  );
}

function FeaturedProjectCard({ project: p }: { project: FeaturedProject }) {
  const tint = COMMODITY_TINT[p.commodity ?? ""] ?? DEFAULT_TINT;
  const modality = MODALITY_LABEL[p.modality ?? ""] ?? p.modality ?? "";
  const stage = STAGE_LABEL[p.stage ?? ""] ?? p.stage ?? "";

  return (
    <Link
      to="/inversionistas"
      className="group rounded-xl border border-hairline bg-white flex flex-col overflow-hidden hover:border-accent-brand hover:shadow-[0_20px_40px_-25px_rgba(43,74,203,0.25)] transition-all duration-300"
    >
      {/* Cover */}
      <div
        className={`aspect-video bg-gradient-to-br ${tint.from} relative flex items-center justify-center`}
      >
        <Mountain className={`w-10 h-10 opacity-25 ${tint.icon}`} />
        <div className="absolute inset-0 flex items-start justify-between p-2.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 backdrop-blur-sm text-[10px] font-mono uppercase tracking-wider text-content border border-hairline/60">
            {modality}
          </span>
          {p.is_featured && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-brand text-white text-[10px] font-mono uppercase tracking-wider">
              <Sparkles className="w-2.5 h-2.5" /> Destacado
            </span>
          )}
        </div>
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
          <span className={`text-xs font-mono font-semibold ${tint.icon}`}>{p.commodity}</span>
          <span className="text-[10px] font-mono text-content/50">· {stage}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-serif text-[15px] font-semibold text-content leading-snug group-hover:text-accent-brand transition-colors line-clamp-2">
          {p.title}
        </h3>

        {(p.region || p.country) && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-content-subtle">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{[p.region, p.country].filter(Boolean).join(", ")}</span>
            {p.area_ha && (
              <span className="ml-auto whitespace-nowrap">
                {p.area_ha.toLocaleString("es-CL")} ha
              </span>
            )}
          </div>
        )}

        {p.summary && (
          <p className="text-[12px] text-content/60 line-clamp-2 leading-relaxed">{p.summary}</p>
        )}

        {/* KPIs */}
        <div className="mt-auto pt-3 border-t border-hairline grid grid-cols-3 gap-px bg-hairline rounded overflow-hidden">
          <div className="bg-white px-2 py-2 text-center">
            <div className="text-[9px] font-mono uppercase tracking-wider text-content-subtle leading-tight">
              Precio
            </div>
            <div className="font-mono text-[13px] font-semibold text-content mt-1 leading-tight">
              {p.modality === "royalty" && p.royalty_pct != null
                ? `${p.royalty_pct}% NSR`
                : fmtUSD(p.asking_price_usd)}
            </div>
          </div>
          <div className="bg-white px-2 py-2 text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] font-mono uppercase tracking-wider text-content-subtle leading-tight">
              <TrendingUp className="w-2.5 h-2.5" /> TIR
            </div>
            <div className="font-mono text-[13px] font-semibold text-accent-brand mt-1 leading-tight">
              {p.irr_pct}%
            </div>
          </div>
          <div className="bg-white px-2 py-2 text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] font-mono uppercase tracking-wider text-content-subtle leading-tight">
              <Clock className="w-2.5 h-2.5" /> Payback
            </div>
            <div className="font-mono text-[13px] font-semibold text-content mt-1 leading-tight">
              {p.payback_years}a
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

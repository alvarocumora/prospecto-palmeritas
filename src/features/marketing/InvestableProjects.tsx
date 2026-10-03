import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, MapPin, Mountain, Clock, Sparkles, Filter } from "lucide-react";
import { BrandButton, SectionHeading, VerificationBadge } from "@/components/brand";
import { projectVerification } from "@/lib/verification";
import { fmtUSD } from "@/modules/deals/domain/format";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";
import { getPublicListings } from "@/lib/publicListings.functions";
import { PublicListingDrawer } from "@/features/marketing/PublicListingDrawer";
import { terminalSlugForListing } from "@/features/terminal/terminalProjects";
import { ProjectCover } from "@/features/marketing/ProjectCover";
import { Reveal } from "@/features/marketing/Reveal";
import type { PublicListing } from "@/lib/publicListings.functions";

const MAX_ON_LANDING = 6;

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "precious", label: "Au · Ag" },
  { key: "base", label: "Cu" },
  { key: "critical", label: "Li · Críticos" },
];

function matchFilter(p: PublicListing, key: string) {
  if (key === "all") return true;
  const c = p.commodity ?? "";
  if (key === "precious") return /^Au|^Ag/.test(c);
  if (key === "base") return /^Cu/.test(c);
  if (key === "critical") return /^Li|^Co|^Ni|^Mo/.test(c);
  return true;
}

export function InvestableProjects() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selected, setSelected] = useState<PublicListing | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchListings = useServerFn(getPublicListings);
  const { data, isLoading } = useQuery({
    queryKey: ["public-listings"],
    queryFn: () => fetchListings(),
    staleTime: 60_000,
  });

  const listings = useMemo(() => (data?.listings ?? []).slice(0, MAX_ON_LANDING), [data?.listings]);
  const filtered = useMemo(
    () => listings.filter((p) => matchFilter(p, activeFilter)),
    [listings, activeFilter],
  );

  function openDrawer(listing: PublicListing) {
    setSelected(listing);
    setDrawerOpen(true);
  }

  return (
    <section className="max-w-7xl mx-auto px-5 py-20">
      <div className="flex flex-col lg:flex-row lg:items-end gap-6 mb-10">
        <SectionHeading
          eyebrow="Proyectos disponibles para invertir"
          title="Oportunidades con datos trazables en minería activa"
          description="Cada proyecto lleva un sello visible con su nivel de verificación — trazable o verificado QP — junto a modelo económico y múltiples modalidades de entrada."
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
            type="button"
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
        {!isLoading && (
          <span className="ml-auto text-[11px] font-mono text-content-subtle">
            {filtered.length} de {listings.length} proyectos
          </span>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-hairline bg-white overflow-hidden animate-pulse"
            >
              <div className="aspect-video bg-slate-100" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-5/6" />
                <div className="mt-4 h-14 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <Mountain className="w-10 h-10 text-content-subtle mx-auto opacity-40" />
          <p className="text-sm text-content-subtle">
            No hay proyectos en esta categoría por ahora.
          </p>
          <BrandButton asChild variant="outline">
            <Link to="/contacto">
              Solicitar acceso <ArrowRight className="w-4 h-4" />
            </Link>
          </BrandButton>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p, idx) => (
            <Reveal key={p.id} delay={Math.min(idx, 5) * 70}>
              <FeaturedProjectCard project={p} onOpen={openDrawer} />
            </Reveal>
          ))}
        </div>
      )}

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

      <PublicListingDrawer listing={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </section>
  );
}

function FeaturedProjectCard({
  project: p,
  onOpen,
}: {
  project: PublicListing;
  onOpen: (listing: PublicListing) => void;
}) {
  const modality = MODALITY_LABEL[p.modality ?? ""] ?? p.modality ?? "";
  const stage = STAGE_LABEL[p.stage ?? ""] ?? p.stage ?? "";
  // Si el listado corresponde a un activo con terminal, la tarjeta aterriza
  // directo en el terminal (sin panel intermedio).
  const terminalSlug = terminalSlugForListing(p);
  const cardClass =
    "group rounded-xl border border-hairline bg-white flex flex-col overflow-hidden h-full hover-lift hover:border-accent-brand hover:shadow-[0_20px_40px_-25px_rgba(43,74,203,0.25)] transition-all duration-300 text-left w-full";

  const Shell = ({ children }: { children: React.ReactNode }) =>
    terminalSlug ? (
      <Link
        to="/terminal/$slug"
        params={{ slug: terminalSlug }}
        search={{ tab: "mapa" as const }}
        className={cardClass}
      >
        {children}
      </Link>
    ) : (
      <button type="button" onClick={() => onOpen(p)} className={cardClass}>
        {children}
      </button>
    );

  return (
    <Shell>
      {/* Cover */}
      <div className="aspect-video relative overflow-hidden">
        <div className="cover-zoom absolute inset-0">
          {p.cover_image_url ? (
            <img src={p.cover_image_url} alt={p.title} className="w-full h-full object-cover" />
          ) : (
            <ProjectCover seed={p.id} commodity={p.commodity} region={p.region ?? p.country} />
          )}
        </div>
        <div className="absolute inset-0 flex items-start justify-between p-2.5 pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-mono uppercase tracking-wider text-white border border-white/15">
            {modality}
          </span>
          {p.is_featured && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-brand text-white text-[10px] font-mono uppercase tracking-wider">
              <Sparkles className="w-2.5 h-2.5" /> Destacado
            </span>
          )}
        </div>
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5 pointer-events-none">
          <span className="text-xs font-mono font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {p.commodity}
          </span>
          <span className="text-[10px] font-mono text-white/70">· {stage}</span>
          <VerificationBadge
            level={projectVerification(p.project_id)}
            compact
            linked={false}
            className="ml-auto !bg-white/90 backdrop-blur-sm"
          />
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
            <div className="text-[9px] font-mono uppercase tracking-wider text-content-subtle leading-tight">
              Etapa
            </div>
            <div className="font-mono text-[11px] font-semibold text-content mt-1 leading-tight truncate px-1">
              {stage || "—"}
            </div>
          </div>
          <div className="bg-white px-2 py-2 text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] font-mono uppercase tracking-wider text-content-subtle leading-tight">
              <Clock className="w-2.5 h-2.5" /> Área
            </div>
            <div className="font-mono text-[13px] font-semibold text-content mt-1 leading-tight">
              {p.area_ha != null ? `${(p.area_ha / 1000).toFixed(1)}k` : "—"}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Mountain, Filter } from "lucide-react";
import { BrandButton, SectionHeading } from "@/components/brand";
import { getPublicListings } from "@/lib/publicListings.functions";
import { PublicListingDrawer } from "@/features/marketing/PublicListingDrawer";
import { PublicListingCard } from "./PublicListingCard";
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
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-listings"],
    queryFn: () => fetchListings(),
    staleTime: 60_000,
  });

  const listings = useMemo(() => (data?.listings ?? []), [data?.listings]);
  const filtered = useMemo(
    () => listings.filter((p) => matchFilter(p, activeFilter)).slice(0, MAX_ON_LANDING),
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
          description="Antecedentes publicados, términos referenciales y evidencias por revisar antes de invertir."
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
          <BrandButton
            key={f.key}
            variant="outline"
            aria-pressed={activeFilter === f.key}
            type="button"
            onClick={() => setActiveFilter(f.key)}
            className={`min-h-11 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-colors border ${
              activeFilter === f.key
                ? "bg-accent-brand text-accent-brand-contrast border-accent-brand"
                : "border-hairline text-content-subtle hover:border-accent-brand hover:text-accent-brand"
            }`}
          >
            {f.label}
          </BrandButton>
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
              className="rounded-lg border border-hairline bg-surface-3 overflow-hidden animate-pulse"
            >
              <div className="aspect-[16/10] bg-surface-2" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-surface-2 rounded w-3/4" />
                <div className="h-3 bg-surface-2 rounded w-1/2" />
                <div className="h-3 bg-surface-2 rounded w-full" />
                <div className="h-3 bg-surface-2 rounded w-5/6" />
                <div className="mt-4 h-14 bg-surface-2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (<div role="alert" className="py-8 text-content-muted">No pudimos cargar los proyectos. <BrandButton variant="outline" onClick={() => void refetch()}>Reintentar</BrandButton></div>) : filtered.length === 0 ? (
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
              <PublicListingCard listing={p} onOpen={() => openDrawer(p)} updatedAt={data?.updatedAt} />
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

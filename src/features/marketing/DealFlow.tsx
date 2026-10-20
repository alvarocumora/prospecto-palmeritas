import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicListings } from "@/lib/publicListings.functions";
import { PublicListingCard } from "./PublicListingCard";
import { Reveal } from "./Reveal";
import { PublicListingDrawer } from "./PublicListingDrawer";
import { Search, SlidersHorizontal, Inbox } from "lucide-react";
import { BrandButton } from "@/components/brand";
import { MODALITY_LABEL } from "@/modules/deals/domain/constants";

type Filters = {
  q: string;
  commodity: string;
  modality: string;
  country: string;
};

const EMPTY_FILTERS: Filters = { q: "", commodity: "", modality: "", country: "" };

export function DealFlow({ initialListingId }: { initialListingId?: string }) {
  const fetchListings = useServerFn(getPublicListings);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-listings"],
    queryFn: () => fetchListings(),
    staleTime: 60_000,
  });
  const listings = useMemo(() => data?.listings ?? [], [data?.listings]);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(initialListingId ?? null);

  const commodities = useMemo(
    () => uniq(listings.map((l) => l.commodity).filter(Boolean) as string[]),
    [listings],
  );
  const modalities = useMemo(
    () => uniq(listings.map((l) => l.modality).filter(Boolean) as string[]),
    [listings],
  );
  const countries = useMemo(
    () => uniq(listings.map((l) => l.country).filter(Boolean) as string[]),
    [listings],
  );

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return listings.filter((l) => {
      if (filters.commodity && l.commodity !== filters.commodity) return false;
      if (filters.modality && l.modality !== filters.modality) return false;
      if (filters.country && l.country !== filters.country) return false;
      if (q) {
        const hay = `${l.title} ${l.summary ?? ""} ${l.region ?? ""} ${l.code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [listings, filters]);

  const open = openId ? (listings.find((l) => l.id === openId) ?? null) : null;

  return (
    <section>
      {/* Filter bar */}
      <div className="rounded-lg border border-hairline bg-surface-3 p-3 md:p-4 flex flex-wrap gap-3 items-center mb-6">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle" />
          <input
            type="search"
            placeholder="Buscar por nombre, región, código…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="min-h-11 brand-input pl-9"
          />
        </div>
        <Select
          value={filters.commodity}
          onChange={(v) => setFilters({ ...filters, commodity: v })}
          label="Commodity"
          options={commodities}
        />
        <Select
          value={filters.modality}
          onChange={(v) => setFilters({ ...filters, modality: v })}
          label="Modalidad"
          options={modalities}
          renderLabel={(v) => MODALITY_LABEL[v] ?? v}
        />
        <Select
          value={filters.country}
          onChange={(v) => setFilters({ ...filters, country: v })}
          label="País"
          options={countries}
        />
        {(filters.q || filters.commodity || filters.modality || filters.country) && (
          <BrandButton
            variant="ghost"
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-[11px] font-mono uppercase tracking-wider text-content-subtle hover:text-accent-brand inline-flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Limpiar
          </BrandButton>
        )}
        <span className="ml-auto text-[11px] font-mono text-content-subtle">
          {isLoading ? "Cargando…" : `${filtered.length} de ${listings.length}`}
        </span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-hairline bg-surface-3 h-[320px] animate-pulse"
            />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="py-8 text-content-muted">
          No pudimos cargar las oportunidades.{" "}
          <BrandButton variant="outline" onClick={() => void refetch()}>
            Reintentar
          </BrandButton>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasListings={listings.length > 0} onClear={() => setFilters(EMPTY_FILTERS)} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((l, idx) => (
            <Reveal key={l.id} delay={Math.min(idx, 5) * 60}>
              <PublicListingCard
                listing={l}
                onOpen={() => setOpenId(l.id)}
                updatedAt={data?.updatedAt}
              />
            </Reveal>
          ))}
        </div>
      )}

      <PublicListingDrawer
        listing={open}
        open={!!open}
        onOpenChange={(v) => {
          if (!v) setOpenId(null);
        }}
      />
    </section>
  );
}

function Select({
  value,
  onChange,
  label,
  options,
  renderLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
  renderLabel?: (v: string) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-11 brand-input w-auto min-w-[120px] cursor-pointer"
      aria-label={label}
    >
      <option value="">{label}: Todos</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {renderLabel ? renderLabel(o) : o}
        </option>
      ))}
    </select>
  );
}

function EmptyState({ hasListings, onClear }: { hasListings: boolean; onClear: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline bg-surface-3 p-10 text-center">
      <Inbox className="w-10 h-10 mx-auto text-accent-brand/40" />
      <div className="mt-3 font-display text-lg text-content">
        {hasListings ? "Sin oportunidades que coincidan" : "Pronto: nuevas oportunidades"}
      </div>
      <p className="text-sm text-content-subtle mt-1 max-w-md mx-auto">
        {hasListings
          ? "Ajusta los filtros para ampliar la búsqueda o limpia los criterios."
          : "Estamos onboardeando proyectos. Solicita acceso institucional para recibir oportunidades en privado antes del listado público."}
      </p>
      {hasListings && (
        <BrandButton
          variant="ghost"
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent-brand font-medium hover:underline"
        >
          Limpiar filtros
        </BrandButton>
      )}
    </div>
  );
}

function uniq(xs: string[]) {
  return Array.from(new Set(xs)).sort();
}

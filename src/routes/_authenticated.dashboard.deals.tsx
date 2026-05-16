// Marketplace de propiedades mineras (deals): listado público con filtros
// y panel de detalle (overview + data room + inquiry/NDA + mensajería).

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Briefcase, Search, Filter, Layers, Mountain, X } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { usePropertyListings } from "@/hooks/usePropertyListings";
import {
  COMMODITY_OPTIONS,
  MODALITY_LABEL,
  MODALITY_OPTIONS,
  STAGE_LABEL,
  STAGE_OPTIONS,
} from "@/modules/deals/domain/constants";
import { fmtUSD } from "@/modules/deals/domain/format";
import { FilterSelect } from "@/modules/deals/ui/FilterSelect";
import { ListingCard } from "@/modules/deals/ui/ListingCard";
import { ListingDetailDrawer } from "@/modules/deals/ui/ListingDetailDrawer";

export const Route = createFileRoute("/_authenticated/dashboard/deals")({
  head: () => ({
    meta: [
      { title: "Marketplace de Propiedades — Geocapitals" },
      { name: "description", content: "Compra, venta, JV y royalties de propiedades mineras." },
    ],
  }),
  component: DealsPage,
});

function DealsPage() {
  const { active } = useProjects();
  const { listings, loading, refresh } = usePropertyListings();
  const [scope, setScope] = useState<"project" | "all">(active ? "project" : "all");
  const [search, setSearch] = useState("");
  const [commodity, setCommodity] = useState<string>("");
  const [stage, setStage] = useState<string>("");
  const [modality, setModality] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = listings.filter((l) => l.is_published);
    if (scope === "project" && active?.id) list = list.filter((l) => l.project_id === active.id);
    if (commodity) list = list.filter((l) => l.commodity === commodity);
    if (stage) list = list.filter((l) => l.stage === stage);
    if (modality) list = list.filter((l) => l.modality === modality);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.code ?? "").toLowerCase().includes(q) ||
          (l.region ?? "").toLowerCase().includes(q) ||
          (l.summary ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [listings, scope, active?.id, commodity, stage, modality, search]);

  const projectCount = useMemo(
    () => listings.filter((l) => l.is_published && l.project_id === active?.id).length,
    [listings, active?.id],
  );
  const allCount = useMemo(() => listings.filter((l) => l.is_published).length, [listings]);

  const clearFilters = () => {
    setSearch("");
    setCommodity("");
    setStage("");
    setModality("");
  };
  const activeFilters =
    (commodity ? 1 : 0) + (stage ? 1 : 0) + (modality ? 1 : 0) + (search ? 1 : 0);

  return (
    <div className="p-3 md:p-4 max-w-[1600px] mx-auto">
      <header className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Briefcase className="w-5 h-5 text-gold" />
          <h1 className="text-lg md:text-xl font-mono font-semibold text-foreground">
            Marketplace de Propiedades
          </h1>
        </div>
        <p className="text-xs font-mono text-muted-foreground">
          Pertenencias, JVs, royalties y opciones de propiedades mineras. Firma NDA para acceder al
          data room.
        </p>
      </header>

      {/* Scope tabs */}
      <div className="flex items-center gap-1 mb-3 border-b border-border">
        <button
          onClick={() => setScope("project")}
          disabled={!active}
          className={`px-3 py-2 text-xs font-mono border-b-2 -mb-px transition-colors disabled:opacity-40 ${
            scope === "project"
              ? "border-gold text-gold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Mi proyecto {active ? `(${projectCount})` : ""}
        </button>
        <button
          onClick={() => setScope("all")}
          className={`px-3 py-2 text-xs font-mono border-b-2 -mb-px transition-colors ${
            scope === "all"
              ? "border-gold text-gold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Todo el marketplace ({allCount})
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, código, región…"
            className="w-full pl-7 pr-2 py-1.5 text-xs font-mono rounded border border-border bg-background outline-none focus:border-gold"
          />
        </div>
        <FilterSelect
          icon={<Mountain className="w-3 h-3" />}
          value={commodity}
          onChange={setCommodity}
          placeholder="Commodity"
          options={COMMODITY_OPTIONS}
        />
        <FilterSelect
          icon={<Layers className="w-3 h-3" />}
          value={stage}
          onChange={setStage}
          placeholder="Etapa"
          options={STAGE_OPTIONS}
          labelMap={STAGE_LABEL}
        />
        <FilterSelect
          icon={<Briefcase className="w-3 h-3" />}
          value={modality}
          onChange={setModality}
          placeholder="Modalidad"
          options={MODALITY_OPTIONS}
          labelMap={MODALITY_LABEL}
        />
        {activeFilters > 0 && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" /> Limpiar ({activeFilters})
          </button>
        )}
        <span className="ml-auto text-[11px] font-mono text-muted-foreground">
          <Filter className="w-3 h-3 inline mr-1" />
          {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-xs font-mono text-muted-foreground">
          Cargando ofertas…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Briefcase className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <div className="text-sm font-mono text-foreground mb-1">Sin resultados</div>
          <div className="text-xs font-mono text-muted-foreground">
            {activeFilters > 0
              ? "Ajusta los filtros o cambia el scope."
              : scope === "project"
                ? "Este proyecto aún no tiene listings públicos."
                : "No hay propiedades publicadas."}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} onOpen={() => setSelectedId(l.id)} />
          ))}
        </div>
      )}

      <ListingDetailDrawer
        listingId={selectedId}
        onClose={() => setSelectedId(null)}
        onMutated={refresh}
      />
    </div>
  );
}

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
import { FilterSelect } from "@/modules/deals/ui/FilterSelect";
import { ListingCard } from "@/modules/deals/ui/ListingCard";
import { ListingDetailDrawer } from "@/modules/deals/ui/ListingDetailDrawer";
import { ContentState, PageHeader, PlatformPage } from "@/components/ui-system";

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
    <PlatformPage>
      <PageHeader
        eyebrow="Capital · Marketplace"
        title="Marketplace de propiedades"
        description="Pertenencias, joint ventures, royalties y opciones mineras. Accede a sus antecedentes y solicita el data room según disponibilidad y permisos."
      />

      {/* Scope tabs */}
      <div className="flex items-center gap-1 mb-3 border-b border-hairline">
        <button
          onClick={() => setScope("project")}
          disabled={!active}
          className={`min-h-11 px-3 py-2 text-xs font-mono border-b-2 -mb-px transition-colors disabled:opacity-40 ${
            scope === "project"
              ? "border-accent-brand text-accent-brand"
              : "border-transparent text-content-subtle hover:text-content"
          }`}
        >
          Mi proyecto {active ? `(${projectCount})` : ""}
        </button>
        <button
          onClick={() => setScope("all")}
          className={`min-h-11 px-3 py-2 text-xs font-mono border-b-2 -mb-px transition-colors ${
            scope === "all"
              ? "border-accent-brand text-accent-brand"
              : "border-transparent text-content-subtle hover:text-content"
          }`}
        >
          Todo el marketplace ({allCount})
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, código, región…"
            className="min-h-11 w-full rounded-md border border-hairline bg-surface-3 py-2 pl-8 pr-3 text-sm text-content outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
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
            className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-2 text-xs font-medium text-content-muted hover:bg-surface-2 hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
          >
            <X className="w-3 h-3" /> Limpiar ({activeFilters})
          </button>
        )}
        <span className="ml-auto text-[11px] font-mono text-content-subtle">
          <Filter className="w-3 h-3 inline mr-1" />
          {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Grid: distintos estados del servicio sin fabricar datos. */}
      {loading ? (
        <ContentState kind="loading" title="Cargando ofertas…" />
      ) : filtered.length === 0 ? (
        <ContentState
          kind="empty"
          title="Sin resultados"
          description={
            activeFilters > 0
              ? "Ajusta los filtros para ampliar la búsqueda."
              : scope === "project"
                ? "El proyecto seleccionado aún no tiene ofertas publicadas."
                : "No hay propiedades publicadas."
          }
          action={
            activeFilters > 0
              ? { label: "Limpiar filtros", onClick: clearFilters }
              : scope === "project"
                ? { label: "Ver todo el marketplace", onClick: () => setScope("all") }
                : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </PlatformPage>
  );
}

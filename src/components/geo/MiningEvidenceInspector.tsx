import { useMemo, useState } from "react";
import { ChevronDown, Database, X } from "lucide-react";
import type { GeoSceneProjectLayer } from "@/components/geoscene/projectLayers";
import {
  filterMiningEvidence,
  MINING_EVIDENCE_DOMAINS,
  projectMiningEvidence,
  type MiningEvidenceFilter,
} from "@/components/geoscene/miningEvidence";

/**
 * Complement to the layer-visibility panel, not a second source of truth.
 * Inventories the GeoJSON already delivered to this particular project scene.
 */
export function MiningEvidenceInspector({
  layers,
  projectName,
}: {
  layers: readonly GeoSceneProjectLayer[];
  projectName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<MiningEvidenceFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const rows = useMemo(() => projectMiningEvidence(layers), [layers]);
  const filtered = useMemo(() => filterMiningEvidence(rows, filter), [rows, filter]);
  const count = rows.reduce((sum, row) => sum + row.featureCount, 0);

  return (
    <aside
      className="pointer-events-none absolute bottom-3 left-3 z-30 w-[min(25rem,calc(100%-1.5rem))]"
      aria-label="Inspector de evidencia minera"
    >
      {open && (
        <section
          id="mining-evidence-content"
          role="region"
          aria-label="Inventario de datos del proyecto"
          className="pointer-events-auto mb-2 flex max-h-[min(56vh,27rem)] flex-col overflow-hidden rounded-lg border border-hairline bg-surface text-content shadow-xl"
          data-theme="im-light"
        >
          <header className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-wide text-accent-brand">
                Datos geológicos · Inventario
              </p>
              <h3 className="mt-1 truncate font-display text-lg">{projectName ?? "Proyecto"}</h3>
              <p className="text-xs text-content-muted">
                {rows.length} capas · {count.toLocaleString("es-CL")} entidades GeoJSON cargadas
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar inspector"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-content-muted hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>
          <div
            className="flex gap-1 overflow-x-auto border-b border-hairline px-3 py-2"
            role="group"
            aria-label="Filtrar dominio de evidencia"
          >
            {MINING_EVIDENCE_DOMAINS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => {
                  setFilter(option.value);
                  setExpandedId(null);
                }}
                className={`min-h-11 shrink-0 rounded-md border px-3 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand ${
                  filter === option.value
                    ? "border-accent-brand bg-accent-brand-subtle text-accent-brand"
                    : "border-hairline bg-surface-3 text-content-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
            {filtered.length === 0 ? (
              <p
                role="status"
                className="rounded-md border border-dashed border-hairline p-4 text-xs text-content-muted"
              >
                No hay capas GeoJSON cargadas en esta categoría. Esto no confirma ausencia de datos
                externos ni de mineralización.
              </p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((row) => (
                  <li key={row.id} className="rounded-md border border-hairline bg-surface-3">
                    <button
                      type="button"
                      aria-expanded={expandedId === row.id}
                      onClick={() =>
                        setExpandedId((current) => (current === row.id ? null : row.id))
                      }
                      className="flex min-h-11 w-full items-center justify-between gap-2 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{row.label}</span>
                        <span className="mt-1 block text-[11px] text-content-muted">
                          {row.evidence} · {row.featureCount.toLocaleString("es-CL")} entidades
                          {!row.visibleByDefault && " · desactivada por defecto"}
                        </span>
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 transition-transform ${expandedId === row.id ? "rotate-180" : ""}`}
                      />
                    </button>
                    {expandedId === row.id && (
                      <div className="space-y-2 border-t border-hairline px-3 py-3 text-xs">
                        <p>
                          <strong>Fuente:</strong> {row.source}
                        </p>
                        <p>
                          <strong>Escala:</strong> {row.scale}
                          {row.units ? ` · ${row.units}` : ""}
                        </p>
                        {row.caution && (
                          <p className="rounded-md bg-surface-2 p-2 text-content-muted">
                            <strong>Limitación:</strong> {row.caution}
                          </p>
                        )}
                        {row.examples.length > 0 && (
                          <p className="break-words text-content-muted">
                            <strong>Identificadores:</strong> {row.examples.join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <footer className="border-t border-hairline bg-surface-2 px-3 py-2 text-[10px] leading-relaxed text-content-muted">
            Inventario de capas GeoJSON entregadas a esta escena. No incluye todas las fuentes
            remotas ni implica recurso mineral, profundidad medida o reserva certificada. Para
            activar capas utiliza «Capas».
          </footer>
        </section>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? "mining-evidence-content" : undefined}
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-lg border border-hairline bg-surface px-4 py-2 text-xs font-semibold text-content shadow-lg hover:border-accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        data-theme="im-light"
      >
        <Database className="h-4 w-4 text-accent-brand" aria-hidden="true" />
        Evidencia
        <span className="font-mono text-content-muted">{rows.length}</span>
      </button>
    </aside>
  );
}

import { X } from "lucide-react";
import { EvidenceBadge } from "@/components/ui-system";
import { featureLabel, type ResolvedProjectLayer } from "../projectLayers";
import { featureFacts, provenanceLabel } from "../featureFacts";

/** Ficha lateral del elemento seleccionado: solo atributos reales y su procedencia. */
export function FeatureInspector({
  layer,
  properties,
  onClose,
}: {
  layer: ResolvedProjectLayer;
  properties: Record<string, unknown>;
  onClose: () => void;
}) {
  const d = layer.definition;
  const facts = featureFacts(properties);
  const prov = provenanceLabel(properties.procedencia);
  const warning = typeof properties.advertencia === "string" ? properties.advertencia : null;
  return (
    <aside
      data-theme="im-light"
      aria-label="Ficha del elemento"
      className="absolute right-3 top-16 z-30 flex max-h-[calc(100%-6rem)] w-[min(19rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded border border-hairline bg-surface/95 text-content shadow-lg backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2 border-b border-hairline px-3 py-2.5">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{d.label}</div>
          <h3 className="mt-0.5 font-serif text-base leading-tight">{featureLabel(properties)}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ficha"
          className="grid h-9 w-9 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-xs">
        {facts.length ? (
          <dl className="divide-y divide-hairline">
            {facts.map((f) => (
              <div key={f.label} className="flex justify-between gap-3 py-1.5">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="text-right font-mono text-[11px]">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="py-2 text-muted-foreground">El elemento no trae atributos adicionales en su fuente.</p>
        )}
      </div>
      <div className="space-y-1.5 border-t border-hairline px-3 py-2 text-[10px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <EvidenceBadge kind={d.evidence} scale={d.scaleLabel} size="xs" />
          {prov && prov !== d.evidence && (
            <span className="font-mono uppercase text-muted-foreground">· {prov}</span>
          )}
        </div>
        <div className="text-muted-foreground">Fuente: {layer.source ?? d.sourceSystem}</div>
        {(warning ?? d.caution) && <div className="leading-snug text-amber-700">{warning ?? d.caution}</div>}
      </div>
    </aside>
  );
}

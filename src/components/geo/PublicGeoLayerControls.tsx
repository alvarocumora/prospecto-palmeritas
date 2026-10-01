import { Layers3, ShieldCheck } from "lucide-react";
import { EvidenceBadge } from "@/components/ui-system";
import {
  isCertificationEvidence,
  type PublicGeoManifest,
} from "@/lib/geospatial/publicGeoContract";
import type { CanonicalGeoLayerId } from "@/lib/geospatial/layerRegistry";

export function PublicGeoLayerControls({
  manifest,
  available,
  visible,
  certificationMode,
  onToggleLayer,
  onToggleCertification,
  compact = false,
}: {
  manifest: PublicGeoManifest;
  available: ReadonlySet<string>;
  visible: ReadonlySet<string>;
  certificationMode: boolean;
  onToggleLayer: (id: CanonicalGeoLayerId) => void;
  onToggleCertification: () => void;
  compact?: boolean;
}) {
  const layers = manifest.layers.filter((layer) => available.has(layer.id));

  return (
    <div
      className={`rounded border border-border bg-background/95 p-2.5 shadow-lg backdrop-blur ${compact ? "w-[18rem]" : "w-[21rem]"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-2">
        <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
          <Layers3 className="h-3.5 w-3.5 text-gold" />
          Capas públicas canónicas
        </div>
        <button
          type="button"
          onClick={onToggleCertification}
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-mono text-[9px] uppercase ${
            certificationMode
              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600"
              : "border-border text-muted-foreground"
          }`}
          title="Mostrar sólo evidencia oficial, certificada o medida"
        >
          <ShieldCheck className="h-3 w-3" />
          Evidencia primaria
        </button>
      </div>

      <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
        {layers.map((layer) => {
          const blocked = certificationMode && !isCertificationEvidence(layer.evidence);
          const active = visible.has(layer.id) && !blocked;
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => onToggleLayer(layer.id)}
              disabled={blocked}
              className={`w-full rounded border p-2 text-left transition-colors ${
                active
                  ? "border-gold/50 bg-gold/5"
                  : "border-border bg-background/40 text-muted-foreground"
              } disabled:cursor-not-allowed disabled:opacity-45`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-medium leading-tight text-foreground">
                  {layer.label}
                </span>
                <span
                  className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    active ? "bg-gold" : "bg-muted-foreground/30"
                  }`}
                />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <EvidenceBadge kind={layer.evidence} scale={layer.scaleLabel} size="xs" />
                <span className="font-mono text-[9px] text-muted-foreground">
                  {layer.sourceSystem}
                </span>
              </div>
              {layer.caution && active && (
                <div className="mt-1.5 text-[9px] leading-snug text-amber-600">{layer.caution}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

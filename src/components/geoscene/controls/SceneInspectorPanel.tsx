import { ChevronRight, Satellite, Target } from "lucide-react";
import { BrandButton } from "@/components/brand";
import { PROCESSED_INDICES, RAMP_CSS, type ProcessedIndex } from "../processedSceneStyle";
import {
  GRADE_COMMODITY_LABEL,
  GRADE_CUTOFF_DEFAULT,
  type GradeCommodity,
  type GradeLegendEntry,
} from "../sampleGradeStyle";

/**
 * Columna anclada a la derecha — reemplaza las cajas flotantes de Sentinel-2
 * y ley de muestras, que competían por el mismo espacio que la cabecera y el
 * panel de capas. Solo ocupa espacio cuando hay algo que mostrar (sondajes/
 * muestras encendidas, o la capa Sentinel-2 procesada disponible); si no,
 * no se renderiza y el lienzo recupera ese ancho.
 */
export function SceneInspectorPanel({
  open,
  onClose,
  sentinel,
  sampleGrade,
}: {
  open: boolean;
  onClose: () => void;
  sentinel?: {
    on: boolean;
    onToggle: (v: boolean) => void;
    index: ProcessedIndex;
    onIndex: (v: ProcessedIndex) => void;
    range: [number, number];
    opacity: number;
    onOpacity: (v: number) => void;
  };
  sampleGrade?: {
    commodity: GradeCommodity;
    onCommodity: (v: GradeCommodity) => void;
    cutoff: number;
    onCutoff: (v: number) => void;
    legend: readonly GradeLegendEntry[];
  };
}) {
  if (!open || (!sentinel && !sampleGrade)) return null;

  return (
    <div
      data-theme="im-light"
      className="relative z-10 flex h-full w-64 shrink-0 flex-col overflow-hidden border-l border-hairline bg-surface text-xs text-content"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-3 py-2.5">
        <div className="font-serif text-sm text-content">Inspector</div>
        <BrandButton
          variant="ghost"
          size="sm"
          type="button"
          onClick={onClose}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Ocultar inspector"
          title="Ocultar"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </BrandButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {sampleGrade && (
          <section className="mb-3 border-b border-hairline pb-3 last:border-0">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <Target className="h-3 w-3" />
                Ley de muestras
              </div>
              <div className="flex gap-1">
                {(Object.keys(GRADE_COMMODITY_LABEL) as GradeCommodity[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => sampleGrade.onCommodity(c)}
                    aria-pressed={sampleGrade.commodity === c}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      sampleGrade.commodity === c
                        ? "bg-gold/80 text-background"
                        : "border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {GRADE_COMMODITY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <label className="mb-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
              Corte
              <input
                type="range"
                min={0}
                max={GRADE_CUTOFF_DEFAULT[sampleGrade.commodity].max}
                step={GRADE_CUTOFF_DEFAULT[sampleGrade.commodity].step}
                value={sampleGrade.cutoff}
                onChange={(e) => sampleGrade.onCutoff(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-12 shrink-0 text-right text-foreground">
                {sampleGrade.cutoff}
                {sampleGrade.commodity === "cu_pct" ? "%" : " ppm"}
              </span>
            </label>
            <ul className="space-y-1">
              {sampleGrade.legend.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-2 text-[11px] text-foreground"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: `rgb(${item.color.join(",")})` }}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="text-muted-foreground">{item.count}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">
              Bajo el corte se oculta (gris = sin dato). Ensayes puntuales, no define recurso.
            </p>
          </section>
        )}

        {sentinel && (
          <section>
            <label className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <input
                type="checkbox"
                checked={sentinel.on}
                onChange={(e) => sentinel.onToggle(e.target.checked)}
              />
              <Satellite className="h-3 w-3" />
              Sentinel-2 L2A procesada
            </label>
            {sentinel.on && (
              <div className="space-y-2">
                <select
                  value={sentinel.index}
                  onChange={(e) => sentinel.onIndex(e.target.value as ProcessedIndex)}
                  className="w-full rounded border border-border bg-background px-1.5 py-1 text-[10px] text-foreground"
                  aria-label="Índice espectral"
                >
                  {PROCESSED_INDICES.map((i) => (
                    <option key={i.key} value={i.key}>
                      {i.label}
                    </option>
                  ))}
                </select>
                <div>
                  <div className="h-2 w-full rounded-sm" style={{ background: RAMP_CSS }} />
                  <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
                    <span>{sentinel.range[0].toFixed(3)}</span>
                    <span>{sentinel.range[1].toFixed(3)}</span>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  Opacidad
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={sentinel.opacity}
                    onChange={(e) => sentinel.onOpacity(Number(e.target.value))}
                    className="flex-1"
                  />
                </label>
              </div>
            )}
            <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground">
              MODELADO · índice derivado de reflectancia real. No identifica minerales ni reemplaza
              ensayes.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

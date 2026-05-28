// AIGeologistPanel — Sprint 5
// Panel overlay con la interpretación generada por el motor heurístico AI Geologist.
import { Brain, X, AlertTriangle, TrendingUp, ListChecks, Sparkles } from "lucide-react";
import type { AIInterpretation } from "@/engine3d/ai/aiGeologist";
import { Button } from "@/components/ui/button";

const UPSIDE_COLOR: Record<AIInterpretation["upside"], string> = {
  limited: "text-muted-foreground",
  moderate: "text-amber-300",
  high: "text-emerald-300",
  exceptional: "text-fuchsia-300",
};

const UNCERTAINTY_COLOR: Record<AIInterpretation["uncertainty"], string> = {
  low: "text-emerald-300",
  medium: "text-amber-300",
  high: "text-red-300",
};

type Props = {
  interpretation: AIInterpretation | null;
  onRegenerate: () => void;
  onClose: () => void;
};

export function AIGeologistPanel({ interpretation, onRegenerate, onClose }: Props) {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-[min(640px,92%)] max-h-[88%] overflow-y-auto bg-black/90 backdrop-blur rounded-lg border border-violet-500/40 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-violet-500/10">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-300" />
          <span className="text-xs font-mono uppercase tracking-wider text-violet-200">
            AI Geologist
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={onRegenerate}>
            <Sparkles className="w-3 h-3 mr-1" /> Regenerar
          </Button>
          <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {!interpretation ? (
        <div className="p-6 text-center text-[11px] text-muted-foreground font-mono">
          Sin datos suficientes para generar interpretación.
        </div>
      ) : (
        <div className="p-4 space-y-3 text-[11px] font-mono">
          <div>
            <div className="text-foreground text-sm font-semibold">{interpretation.headline}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">
              {new Date(interpretation.generatedAt).toLocaleString()}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <KpiBox label="Upside" value={interpretation.upside.toUpperCase()} cls={UPSIDE_COLOR[interpretation.upside]} />
            <KpiBox label="Incertidumbre" value={interpretation.uncertainty.toUpperCase()} cls={UNCERTAINTY_COLOR[interpretation.uncertainty]} />
            <KpiBox label="Sondajes" value={`${interpretation.stats.drillholes} (${interpretation.stats.aiHoles} IA)`} cls="text-foreground" />
          </div>

          <Section icon={<Brain className="w-3 h-3 text-violet-300" />} title="Interpretación geológica">
            <ul className="list-disc list-inside space-y-1 text-foreground/85">
              {interpretation.interpretation.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </Section>

          <Section icon={<TrendingUp className="w-3 h-3 text-emerald-300" />} title="Drivers de upside">
            {interpretation.upsideDrivers.length === 0 ? (
              <div className="text-muted-foreground">Sin drivers fuertes detectados.</div>
            ) : (
              <ul className="list-disc list-inside space-y-1 text-emerald-200/85">
                {interpretation.upsideDrivers.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            )}
          </Section>

          <Section icon={<AlertTriangle className="w-3 h-3 text-amber-300" />} title="Drivers de incertidumbre">
            {interpretation.uncertaintyDrivers.length === 0 ? (
              <div className="text-muted-foreground">Sin drivers materiales de incertidumbre.</div>
            ) : (
              <ul className="list-disc list-inside space-y-1 text-amber-200/85">
                {interpretation.uncertaintyDrivers.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            )}
          </Section>

          <Section icon={<AlertTriangle className="w-3 h-3 text-red-300" />} title="Riesgos">
            <ul className="list-disc list-inside space-y-1 text-red-200/85">
              {interpretation.risks.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </Section>

          <Section icon={<ListChecks className="w-3 h-3 text-cyan-300" />} title="Próximos pasos recomendados">
            <ul className="list-disc list-inside space-y-1 text-cyan-200/85">
              {interpretation.nextSteps.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </Section>

          <div className="text-[9px] text-muted-foreground pt-2 border-t border-border">
            Interpretación generada por heurística determinista sobre la data disponible. No reemplaza
            un Qualified Person (NI 43-101). Toda recomendación debe validarse con campo y QA/QC.
          </div>
        </div>
      )}
    </div>
  );
}

function KpiBox({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded border border-border bg-black/40 px-2 py-1.5">
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {icon}
        <span>{title}</span>
      </div>
      <div className="pl-2">{children}</div>
    </div>
  );
}

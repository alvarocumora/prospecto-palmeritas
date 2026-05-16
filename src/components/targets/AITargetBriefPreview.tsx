import { useMemo } from "react";
import { FeatureGate } from "@/components/features/FeatureGate";
import {
  buildExplorationTargetContext,
  buildTargetAnalysisPrompt,
  buildTargetBriefMarkdown,
} from "@/lib/targetContext";
import type { SaaSCapabilityContext } from "@/lib/features/capabilities";
import type { ExplorationTargetContextInput } from "@/types/targetContext";

type AITargetBriefPreviewProps = {
  context: SaaSCapabilityContext;
  target: ExplorationTargetContextInput;
  language?: "es" | "en";
};

function FeatureFallback() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        AI Target Brief
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Esta vista requiere la capacidad AI Copilot habilitada para el tenant o proyecto.
      </p>
    </div>
  );
}

export function AITargetBriefPreview({
  context,
  target,
  language = "es",
}: AITargetBriefPreviewProps) {
  const targetContext = useMemo(() => buildExplorationTargetContext(target), [target]);
  const markdown = useMemo(() => buildTargetBriefMarkdown(targetContext), [targetContext]);
  const prompt = useMemo(
    () => buildTargetAnalysisPrompt(targetContext, { language, includeRecommendedActions: true }),
    [language, targetContext],
  );

  return (
    <FeatureGate feature="geocapital.ai_copilot" context={context} fallback={<FeatureFallback />}>
      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              AI Target Brief
            </div>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{targetContext.name}</h2>
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-2 text-right">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Fusion Score
            </div>
            <div className="text-2xl font-semibold text-foreground">
              {targetContext.fusionScore.score}
            </div>
            <div className="text-xs uppercase text-muted-foreground">
              {targetContext.fusionScore.confidence}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-border bg-background p-4">
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Drivers
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-foreground">
              {targetContext.fusionScore.drivers.length > 0 ? (
                targetContext.fusionScore.drivers.map((driver) => <li key={driver}>• {driver}</li>)
              ) : (
                <li className="text-muted-foreground">Sin drivers destacados.</li>
              )}
            </ul>
          </div>

          <div className="rounded-md border border-border bg-background p-4">
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Evidencia
            </h3>
            <p className="mt-3 text-sm text-foreground">
              Total: {targetContext.evidenceSummary.total}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Categorías: {targetContext.evidenceSummary.categories.join(", ") || "sin categorías"}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-background p-4">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Markdown Brief
          </h3>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {markdown}
          </pre>
        </div>

        <div className="rounded-md border border-border bg-background p-4">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Prompt Preview
          </h3>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {prompt}
          </pre>
        </div>
      </section>
    </FeatureGate>
  );
}

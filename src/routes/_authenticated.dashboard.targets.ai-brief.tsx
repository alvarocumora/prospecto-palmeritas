import { createFileRoute } from "@tanstack/react-router";
import { AITargetBriefPreview } from "@/components/targets/AITargetBriefPreview";
import type { ExplorationTargetContextInput } from "@/types/targetContext";

export const Route = createFileRoute("/_authenticated/dashboard/targets/ai-brief")({
  head: () => ({ meta: [{ title: "AI Target Brief — Geocapitals" }] }),
  component: AITargetBriefDemoPage,
});

const demoTarget: ExplorationTargetContextInput = {
  targetId: "demo-target-norte",
  name: "Target Norte Profundo",
  inputs: {
    geophysics: 88,
    geochemistry: 82,
    structural: 76,
    satellite: 69,
    drilling: 61,
  },
  evidence: [
    {
      id: "target-norte",
      category: "target",
      label: "Anomalía coincidente IP + magnetometría",
      confidence: "high",
      source: "Fusion Score",
    },
    {
      id: "intercept-ddh-001",
      category: "intercept",
      label: "DDH-001 24 m @ 1.2 g/t Au",
      confidence: "medium",
      source: "Core logging",
    },
    {
      id: "alteration-argillic",
      category: "alteration",
      label: "Halo argílico avanzado sobre estructura NNE",
      confidence: "medium",
      source: "Mapping",
    },
    {
      id: "assay-rockchip-01",
      category: "assay",
      label: "Rock chip Au-Cu anómalo en veta principal",
      confidence: "medium",
      source: "Sampling",
    },
  ],
};

function AITargetBriefDemoPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8 pb-20 md:pb-8">
      <header className="mb-6">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Targets · AI Brief Preview
        </div>
        <h1 className="mt-1 text-2xl font-bold text-foreground">AI Target Brief Preview</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Demo interna del flujo Fusion Score → Evidencia → Target Context → Markdown Brief → Prompt
          Preview. No llama modelos IA ni modifica datos productivos.
        </p>
      </header>

      <AITargetBriefPreview
        context={{
          plan: "pro",
          featureOverrides: {
            "geocapital.ai_copilot": { enabled: true, reason: "Internal preview route" },
          },
        }}
        target={demoTarget}
      />
    </div>
  );
}

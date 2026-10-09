import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { AITargetBriefPreview } from "@/components/targets/AITargetBriefPreview";
import { GeologicalEvidenceSummary } from "@/components/targets/GeologicalEvidenceSummary";
import { useProjects } from "@/hooks/useProjects";
import { useExplorationTargets } from "@/hooks/useExplorationTargets";
import { useTargetGeologyEvidence } from "@/hooks/useTargetGeologyEvidence";
import type { ExplorationTargetContextInput } from "@/types/targetContext";

const searchSchema = z.object({
  targetId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/dashboard/targets/ai-brief")({
  head: () => ({ meta: [{ title: "AI Target Brief — Geocapitals" }] }),
  validateSearch: searchSchema,
  component: AITargetBriefPage,
});

const demoTarget: ExplorationTargetContextInput = {
  targetId: "demo-target-norte",
  name: "Target Norte Profundo (demo)",
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
  ],
};

function AITargetBriefPage() {
  const { targetId } = Route.useSearch();
  const { active } = useProjects();
  const { targets, loading } = useExplorationTargets(active?.id ?? null);

  const selected = useMemo(
    () => (targetId ? (targets.find((t) => t.id === targetId) ?? null) : null),
    [targets, targetId],
  );

  const {
    data: geo,
    loading: geoLoading,
    error: geoError,
  } = useTargetGeologyEvidence(
    active?.id ?? null,
    selected ? { lat: selected.lat, lng: selected.lng } : null,
    1500,
  );

  const targetInput: ExplorationTargetContextInput = useMemo(() => {
    if (!selected) return demoTarget;
    return {
      targetId: selected.id,
      name: selected.name,
      inputs: {
        geophysics: 0,
        geochemistry: 0,
        structural: 0,
        satellite: 0,
        drilling: 0,
      },
      evidence: [
        {
          id: `target:${selected.id}`,
          category: "target",
          label: `${selected.code} · ${selected.target_type}${selected.commodity ? ` · ${selected.commodity}` : ""}${selected.score != null ? ` · score ${selected.score}` : ""}`,
          confidence:
            selected.priority === "critical" || selected.priority === "high" ? "high" : "medium",
          source: "Targets pipeline",
        },
        ...(geo?.evidence ?? []),
      ],
    };
  }, [selected, geo]);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8 pb-20 md:pb-8 space-y-6">
      <header>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Link
            to="/dashboard/targets"
            search={{ project: active?.id }}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="w-3 h-3" /> Targets
          </Link>
          <span>·</span>
          <span>AI Brief</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {selected ? selected.name : "AI Target Brief Preview"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {selected
            ? `Brief con evidencia geológica trazable (host rock + alteración) calculada sobre el target ${selected.code}.`
            : "Demo interna del flujo Fusion Score → Evidencia → Target Context → Markdown Brief → Prompt. Selecciona un target desde el pipeline para conectar evidencia geológica real."}
        </p>
      </header>

      {selected && (
        <GeologicalEvidenceSummary
          data={geo}
          loading={geoLoading}
          error={geoError}
          radiusM={1500}
        />
      )}

      {loading && targetId ? (
        <div className="rounded-md border border-border bg-card p-4 text-xs font-mono text-muted-foreground">
          Cargando target…
        </div>
      ) : (
        <AITargetBriefPreview
          context={{
            plan: "pro",
            featureOverrides: {
              "geocapital.ai_copilot": { enabled: true, reason: "Internal preview route" },
            },
          }}
          target={targetInput}
        />
      )}
    </div>
  );
}

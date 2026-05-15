import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AITargetBriefPreview } from "./AITargetBriefPreview";
import type { ExplorationTargetContextInput } from "@/types/targetContext";

const target: ExplorationTargetContextInput = {
  targetId: "t-001",
  name: "Target Norte",
  inputs: {
    geophysics: 90,
    geochemistry: 80,
    structural: 75,
    satellite: 70,
    drilling: 60,
  },
  evidence: [
    { id: "e1", category: "target", label: "Target Norte", confidence: "high", source: "Fusion Score" },
    { id: "e2", category: "intercept", label: "DDH-001 24m @ 1.2 g/t Au", confidence: "medium" },
  ],
};

describe("AITargetBriefPreview", () => {
  it("renders the brief preview when AI Copilot is enabled", () => {
    render(<AITargetBriefPreview context={{ plan: "pro" }} target={target} />);

    expect(screen.getByText("AI Target Brief")).toBeInTheDocument();
    expect(screen.getByText("Target Norte")).toBeInTheDocument();
    expect(screen.getByText("Fusion Score")).toBeInTheDocument();
    expect(screen.getByText("Markdown Brief")).toBeInTheDocument();
    expect(screen.getByText("Prompt Preview")).toBeInTheDocument();
  });

  it("renders fallback when AI Copilot is unavailable", () => {
    render(<AITargetBriefPreview context={{ plan: "starter" }} target={target} />);

    expect(screen.getByText("AI Target Brief")).toBeInTheDocument();
    expect(screen.getByText(/requiere la capacidad AI Copilot/i)).toBeInTheDocument();
    expect(screen.queryByText("Markdown Brief")).not.toBeInTheDocument();
  });

  it("supports feature overrides", () => {
    render(
      <AITargetBriefPreview
        context={{
          plan: "starter",
          featureOverrides: {
            "geocapital.ai_copilot": { enabled: true, reason: "pilot" },
          },
        }}
        target={target}
        language="en"
      />
    );

    expect(screen.getByText("Prompt Preview")).toBeInTheDocument();
    expect(screen.getByText(/Analyze the exploration target/i)).toBeInTheDocument();
  });
});

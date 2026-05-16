import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeatureGate } from "./FeatureGate";

describe("FeatureGate", () => {
  it("renders children when a feature is enabled for the plan", () => {
    render(
      <FeatureGate feature="geocapital.ai_copilot" context={{ plan: "pro" }}>
        <div>Enabled content</div>
      </FeatureGate>,
    );

    expect(screen.getByText("Enabled content")).toBeInTheDocument();
  });

  it("renders fallback when a feature is unavailable", () => {
    render(
      <FeatureGate
        feature="geocapital.ai_copilot"
        context={{ plan: "starter" }}
        fallback={<div>Fallback content</div>}
      >
        <div>Enabled content</div>
      </FeatureGate>,
    );

    expect(screen.queryByText("Enabled content")).not.toBeInTheDocument();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
  });

  it("supports explicit overrides", () => {
    render(
      <FeatureGate
        feature="geocapital.investor_crm"
        context={{
          plan: "starter",
          featureOverrides: {
            "geocapital.investor_crm": { enabled: true, reason: "pilot" },
          },
        }}
      >
        <div>Override content</div>
      </FeatureGate>,
    );

    expect(screen.getByText("Override content")).toBeInTheDocument();
  });
});

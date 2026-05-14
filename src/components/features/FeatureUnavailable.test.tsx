import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeatureUnavailable } from "./FeatureUnavailable";

describe("FeatureUnavailable", () => {
  it("renders plan information", () => {
    render(<FeatureUnavailable feature="geocapital.ai_copilot" currentPlan="starter" requiredPlan="pro" />);

    expect(screen.getByText("Feature limit")).toBeInTheDocument();
    expect(screen.getByText("starter")).toBeInTheDocument();
    expect(screen.getByText("pro")).toBeInTheDocument();
  });

  it("uses a default target plan", () => {
    render(<FeatureUnavailable feature="geocapital.marketplace" currentPlan="free" />);

    expect(screen.getByText("Feature limit")).toBeInTheDocument();
    expect(screen.getByText("pro")).toBeInTheDocument();
  });
});

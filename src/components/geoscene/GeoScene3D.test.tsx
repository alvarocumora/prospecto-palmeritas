import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeoScene3D } from "./GeoScene3D";

vi.mock("./SceneCopilot", () => ({
  SceneCopilot: () => <div data-testid="scene-copilot" />,
}));
vi.mock("./canvas/GeoSceneCanvas", () => ({
  GeoSceneCanvas: ({ mode }: { mode: string }) => <div data-testid={`deckgl-${mode}`} />,
}));

describe("GeoScene3D", () => {
  it("renders canonical deck.gl mode by default", async () => {
    render(<GeoScene3D mode="surface" />);
    expect(screen.getByTitle(/DEM/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Capas 3D canónicas/i)).toBeInTheDocument();
    expect(screen.queryByText(/legacy/i)).not.toBeInTheDocument();
  });

  it("always renders the single deck.gl engine (legacy three.js retired)", async () => {
    render(<GeoScene3D mode="subsurface" variant="mag" />);
    expect(await screen.findByTestId("deckgl-subsurface")).toBeInTheDocument();
  });

  it("renders resource stub when mode=resource", () => {
    render(<GeoScene3D mode="resource" />);
    expect(screen.getByText(/Resource mode/i)).toBeInTheDocument();
  });
});

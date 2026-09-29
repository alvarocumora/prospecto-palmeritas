import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeoScene3D } from "./GeoScene3D";

vi.mock("@/components/Geology3DViewer", () => ({
  Geology3DViewer: () => <div data-testid="surface-viewer" />,
}));
vi.mock("@/components/geology3d/SatToSubsurface3DViewer", () => ({
  SatToSubsurface3DViewer: () => <div data-testid="subsurface-viewer" />,
}));
vi.mock("@/features/mag3d/MagAnomaly3DPro", () => ({
  MagAnomaly3DPro: () => <div data-testid="mag-viewer" />,
}));
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

  it("keeps the legacy engine available only when explicitly requested", () => {
    render(<GeoScene3D mode="surface" showLegacyEngineSwitch />);
    expect(screen.getByText(/legacy/i)).toBeInTheDocument();
  });

  it("renders resource stub when mode=resource", () => {
    render(<GeoScene3D mode="resource" />);
    expect(screen.getByText(/Resource mode/i)).toBeInTheDocument();
  });
});

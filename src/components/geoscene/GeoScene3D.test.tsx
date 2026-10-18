import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GeoScene3D } from "./GeoScene3D";

vi.mock("./SceneCopilot", () => ({
  SceneCopilot: () => <div data-testid="scene-copilot" />,
}));
vi.mock("./canvas/GeoSceneCanvas", () => ({
  GeoSceneCanvas: ({ mode, view, visibleLayerIds }: { mode: string; view: string; visibleLayerIds: Set<string> }) => <div data-testid={`deckgl-${mode}`} data-view={view} data-layers={[...visibleLayerIds].join(",")} />,
}));

describe("GeoScene3D", () => {
  it("renders canonical deck.gl mode by default", async () => {
    render(<GeoScene3D mode="surface" />);
    expect(screen.getByTitle(/DEM/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Capas 3D canónicas/i)).toBeInTheDocument();
    expect(screen.queryByText(/legacy/i)).not.toBeInTheDocument();
    expect(await screen.findByTestId("deckgl-surface")).toBeInTheDocument();
  });

  it("always renders the single deck.gl engine (legacy three.js retired)", async () => {
    render(<GeoScene3D mode="subsurface" variant="mag" />);
    expect(await screen.findByTestId("deckgl-subsurface")).toBeInTheDocument();
  });

  it("renders resource stub when mode=resource", () => {
    render(<GeoScene3D mode="resource" />);
    expect(screen.getByText(/Resource mode/i)).toBeInTheDocument();
  });
  it("keeps the same canvas and layer selection when switching planta/perspectiva", async () => {
    const props = { showModeTabs: false, projectLayers: [{ id: "territory.cadastre" as const,
      data: { type: "FeatureCollection" as const, features: [] } }] };
    const { rerender } = render(<GeoScene3D {...props} view="2d" />);
    const canvas = await screen.findByTestId("deckgl-surface");
    fireEvent.click(screen.getByRole("button", { name: "Capas del proyecto" }));
    fireEvent.click(screen.getByRole("button", { name: /Catastro SERNAGEOMIN/ }));
    const layers = canvas.getAttribute("data-layers");
    expect(layers).not.toContain("territory.cadastre");
    rerender(<GeoScene3D {...props} view="3d" />);
    expect(screen.getByTestId("deckgl-surface")).toBe(canvas);
    expect(canvas).toHaveAttribute("data-view", "3d");
    expect(canvas).toHaveAttribute("data-layers", layers);
  });
  it("adds asynchronously loaded layers without re-enabling layers the operator disabled", async () => {
    const data = { type: "FeatureCollection" as const, features: [] };
    const { rerender } = render(<GeoScene3D projectLayers={[{ id: "territory.cadastre", data }]} />);
    const canvas = await screen.findByTestId("deckgl-surface");
    fireEvent.click(screen.getByRole("button", { name: "Capas del proyecto" }));
    fireEvent.click(screen.getByRole("button", { name: /Catastro SERNAGEOMIN/ }));
    rerender(<GeoScene3D projectLayers={[{ id: "territory.cadastre", data }, { id: "sampling.assays", data }]} />);
    await waitFor(() => expect(canvas.getAttribute("data-layers")).toContain("sampling.assays"));
    expect(canvas.getAttribute("data-layers")).not.toContain("territory.cadastre");
  });
  it("loads dense spectral overlays disabled without dropping their controls", async () => {
    render(<GeoScene3D projectLayers={[{ id: "remote_sensing.hyperspectral", defaultVisible: false,
      data: { type: "FeatureCollection", features: [] } }]} />);
    const canvas = await screen.findByTestId("deckgl-surface");
    expect(canvas.getAttribute("data-layers")).not.toContain("remote_sensing.hyperspectral");
    fireEvent.click(screen.getByRole("button", { name: "Capas del proyecto" }));
    fireEvent.click(screen.getByRole("button", { name: /Productos hiperespectrales/ }));
    expect(canvas.getAttribute("data-layers")).toContain("remote_sensing.hyperspectral");
  });
});

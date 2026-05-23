import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeoScene3D } from "./GeoScene3D";

// Stub heavy legacy viewers so the smoke test stays light.
vi.mock("@/components/Geology3DViewer", () => ({
  Geology3DViewer: () => <div data-testid="surface-viewer" />,
}));
vi.mock("@/components/geology3d/SatToSubsurface3DViewer", () => ({
  SatToSubsurface3DViewer: () => <div data-testid="subsurface-viewer" />,
}));
vi.mock("@/features/mag3d/MagAnomaly3DPro", () => ({
  MagAnomaly3DPro: () => <div data-testid="mag-viewer" />,
}));

describe("GeoScene3D", () => {
  it("renders mode tabs by default", () => {
    render(<GeoScene3D mode="surface" />);
    expect(screen.getByTitle(/DEM/i)).toBeInTheDocument();
  });

  it("renders resource stub when mode=resource", () => {
    render(<GeoScene3D mode="resource" />);
    expect(screen.getByText(/Resource mode/i)).toBeInTheDocument();
  });
});

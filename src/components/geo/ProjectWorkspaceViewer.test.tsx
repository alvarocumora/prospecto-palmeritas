import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProjectWorkspaceViewer } from "./ProjectWorkspaceViewer";

const context = vi.hoisted(() => ({
  projects: [
    { id: "first", name: "Proyecto A" },
    { id: "second", name: "Proyecto B" },
  ],
  active: { id: "first", name: "Proyecto A" },
  loading: false,
  setActiveId: vi.fn(),
}));

vi.mock("@/hooks/useProjects", () => ({ useProjects: () => context }));
vi.mock("@/components/geoscene", () => ({
  GeoScene3D: () => <div data-testid="scene">3D</div>,
}));
vi.mock("@/components/geo/SnapshotAwareProjectMap", () => ({
  SnapshotAwareProjectMap: () => <div data-testid="map">2D</div>,
}));

describe("project workspace isolation", () => {
  beforeEach(() => {
    context.active = context.projects[0];
    context.setActiveId.mockClear();
  });
  afterEach(cleanup);

  it("does not render another project's layers while activating an explicit UUID", () => {
    render(<ProjectWorkspaceViewer projectId="second" mode="3d" />);
    expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
    expect(screen.getByText("Activando proyecto…")).toBeInTheDocument();
    expect(context.setActiveId).toHaveBeenCalledWith("second");
  });

  it("does not substitute the active project when membership is missing", () => {
    render(<ProjectWorkspaceViewer projectId="unavailable" />);
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
    expect(context.setActiveId).not.toHaveBeenCalled();
  });

  it("honors the shareable 3D mode once the requested project is active", () => {
    context.active = context.projects[1];
    render(<ProjectWorkspaceViewer projectId="second" mode="3d" />);
    expect(screen.getByTestId("scene")).toBeInTheDocument();
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
  });
});

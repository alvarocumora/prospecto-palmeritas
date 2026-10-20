import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
vi.mock("./WorkspaceProjectLayers", () => ({
  WorkspaceProjectLayers: ({ view }: { view: string }) => (
    <div data-testid={view === "3d" ? "scene" : "map"}>{view}</div>
  ),
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
    expect(screen.getByRole("button", { name: "Planta" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Perspectiva" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("can leave mode selection to the project section navigation", () => {
    context.active = context.projects[1];
    render(
      <ProjectWorkspaceViewer projectId="second" mode="3d" compactHeader showModeToggle={false} />,
    );
    expect(screen.getByTestId("scene")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Proyecto B" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Planta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Perspectiva" })).not.toBeInTheDocument();
  });
  it("keeps one canvas while changing Planta/Perspectiva using accessible controls", () => {
    const onModeChange = vi.fn();
    render(
      <ProjectWorkspaceViewer
        projectId="first"
        defaultMode="2d"
        heightClassName="min-h-[480px]"
        onModeChange={onModeChange}
      />,
    );
    expect(screen.getByRole("group", { name: "Vista del proyecto" })).toBeInTheDocument();
    expect(screen.getByTestId("map").closest('[data-surface="canvas"]')).toHaveClass(
      "min-h-[480px]",
    );
    expect(screen.getByRole("button", { name: "Planta" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Perspectiva" }));

    expect(onModeChange).toHaveBeenCalledWith("3d");
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
    expect(screen.getByTestId("scene")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Perspectiva" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

});

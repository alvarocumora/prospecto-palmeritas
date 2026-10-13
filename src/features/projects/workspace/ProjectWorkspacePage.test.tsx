import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProjectWorkspacePage } from "./ProjectWorkspacePage";

const state = vi.hoisted(() => {
  const projects = [
    { id: "e5360f13-1647-4e44-bb13-c0614e6f39fe", name: "Proyecto A", code: "A" },
    { id: "7a499b02-ecdf-447b-8956-b106fe4ec087", name: "Proyecto B", code: "B" },
  ];
  return { projects, active: projects[0], loading: false, ready: true, allowed: true };
});

vi.mock("@/hooks/useProjects", () => ({ useProjects: () => state }));
vi.mock("@/hooks/useWorkspaceAccess", () => ({
  useWorkspaceAccess: () => ({
    ready: state.ready,
    canPath: () => ({ allowed: state.allowed }),
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/geo/ProjectWorkspaceViewer", () => ({
  ProjectWorkspaceViewer: ({
    projectId,
    mode,
    compactHeader,
    showModeToggle,
  }: {
    projectId: string;
    mode: string;
    compactHeader?: boolean;
    showModeToggle?: boolean;
  }) => (
    <div
      data-testid="viewer"
      data-compact-header={compactHeader}
      data-show-mode-toggle={showModeToggle}
    >
      {projectId + ":" + mode}
    </div>
  ),
}));

describe("canonical workspace isolation", () => {
  beforeEach(() => {
    state.active = state.projects[0];
    state.allowed = true;
    state.ready = true;
  });
  afterEach(cleanup);

  it("does not mount a section until its URL project is active", () => {
    render(
      <ProjectWorkspacePage
        projectId={state.projects[1].id}
        section="model"
        search={{}}
        onViewChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
    expect(screen.getByText("Activando proyecto…")).toBeInTheDocument();
  });

  it("does not substitute another asset for a missing membership", () => {
    render(
      <ProjectWorkspacePage
        projectId="00000000-0000-0000-0000-000000000000"
        section="overview"
        search={{}}
        onViewChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
    expect(
      screen.getByText("Este proyecto no está disponible en tu workspace."),
    ).toBeInTheDocument();
  });

  it("does not mount a section when its access policy rejects the user", () => {
    state.allowed = false;
    render(
      <ProjectWorkspacePage
        projectId={state.active.id}
        section="overview"
        search={{}}
        onViewChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
    expect(screen.getByText("No tienes acceso a esta sección del proyecto.")).toBeInTheDocument();
  });

  it("uses the path section and explicit UUID for the 3D model", () => {
    state.active = state.projects[1];
    render(
      <ProjectWorkspacePage
        projectId={state.active.id}
        section="model"
        search={{ view: "2d" }}
        onViewChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("viewer")).toHaveTextContent(state.active.id + ":3d");
    expect(screen.getByTestId("viewer")).toHaveAttribute("data-show-mode-toggle", "false");
    expect(screen.getByTestId("viewer")).toHaveAttribute("data-compact-header", "true");
  });
});

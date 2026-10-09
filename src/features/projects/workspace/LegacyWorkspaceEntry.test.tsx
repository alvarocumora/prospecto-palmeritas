import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LegacyWorkspaceEntry } from "./LegacyWorkspaceEntry";

const state = vi.hoisted(() => ({
  active: { id: "e5360f13-1647-4e44-bb13-c0614e6f39fe" },
  loading: false,
  location: {
    pathname: "/dashboard/project-report",
    search: { view: "3d", panel: "spv" },
    hash: "#evidence",
  },
  navigation: vi.fn(),
}));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => state }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => state.location,
  Link: () => null,
  Outlet: () => <div data-testid="child">Detalle de campaña</div>,
  Navigate: (props: unknown) => {
    state.navigation(props);
    return null;
  },
}));

describe("legacy workspace adapters", () => {
  beforeEach(() => {
    state.location.search.panel = "";
    state.location.pathname = "/dashboard/project-report";
    state.navigation.mockClear();
  });
  afterEach(cleanup);

  it("retains project, 3D intent and anchor in a historical report link", () => {
    render(<LegacyWorkspaceEntry section="overview" />);
    expect(state.navigation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/projects/$projectId/$section",
        params: { projectId: state.active.id, section: "model" },
        search: { project: undefined, view: "3d", panel: undefined },
        hash: "evidence",
        replace: true,
      }),
    );
  });

  it("keeps a historical SPV panel in overview even when the link includes 3D", () => {
    state.location.search.panel = "spv";
    render(<LegacyWorkspaceEntry section="overview" />);
    expect(state.navigation).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { projectId: state.active.id, section: "overview" },
        search: { project: undefined, view: "3d", panel: "spv" },
      }),
    );
  });

  it("renders survey children without redirecting away from their detail route", () => {
    state.location.pathname = "/dashboard/geophysics/survey-1";
    render(<LegacyWorkspaceEntry section="exploration" />);
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(state.navigation).not.toHaveBeenCalled();
  });

  it("keeps the AI Brief child reachable from the migrated targets section", () => {
    state.location.pathname = "/dashboard/targets/ai-brief";
    render(<LegacyWorkspaceEntry section="targets" />);
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(state.navigation).not.toHaveBeenCalled();
  });
});

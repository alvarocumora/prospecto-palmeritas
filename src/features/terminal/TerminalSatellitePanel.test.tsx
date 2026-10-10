import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTerminalProject, isTerminalTab } from "./terminalProjects";
import { TerminalSatellitePanel } from "./TerminalSatellitePanel";

const mocks = vi.hoisted(() => ({
  auth: { user: { id: "user" } as { id: string } | null, loading: false },
  projects: {
    projects: [] as Array<{ id: string; code: string; center_lat: number; center_lng: number }>,
    loading: false,
    error: null,
    refresh: vi.fn(),
  },
  panel: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => mocks.projects }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/auth">{children}</a>,
}));
vi.mock("@/components/satellite/SentinelProcessingPanel", () => ({
  SentinelProcessingPanel: (props: unknown) => {
    mocks.panel(props);
    return <div>Procesador real</div>;
  },
}));
const project = getTerminalProject("cholqui")!;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = { id: "user" };
  mocks.projects.projects = [];
});
describe("terminal satellite access", () => {
  it("accepts the satellite tab in terminal navigation", () => {
    expect(isTerminalTab("satelital")).toBe(true);
  });
  it("shows login instead of mounting the processor for anonymous users", () => {
    mocks.auth.user = null;
    render(<TerminalSatellitePanel project={project} />);
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
    expect(mocks.panel).not.toHaveBeenCalled();
  });
  it("never uses a different member project as fallback", () => {
    mocks.projects.projects = [{ id: "other", code: "CHOLQUI", center_lat: -33, center_lng: -71 }];
    render(<TerminalSatellitePanel project={project} />);
    expect(screen.getByRole("alert")).toHaveTextContent("no tiene un proyecto miembro");
    expect(mocks.panel).not.toHaveBeenCalled();
  });
  it("passes only the terminal project UUID and its own AOI", () => {
    mocks.projects.projects = [
      { id: project.projectId!, code: "CHOLQUI", center_lat: -33.9, center_lng: -71 },
    ];
    render(<TerminalSatellitePanel project={project} />);
    expect(screen.getByText("Procesador real")).toBeVisible();
    const props = mocks.panel.mock.calls[0][0];
    expect(props.projectId).toBe(project.projectId);
    expect(props.defaultBbox[0]).toBeLessThan(-71);
    expect(props.defaultBbox[2]).toBeGreaterThan(-71);
  });
});

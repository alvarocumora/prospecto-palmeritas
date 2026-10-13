import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SentinelProcessingPanel } from "./SentinelProcessingPanel";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  process: vi.fn(),
  download: vi.fn(),
  refetch: vi.fn(),
  invalidateQueries: vi.fn(),
}));
vi.mock("@/lib/sentinelProcessing.functions", () => ({
  listSentinelProcessingScenes: mocks.list,
  processSentinelScene: mocks.process,
  getSentinelRasterDownload: mocks.download,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isPending: false, isError: false, refetch: mocks.refetch }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
describe("real Sentinel processing workflow", () => {
  it("refuses a missing AOI instead of using another project's coordinates", () => {
    render(<SentinelProcessingPanel projectId="project" />);
    expect(screen.getByRole("button", { name: "Buscar escenas Sentinel-2" })).toBeDisabled();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it("requires scene selection and shows a processor failure without declaring success", async () => {
    mocks.list.mockResolvedValue({
      ok: true,
      error: null,
      scenes: [{ id: "scene-real", datetime: "2025-03-23T14:37:49Z", cloudPct: 3.5 }],
    });
    mocks.process.mockResolvedValue({ ok: false, runId: "run", error: "NO_CLEAR_VALID_PIXELS" });
    render(
      <SentinelProcessingPanel
        projectId="project"
        defaultBbox={[-71.05, -33.91, -71.02, -33.88]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buscar escenas Sentinel-2" }));
    await waitFor(() => expect(screen.getByLabelText("Escena a procesar")).toBeVisible());
    expect(screen.getByRole("button", { name: "Procesar reflectancia real" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Escena a procesar"), {
      target: { value: "scene-real" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Procesar reflectancia real" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("NO_CLEAR_VALID_PIXELS"),
    );
    expect(mocks.process).toHaveBeenCalledWith({
      data: { projectId: "project", bbox: [-71.05, -33.91, -71.02, -33.88], sceneId: "scene-real" },
    });
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.refetch).toHaveBeenCalled();
  });
});

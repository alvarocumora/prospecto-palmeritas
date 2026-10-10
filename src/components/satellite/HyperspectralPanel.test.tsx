import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HyperspectralPanel } from "./HyperspectralPanel";
const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  seed: vi.fn(),
  explain: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/satelliteIntel.functions", () => ({
  searchStac: mocks.search,
  seedHyperspectralFromScene: mocks.seed,
  explainHyperspectralProducts: mocks.explain,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/hooks/useHyperspectralProducts", () => ({
  useHyperspectralProducts: () => ({
    products: [],
    loading: false,
    error: null,
    refresh: mocks.refresh,
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
describe("hyperspectral demonstration gate", () => {
  it("does not offer generation without a project AOI", () => {
    render(<HyperspectralPanel projectId="test-project" />);
    expect(screen.getByRole("button", { name: "Crear demostración desde escena" })).toBeDisabled();
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it("never seeds mineral products when the STAC search returns no scene", async () => {
    mocks.search.mockResolvedValue({ items: [], error: null });
    render(<HyperspectralPanel projectId="test-project" defaultBbox={[-71.2, -34, -71, -33.8]} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear demostración desde escena" }));
    await waitFor(() => expect(screen.getByText(/No hay escenas disponibles/)).toBeVisible());
    expect(mocks.seed).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

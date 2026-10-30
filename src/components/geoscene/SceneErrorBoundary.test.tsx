import { Component, type ErrorInfo, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SceneErrorBoundary } from "./SceneErrorBoundary";

function Boom({ error }: { error: Error }): never {
  throw error;
}

/** Boundary externo de prueba: simula el error boundary raíz del router. */
class OuterBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {}
  render() {
    if (this.state.error) return <div>router fallback: {this.state.error.message}</div>;
    return this.props.children;
  }
}

describe("SceneErrorBoundary", () => {
  it("contains an ordinary render error with the inline fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <SceneErrorBoundary label="Cholqui">
        <Boom error={new Error("geometría inválida")} />
      </SceneErrorBoundary>,
    );
    expect(screen.getByText(/no disponible para este proyecto/i)).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("lets a chunk-load error pass through to an outer boundary instead of swallowing it", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const chunkError = new Error("Failed to fetch dynamically imported module");
    render(
      <OuterBoundary>
        <SceneErrorBoundary label="Cholqui">
          <Boom error={chunkError} />
        </SceneErrorBoundary>
      </OuterBoundary>,
    );
    expect(screen.queryByText(/no disponible para este proyecto/i)).not.toBeInTheDocument();
    expect(screen.getByText(/router fallback/i)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});

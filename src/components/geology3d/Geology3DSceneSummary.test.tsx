import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Geology3DSceneSummary } from "./Geology3DSceneSummary";

describe("Geology3DSceneSummary", () => {
  it("renders empty state", () => {
    render(<Geology3DSceneSummary structures={[]} />);

    expect(screen.getByText(/No hay estructuras 3D/i)).toBeInTheDocument();
  });

  it("renders scene objects", () => {
    render(
      <Geology3DSceneSummary
        structures={[
          {
            id: "ore-01",
            type: "ore_body",
            name: "Ore Body Norte",
            color: "#facc15",
            vertices: [
              { x: 0, y: 0, z: 0 },
              { x: 10, y: 0, z: 5 },
              { x: 10, y: 20, z: 10 },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Geology 3D Scene")).toBeInTheDocument();
    expect(screen.getByText("Ore Body Norte")).toBeInTheDocument();
    expect(screen.getByText("ore body")).toBeInTheDocument();
    expect(screen.getByText("Objects")).toBeInTheDocument();
  });
});

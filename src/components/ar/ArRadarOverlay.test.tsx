import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArRadarOverlay } from "./ArRadarOverlay";

describe("ArRadarOverlay", () => {
  it("renders nearby projected objects", () => {
    render(
      <ArRadarOverlay
        headingDeg={90}
        objects={[
          {
            id: "t1",
            type: "target",
            label: "Target Norte",
            lat: -31.72,
            lng: -71.27,
            distanceM: 120,
            bearingDeg: 80,
            relativeBearingDeg: -10,
            relativeElevationM: 15,
            labelCompact: "Target Norte · 120 m",
            isNearby: true,
          },
        ]}
      />,
    );

    expect(screen.getByText("AR Radar")).toBeInTheDocument();
    expect(screen.getByText("Target Norte")).toBeInTheDocument();
    expect(screen.getByText("120 m")).toBeInTheDocument();
    expect(screen.getByText("nearby")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<ArRadarOverlay headingDeg={null} objects={[]} />);

    expect(screen.getByText(/Sin anomalías ni targets cercanos/i)).toBeInTheDocument();
  });
});

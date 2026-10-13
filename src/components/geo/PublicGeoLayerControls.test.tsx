/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PublicGeoLayerControls } from "./PublicGeoLayerControls";
import { buildPublicGeoManifest } from "@/lib/geospatial/publicGeoContract";

afterEach(cleanup);
const manifest = buildPublicGeoManifest(
  { id: "cholqui", name: "Cholqui", center_lat: -33.8, center_lng: -71 },
  ["territory.cadastre", "remote_sensing.sentinel2_alteration"],
);
const available = new Set(manifest.layers.map((layer) => layer.id));

describe("public layer controls", () => {
  it("keeps the map unobstructed until the layer panel is expanded", () => {
    render(
      <PublicGeoLayerControls
        manifest={manifest}
        available={available}
        visible={available}
        certificationMode={false}
        onToggleLayer={vi.fn()}
        onToggleCertification={vi.fn()}
      />,
    );
    expect(screen.queryByRole("searchbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Capas de evidencia/ }));
    expect(screen.getByRole("searchbox")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "sin coincidencias" } });
    expect(screen.getByText("Sin capas para esta búsqueda.")).toBeTruthy();
  });

  it("blocks derived layers in primary-evidence mode, including their opacity sliders", () => {
    const onOpacity = vi.fn();
    render(
      <PublicGeoLayerControls
        manifest={manifest}
        available={available}
        visible={available}
        certificationMode
        onToggleLayer={vi.fn()}
        onToggleCertification={vi.fn()}
        onOpacity={onOpacity}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Capas de evidencia/ }));
    const label = manifest.layers.find(
      (layer) => layer.id === "remote_sensing.sentinel2_alteration",
    )!.label;
    expect(
      (screen.getByRole("slider", { name: "Opacidad de " + label }) as HTMLInputElement).disabled,
    ).toBe(true);
    const official = screen.getByRole("slider", {
      name: "Opacidad de " + manifest.layers[0].label,
    });
    fireEvent.change(official, { target: { value: "0.4" } });
    expect(onOpacity).toHaveBeenCalledWith("territory.cadastre", 0.4);
  });

  it("renders the project object tree with DEM, grouped evidence and custom geophysics controls", () => {
    const onTerrainToggle = vi.fn();
    const onTerrainOpacity = vi.fn();
    render(
      <PublicGeoLayerControls
        manifest={manifest}
        available={available}
        visible={available}
        certificationMode={false}
        onToggleLayer={vi.fn()}
        onToggleCertification={vi.fn()}
        tree
        terrain={{
          visible: true,
          opacity: 0.8,
          onToggle: onTerrainToggle,
          onOpacity: onTerrainOpacity,
        }}
        sections={[{ id: "geophysics", label: "Geofísica MAG/IP", children: <p>Campañas</p> }]}
      />,
    );

    expect(screen.getByRole("button", { name: /árbol del proyecto/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("heading", { name: "Superficie" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tenencia y territorio" })).toBeInTheDocument();
    expect(screen.getByText("Geofísica MAG/IP")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar topografía DEM Copernicus" }));
    fireEvent.change(
      screen.getByRole("slider", { name: "Opacidad de la topografía DEM Copernicus" }),
      {
        target: { value: "0.5" },
      },
    );
    expect(onTerrainToggle).toHaveBeenCalledOnce();
    expect(onTerrainOpacity).toHaveBeenCalledWith(0.5);
  });
});

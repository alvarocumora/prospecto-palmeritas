import { createFileRoute } from "@tanstack/react-router";
import { GeoScene3D } from "@/components/geoscene";

export const Route = createFileRoute("/_authenticated/dashboard/sat3d")({
  head: () => ({
    meta: [
      { title: "Satélite → Subsuelo 3D — Geocapitals" },
      {
        name: "description",
        content:
          "Visor 3D canónico (GeoScene3D · modo Subsurface): satelital sobre DEM Copernicus con anomalías extruidas, vetas, pórfidos y sondajes.",
      },
    ],
  }),
  component: Sat3DPage,
});

function Sat3DPage() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full">
      <GeoScene3D mode="subsurface" />
    </div>
  );
}

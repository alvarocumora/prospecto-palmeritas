import { createFileRoute } from "@tanstack/react-router";
import { GeoScene3D } from "@/components/geoscene";

export const Route = createFileRoute("/_authenticated/dashboard/geology3d")({
  head: () => ({
    meta: [
      { title: "Geología 3D — Geocapitals" },
      {
        name: "description",
        content:
          "Visor 3D canónico GeoScene3D sobre MapLibre + deck.gl, con capas gobernadas por procedencia para superficie, subsuelo y modelos.",
      },
    ],
  }),
  component: Geology3DPage,
});

function Geology3DPage() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full">
      <GeoScene3D mode="surface" />
    </div>
  );
}

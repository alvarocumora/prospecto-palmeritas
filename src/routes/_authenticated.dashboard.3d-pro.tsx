import { createFileRoute } from "@tanstack/react-router";
import { GeoScene3D } from "@/components/geoscene";

export const Route = createFileRoute("/_authenticated/dashboard/3d-pro")({
  head: () => ({
    meta: [
      { title: "3D Pro · Anomalías magnéticas — Geocapitals" },
      {
        name: "description",
        content:
          "Visor 3D canónico (GeoScene3D · modo Subsurface, preset magnético): anomalías magnéticas extruidas en profundidad.",
      },
    ],
  }),
  component: ThreeDProPage,
});

function ThreeDProPage() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full">
      <GeoScene3D mode="subsurface" variant="mag" />
    </div>
  );
}

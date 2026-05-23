import { createFileRoute } from "@tanstack/react-router";
import { SatToSubsurface3DViewer } from "@/components/geology3d/SatToSubsurface3DViewer";

export const Route = createFileRoute("/_authenticated/dashboard/sat3d")({
  head: () => ({
    meta: [
      { title: "Satélite → Subsuelo 3D — Geocapitals" },
      {
        name: "description",
        content:
          "Visor 3D real: imagen satelital Esri sobre DEM Copernicus, con anomalías satelitales proyectadas como columnas hacia el subsuelo. Funciona con cualquier proyecto activo.",
      },
    ],
  }),
  component: Sat3DPage,
});

function Sat3DPage() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full p-4">
      <div className="mb-3">
        <h1 className="text-xl font-mono text-gold">
          Satélite → Subsuelo 3D
        </h1>
        <p className="text-xs font-mono text-muted-foreground">
          Cubo geo-referenciado con superficie satelital real y anomalías
          satelitales extruidas hacia abajo. Cambia el proyecto activo desde el
          selector superior.
        </p>
      </div>
      <div className="h-[calc(100%-3.5rem)] rounded-lg border border-gold/30 overflow-hidden relative">
        <SatToSubsurface3DViewer />
      </div>
    </div>
  );
}

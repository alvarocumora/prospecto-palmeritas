import { createFileRoute } from "@tanstack/react-router";
import { Geology3DViewer } from "@/components/Geology3DViewer";

export const Route = createFileRoute("/_authenticated/dashboard/geology3d")({
  component: Geology3DPage,
});

function Geology3DPage() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full p-4">
      <div className="mb-3">
        <h1 className="text-xl font-mono text-gold">Geología 3D</h1>
        <p className="text-xs font-mono text-muted-foreground">
          Sondajes, intercepts (Au ≥ 0.1 g/t) y targets del proyecto activo. Arrastra para rotar,
          rueda para zoom.
        </p>
      </div>
      <div className="h-[calc(100%-3.5rem)] rounded-lg border border-gold/30 overflow-hidden">
        <Geology3DViewer className="w-full h-full" />
      </div>
    </div>
  );
}

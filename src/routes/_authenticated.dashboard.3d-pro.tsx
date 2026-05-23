import { createFileRoute } from "@tanstack/react-router";
import { MagAnomaly3DPro } from "@/features/mag3d/MagAnomaly3DPro";

export const Route = createFileRoute("/_authenticated/dashboard/3d-pro")({
  component: ThreeDProPage,
});

function ThreeDProPage() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full">
      <MagAnomaly3DPro />
    </div>
  );
}

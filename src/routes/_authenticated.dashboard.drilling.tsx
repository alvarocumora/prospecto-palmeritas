import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/ModuleStub";

export const Route = createFileRoute("/_authenticated/dashboard/drilling")({
  head: () => ({ meta: [{ title: "Sondajes — Trackmin GeoIntel" }] }),
  component: () => <ModuleStub title="Sondajes" desc="Programa DDH, registro de avance, log de testigos con leyes Au/Cu/Ag, RQD y recovery." />,
});

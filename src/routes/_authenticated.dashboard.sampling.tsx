import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "./_authenticated.dashboard.geophysics";

export const Route = createFileRoute("/_authenticated/dashboard/sampling")({
  head: () => ({ meta: [{ title: "Muestreo — Trackmin GeoIntel" }] }),
  component: () => <ModuleStub title="Muestreo" desc="Captura de muestras superficiales y de canal, leyes y mapas de anomalías." />,
});

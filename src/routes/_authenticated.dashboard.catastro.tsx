import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "./_authenticated.dashboard.geophysics";

export const Route = createFileRoute("/_authenticated/dashboard/catastro")({
  head: () => ({ meta: [{ title: "Catastro — Trackmin GeoIntel" }] }),
  component: () => <ModuleStub title="Catastro" desc="Búsqueda en SERNAGEOMIN, alertas de vencimiento y exportación PDF." />,
});

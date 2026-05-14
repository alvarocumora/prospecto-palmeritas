import { createFileRoute } from "@tanstack/react-router";
import { FrancoDashboard } from "@/features/franco/FrancoDashboard";

export const Route = createFileRoute("/_authenticated/dashboard/franco")({
  head: () => ({
    meta: [
      { title: "Trackmin GeoIntel · Prospecto Franco (TRK-FRC-002)" },
      {
        name: "description",
        content:
          "Dashboard de inteligencia geológica para Prospecto Franco — borrador pre NI 43-101 (datos pendientes de carga).",
      },
    ],
  }),
  component: FrancoDashboard,
});

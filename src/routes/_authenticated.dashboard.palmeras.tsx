import { createFileRoute } from "@tanstack/react-router";
import { TrackminGeoIntel } from "@/features/palmeras/TrackminDashboard";

export const Route = createFileRoute("/_authenticated/dashboard/palmeras")({
  head: () => ({
    meta: [
      { title: "Trackmin GeoIntel · Prospecto Palmeras (TRK-ALH-001)" },
      {
        name: "description",
        content:
          "Dashboard de inteligencia geológica para Prospecto Palmeras, Alhué — exploración Au–Cu epitermal–mesotermal. Operado por Inversiones Bioenergy SpA.",
      },
    ],
  }),
  component: TrackminGeoIntel,
});

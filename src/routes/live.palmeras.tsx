import { createFileRoute } from "@tanstack/react-router";
import { DemoLiveBanner } from "@/features/marketing/DemoLiveBanner";
import { TrackminGeoIntel } from "@/features/palmeras/TrackminDashboard";

export const Route = createFileRoute("/live/palmeras")({
  head: () => ({
    meta: [
      { title: "Demo · Prospecto Palmeras — Geocapitals" },
      {
        name: "description",
        content:
          "Live map público del Prospecto Palmeras (Alhué): mapa operacional, malla de sondaje y tablero de inteligencia geológica.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LiveMapPalmerasPage,
});

function LiveMapPalmerasPage() {
  return (
    <div>
      <DemoLiveBanner />
      <TrackminGeoIntel />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { TrackminGeoIntel } from "@/features/palmeras/TrackminDashboard";

export const Route = createFileRoute("/live/palmeras")({
  head: () => ({
    meta: [
      { title: "Live Map · Prospecto Palmeras — Geocapitals" },
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
      <LiveBanner />
      <TrackminGeoIntel />
    </div>
  );
}

function LiveBanner() {
  return (
    <div className="bg-gold/10 border-b border-gold/30 px-6 py-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-gold">
      <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
      Live Map · Acceso público · Confidencial
    </div>
  );
}

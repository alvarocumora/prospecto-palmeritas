import { createFileRoute } from "@tanstack/react-router";
import { FrancoDashboard } from "@/features/franco/FrancoDashboard";

export const Route = createFileRoute("/live/franco")({
  head: () => ({
    meta: [
      { title: "Live Map · Prospecto Franco — Geocapitals" },
      {
        name: "description",
        content:
          "Live map público del Prospecto Franco: borrador pre NI 43-101 y tablero de inteligencia geológica.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LiveMapFrancoPage,
});

function LiveMapFrancoPage() {
  return (
    <div>
      <LiveBanner />
      <FrancoDashboard />
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

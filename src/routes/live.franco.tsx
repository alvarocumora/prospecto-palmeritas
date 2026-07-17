import { createFileRoute } from "@tanstack/react-router";
import { DemoLiveBanner } from "@/features/marketing/DemoLiveBanner";
import { FrancoDashboard } from "@/features/franco/FrancoDashboard";

export const Route = createFileRoute("/live/franco")({
  head: () => ({
    meta: [
      { title: "Demo · Live Map · Prospecto Franco — Geocapitals" },
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
      <DemoLiveBanner />
      <FrancoDashboard />
    </div>
  );
}

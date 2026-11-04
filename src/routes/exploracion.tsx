import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { MarketingPage } from "@/features/marketing/MarketingShell";

const ExplorationAtlas = lazy(() =>
  import("@/features/exploration/ExplorationAtlas").then((m) => ({
    default: m.ExplorationAtlas,
  })),
);

export const Route = createFileRoute("/exploracion")({
  head: () => ({
    meta: [
      { title: "Exploration Atlas — GeoCapitals" },
      {
        name: "description",
        content:
          "Explora Cholqui y Los Verdes en un mapa de Chile con geología, capas satelitales y visores 2D/3D.",
      },
    ],
  }),
  component: ExplorationPage,
});

function ExplorationPage() {
  return (
    <MarketingPage
      eyebrow="GeoCapitals / Exploration Atlas"
      title="Explora el territorio. Descubre su potencial."
      intro="Una puerta de entrada a los proyectos mineros con cartografía georreferenciada, evidencia técnica y análisis geoespacial."
    >
      <Suspense
        fallback={
          <div role="status" className="py-16 text-sm text-content-subtle">
            Preparando atlas de exploración…
          </div>
        }
      >
        <ExplorationAtlas />
      </Suspense>
    </MarketingPage>
  );
}

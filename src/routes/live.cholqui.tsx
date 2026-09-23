import { createFileRoute } from "@tanstack/react-router";
import { CholquiDashboard } from "@/features/franco/FrancoDashboard";

export const Route = createFileRoute("/live/cholqui")({
  head: () => ({
    meta: [
      { title: "Proyecto Cholqui · Live Map e informe de inversión — Geocapitals" },
      {
        name: "description",
        content:
          "Ficha pública estandarizada del Proyecto Cholqui con mapa interactivo, siete análisis puntuales, tres informes de laboratorio y escenarios preliminares.",
      },
      { property: "og:title", content: "Proyecto Cholqui · Live Map — Geocapitals" },
      {
        property: "og:description",
        content: "Mapa, evidencia química trazable e informe de inversión descargable del Proyecto Cholqui.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CholquiPublicPage,
});

function CholquiPublicPage() {
  return <CholquiDashboard />;
}
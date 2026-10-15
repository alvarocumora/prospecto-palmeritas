import { createFileRoute } from "@tanstack/react-router";
import { MarketingLanding } from "@/features/marketing/MarketingLanding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Geocapitals · Inversión minera con colateral y catastro profesional",
      },
      {
        name: "description",
        content:
          "Marketplace de proyectos mineros con catastro georreferenciado y lotes de commodities verificados (Cu, Au, Ag, Li).",
      },
      {
        property: "og:title",
        content: "Geocapitals · Proyectos mineros, catastro y commodities",
      },
      {
        property: "og:description",
        content:
          "Proyectos mineros, mapa live de concesiones y lotes de commodities verificados en una sola plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketingLanding,
});

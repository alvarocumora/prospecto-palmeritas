import { createFileRoute } from "@tanstack/react-router";
import { MarketingLanding } from "@/features/marketing/MarketingLanding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Geocapitals · Plataforma de inversión en proyectos mineros" },
      {
        name: "description",
        content:
          "Conectamos proyectos mineros con capital. Plataforma inteligente de inversión y financiamiento para minería en Latinoamérica.",
      },
      { property: "og:title", content: "Geocapitals · Conectamos proyectos mineros con capital" },
      {
        property: "og:description",
        content: "Plataforma inteligente de inversión y financiamiento para minería.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: MarketingLanding,
});

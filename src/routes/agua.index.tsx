import { createFileRoute } from "@tanstack/react-router";
import { WaterAssetsPage } from "@/features/water/WaterAssetsPage";

export const Route = createFileRoute("/agua/")({
  head: () => ({
    meta: [
      { title: "Water Assets Intelligence — Geocapitals Live Map" },
      {
        name: "description",
        content:
          "Live map de derechos de aprovechamiento de aguas en la Provincia de Osorno: 4.500 L/s permanentes, fichas legales, valorización referencial y data room de inversión.",
      },
      { property: "og:title", content: "Water Assets Intelligence — Geocapitals" },
      {
        property: "og:description",
        content:
          "Explore, analyze and evaluate strategic water rights through geospatial intelligence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <WaterAssetsPage mode="public" />,
});

import { createFileRoute } from "@tanstack/react-router";
import { WaterAssetsPage } from "@/features/water/WaterAssetsPage";

export const Route = createFileRoute("/_authenticated/dashboard/agua")({
  head: () => ({
    meta: [
      { title: "Water Assets Data Room — Geocapitals" },
      {
        name: "description",
        content:
          "Data room de derechos de agua: coordenadas precisas, ficha jurídica, documentación y valorización referencial por activo.",
      },
      { property: "og:title", content: "Water Assets Data Room — Geocapitals" },
      {
        property: "og:description",
        content: "Due diligence de activos hídricos georreferenciados en Chile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <WaterAssetsPage mode="investor" />,
});

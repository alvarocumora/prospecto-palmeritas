import { createFileRoute } from "@tanstack/react-router";
import { FieldMap } from "@/components/field/FieldMap";

export const Route = createFileRoute("/_authenticated/dashboard/field-map")({
  head: () => ({
    meta: [
      { title: "Mapa de campo — Geocapitals" },
      {
        name: "description",
        content:
          "Mapa móvil para terreno: pertenencias mineras vigentes, GPS en tiempo real y captura de puntos de interés con nota y foto.",
      },
    ],
  }),
  component: FieldMapPage,
});

function FieldMapPage() {
  return <FieldMap />;
}

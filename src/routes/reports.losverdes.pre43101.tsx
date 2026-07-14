import { createFileRoute } from "@tanstack/react-router";
import { Pre43101Shell } from "@/features/reports/pre43101/components/Pre43101Shell";

// Alto Los Verdes 5 (Tilama) — proyecto LV-TIL-001
const LOS_VERDES_PROJECT_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";

export const Route = createFileRoute("/reports/losverdes/pre43101")({
  head: () => ({
    meta: [
      { title: "Informe Pre-NI 43-101 — Alto Los Verdes 5 | Geocapitals" },
      {
        name: "description",
        content:
          "Informe técnico preliminar Pre-NI 43-101 / JORC del proyecto Alto Los Verdes 5 (Tilama): catastro, geología, anomalías 3D, geofísica, targets y visor 3D tipo Datamine.",
      },
    ],
  }),
  component: Pre43101Page,
});

function Pre43101Page() {
  return <Pre43101Shell projectId={LOS_VERDES_PROJECT_ID} />;
}

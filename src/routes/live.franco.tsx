import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/live/franco")({
  beforeLoad: () => {
    throw redirect({ to: "/live/cholqui", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Demo · Live Map · Proyecto Cholqui — Geocapitals" },
      {
        name: "description",
        content:
          "Live map público del Proyecto Cholqui (Cu-Au-Ag, Melipilla): borrador pre NI 43-101 y tablero de inteligencia geológica.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => null,
});

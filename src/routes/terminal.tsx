import { createFileRoute } from "@tanstack/react-router";
import { TerminalShell } from "@/features/terminal/TerminalShell";

export const Route = createFileRoute("/terminal")({
  head: () => ({
    meta: [
      { title: "Geocapitals Terminal · Mining Investment Desk" },
      {
        name: "description",
        content:
          "Terminal de inversión minera: mercado de commodities, portafolio de proyectos, catastro y tokenización en una sola pantalla.",
      },
      { property: "og:title", content: "Geocapitals Terminal" },
      {
        property: "og:description",
        content: "Bloomberg-style terminal para activos mineros chilenos.",
      },
    ],
  }),
  component: TerminalShell,
});

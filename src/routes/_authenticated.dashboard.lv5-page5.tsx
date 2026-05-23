import { createFileRoute } from "@tanstack/react-router";
import { Lv5Page5Preview } from "@/features/lv5/Lv5Page5Preview";

export const Route = createFileRoute("/_authenticated/dashboard/lv5-page5")({
  head: () => ({
    meta: [
      { title: "Los Verdes 5 · Página 5 interactiva — Geocapitals" },
      {
        name: "description",
        content:
          "Vista interactiva del esquema geológico Illapel sobre capa satelital, equivalente a la página 5 del informe Pre-NI 43-101 v3.1.",
      },
    ],
  }),
  component: Lv5Page5Page,
});

function Lv5Page5Page() {
  return (
    <div className="h-[calc(100vh-4rem)] w-full p-4 flex flex-col">
      <header className="mb-3">
        <h1 className="text-xl font-mono text-gold">
          Los Verdes 5 · Página 5 interactiva
        </h1>
        <p className="text-xs font-mono text-muted-foreground">
          Esquema litoestratigráfico Hoja Illapel 1:250.000 sobre ESRI World Imagery,
          con lineamientos NW-SE y targets principales del informe v3.1.
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <Lv5Page5Preview />
      </div>
    </div>
  );
}

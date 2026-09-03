import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { FrancoDashboard } from "@/features/franco/FrancoDashboard";
import { CholquiSatellitePanel } from "@/features/franco/components/CholquiSatellitePanel";
import { CholquiSpvPanel } from "@/features/franco/components/CholquiSpvPanel";

const TABS = [
  ["ficha", "Ficha & escenarios"],
  ["satelite", "Satélite"],
  ["spv", "Inversionistas & SPV"],
] as const;


export const Route = createFileRoute("/_authenticated/dashboard/cholqui")({
  head: () => ({
    meta: [
      { title: "Cholqui live · Mapa, muestreo y escenarios — Geocapitals" },
      {
        name: "description",
        content:
          "Vista en vivo del Proyecto Cholqui: mapa interactivo de pertenencias, puntos de muestreo y escenarios de ley de cobre para reuniones con inversionistas.",
      },
      { property: "og:title", content: "Cholqui live · Mapa, muestreo y escenarios" },
      {
        property: "og:description",
        content:
          "Mapa interactivo, puntos de muestreo certificados y escenarios de ley del Proyecto Cholqui.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CholquiLivePage,
});

function CholquiLivePage() {
  return (
    <div data-theme="im-light" className="bg-surface text-content">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 pt-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-xl">Cholqui · vista en vivo</h1>
          <p className="text-[12px] text-content-subtle">
            Mapa interactivo, puntos de muestreo y escenarios de ley — misma fuente que el PDF de
            inversión.
          </p>
        </div>
        <a
          href="/live/franco"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-[12px] border border-hairline rounded-lg px-3 py-2 hover:bg-surface-2"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Abrir enlace público para inversionistas
        </a>
      </div>
      <FrancoDashboard />
    </div>
  );
}

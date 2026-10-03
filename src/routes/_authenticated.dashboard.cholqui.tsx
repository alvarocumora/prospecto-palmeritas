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
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("ficha");
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
          href="/terminal/cholqui"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-[12px] border border-hairline rounded-lg px-3 py-2 hover:bg-surface-2"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Abrir enlace público para inversionistas
        </a>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-6 pt-4 flex gap-2 flex-wrap">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-full text-sm border transition-colors ${
              tab === key
                ? "bg-accent-brand text-accent-brand-contrast border-transparent"
                : "border-hairline text-content-muted hover:border-accent-brand"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "ficha" && <FrancoDashboard authenticated />}
      {tab !== "ficha" && (
        <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
          {tab === "satelite" ? <CholquiSatellitePanel /> : <CholquiSpvPanel />}
        </main>
      )}
    </div>
  );
}

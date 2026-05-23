import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

import { FieldMapPublic } from "@/components/field/FieldMapPublic";

export const Route = createFileRoute("/live/losverdes")({
  head: () => ({
    meta: [
      { title: "Live Field · Distrito Los Verdes — Geocapitals" },
      {
        name: "description",
        content:
          "Live field map del Distrito Cuprífero Los Verdes – Tilama. GPS en tiempo real, revisión de targets y captura de notas de campo.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#0b0a09" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
    links: [{ rel: "manifest", href: "/manifest.losverdes.json" }],
  }),
  component: LiveLosVerdesPage,
});

function LiveLosVerdesPage() {
  return (
    <div className="bg-bg-app min-h-screen">
      <div className="bg-gold/10 border-b border-gold/30 px-4 py-2 flex items-center gap-2 h-10">
        <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
        <MapPin className="w-3 h-3 text-gold" />
        <div className="font-mono text-[11px] uppercase tracking-wider text-gold">
          Live Field · Los Verdes · Tilama
        </div>
      </div>
      <FieldMapPublic />
    </div>
  );
}

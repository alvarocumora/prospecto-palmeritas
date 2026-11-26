import { createFileRoute } from "@tanstack/react-router";
import { LegalServicePage } from "@/features/marketing/LegalServicePage";
import type { LegalServiceType } from "@/lib/cadastre/legalRequest";

const SERVICE_IDS: LegalServiceType[] = ["pedimento", "manifestacion", "due-diligence"];

export const Route = createFileRoute("/servicios/legal-minero")({
  validateSearch: (search: Record<string, unknown>): { servicio?: LegalServiceType } => {
    const value = search.servicio;
    return SERVICE_IDS.includes(value as LegalServiceType)
      ? { servicio: value as LegalServiceType }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Legal Minero y tramitación de concesiones — Geocapitals" },
      {
        name: "description",
        content:
          "Diseña y cotiza pedimentos, manifestaciones y due diligence minera con revisión catastral, antecedentes trazables y tramitación legal en Chile.",
      },
      { property: "og:title", content: "Legal Minero y tramitación de concesiones — Geocapitals" },
      {
        property: "og:description",
        content:
          "Configura el alcance de tu pedimento, manifestación o revisión legal y envía los antecedentes al equipo Geocapitals.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://geocapitals.com/servicios/legal-minero" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Legal Minero — Geocapitals" },
      {
        name: "twitter:description",
        content: "Del diseño catastral a la tramitación legal, con alcance y antecedentes claros.",
      },
    ],
    links: [{ rel: "canonical", href: "https://geocapitals.com/servicios/legal-minero" }],
  }),
  component: LegalMineroRoute,
});

function LegalMineroRoute() {
  const { servicio } = Route.useSearch();
  return <LegalServicePage initialService={servicio ?? "pedimento"} />;
}

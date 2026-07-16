import { createFileRoute } from "@tanstack/react-router";
import { Globe2 } from "lucide-react";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { GlobalCadastreSearch } from "@/features/catastro-public/GlobalCadastreSearch";

export const Route = createFileRoute("/catastro/global")({
  head: () => ({
    meta: [
      { title: "Catastro minero multi-país · Chile, Perú y Brasil — Geocapitals" },
      {
        name: "description",
        content:
          "Busca concesiones mineras de Chile (SERNAGEOMIN), Perú (INGEMMET) y Brasil (ANM SIGMINE) en un solo lugar. Titulares, estados y hectáreas desde las fuentes oficiales, en vivo.",
      },
      { property: "og:title", content: "Catastro minero multi-país — Geocapitals" },
      {
        property: "og:description",
        content: "Un solo buscador para los catastros mineros oficiales de LatAm.",
      },
    ],
  }),
  component: GlobalCadastrePage,
});

function GlobalCadastrePage() {
  return (
    <PublicCatastroShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            <Globe2 className="w-3.5 h-3.5" /> Capa Catastral Universal
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Un buscador. Todos los catastros.
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            Concesiones mineras de Chile, Perú y Brasil consultadas en vivo desde las fuentes
            oficiales. Argentina y África, próximamente.
          </p>
        </div>

        <GlobalCadastreSearch />

        <p className="mt-8 text-center text-[10px] font-mono text-muted-foreground max-w-lg mx-auto">
          Datos públicos oficiales consultados en vivo: SERNAGEOMIN (Chile), INGEMMET GEOCATMIN
          (Perú, ~65.000 derechos) y ANM SIGMINE (Brasil, procesos minerarios activos). Geocapitals
          normaliza los esquemas de cada país a una vista única.
        </p>
      </div>
    </PublicCatastroShell>
  );
}

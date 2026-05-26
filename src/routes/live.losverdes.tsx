import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

import { FieldMapPublic } from "@/components/field/FieldMapPublic";
import { LosVerdesScene3D } from "@/components/live/LosVerdesScene3D";
import {
  getLosVerdesPublicLayers,
  getLosVerdesAnomalies,
} from "@/lib/livemap-public.functions";

export const Route = createFileRoute("/live/losverdes")({
  head: () => ({
    meta: [
      { title: "Live Field · Distrito Los Verdes — Geocapitals" },
      {
        name: "description",
        content:
          "Live field map del Distrito Cuprífero Los Verdes – Tilama. Visor 3D con DEM real, anomalías satelitales extruidas, lineamientos estructurales y targets de exploración.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#0b0a09" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
    links: [{ rel: "manifest", href: "/manifest.losverdes.json" }],
  }),
  component: LiveLosVerdesPage,
});

const DEFAULT_CENTER = { lat: -31.95, lng: -71.18 }; // Tilama / Los Verdes

function LiveLosVerdesPage() {
  const fetchLayers = useServerFn(getLosVerdesPublicLayers);
  const fetchAnoms = useServerFn(getLosVerdesAnomalies);

  const layersQ = useQuery({
    queryKey: ["losverdes", "public-layers"],
    queryFn: () => fetchLayers(),
    staleTime: 5 * 60_000,
  });
  const anomsQ = useQuery({
    queryKey: ["losverdes", "anomalies"],
    queryFn: () => fetchAnoms(),
    staleTime: 5 * 60_000,
  });

  const centerLat = layersQ.data?.project.center_lat ?? DEFAULT_CENTER.lat;
  const centerLng = layersQ.data?.project.center_lng ?? DEFAULT_CENTER.lng;

  return (
    <div className="bg-bg-app min-h-screen">
      <div className="bg-gold/10 border-b border-gold/30 px-4 py-2 flex items-center gap-2 h-10">
        <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
        <MapPin className="w-3 h-3 text-gold" />
        <div className="font-mono text-[11px] uppercase tracking-wider text-gold">
          Live Field · Los Verdes · Tilama
        </div>
      </div>

      <div className="p-3 md:p-4 space-y-4">
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-gold">
              Visor 3D · Esri Imagery + DEM + Anomalías extruidas
            </h2>
            {(layersQ.isLoading || anomsQ.isLoading) && (
              <span className="font-mono text-[10px] text-muted-foreground">
                cargando datos…
              </span>
            )}
          </div>
          {anomsQ.data && layersQ.data ? (
            <LosVerdesScene3D
              centerLat={centerLat}
              centerLng={centerLng}
              satAnomalies={anomsQ.data.satAnomalies}
              magTargets={anomsQ.data.magTargets}
              lineaments={anomsQ.data.lineaments}
              targets={layersQ.data.targets}
            />
          ) : (
            <div className="w-full h-[640px] rounded-lg border border-border bg-bg-secondary flex items-center justify-center font-mono text-[11px] text-muted-foreground">
              Cargando escena 3D…
            </div>
          )}
        </section>

        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-gold mb-2">
            Mapa de campo · GPS + Catastro + Capas
          </h2>
          <FieldMapPublic />
        </section>
      </div>
    </div>
  );
}

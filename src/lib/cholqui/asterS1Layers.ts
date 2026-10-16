import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { geoColors } from "@/lib/geospatial/visualTokens";
import type { EmitLayer } from "./emitMineralogy";

/**
 * Capas generadas por scripts/process_aster_s1.py: índice de cuarzo ASTER TIR (MODELADO)
 * y lineamientos candidatos Sentinel-1 RTC (INTERPRETADO). Carga diferida.
 */
type Meta = FeatureCollection & { metadata: Record<string, unknown> };

export function useAsterS1Layers(): EmitLayer[] {
  const [layers, setLayers] = useState<EmitLayer[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("@/data/geo/cholqui_aster_silice.json?raw"),
      import("@/data/geo/cholqui_s1_lineamientos.json?raw"),
    ])
      .then(([a, s]) => {
        if (cancelled) return;
        const aster = JSON.parse(a.default) as Meta;
        const s1 = JSON.parse(s.default) as Meta;
        const d = String(aster.metadata.adquisicion);
        const scenes = (s1.metadata.escenas as Array<{ fecha: string; orbita: string }>)
          .map((x) => `${x.fecha} ${x.orbita === "ascending" ? "asc." : "desc."}`)
          .join(" y ");
        setLayers([
          {
            id: "aster-silice",
            label: "ASTER térmico · zonas ricas en sílice (10 % superior)",
            evidence: "MODELADO",
            caution: `NASA ASTER L1T (${d.slice(2, 4)}-${d.slice(0, 2)}-${d.slice(4, 8)}), píxel 90 m. Índice de cuarzo de Ninomiya; afectado por humedad, vegetación y emisividad. No es ensaye ni medición de sílice.`,
            features: aster,
            color: geoColors.deposit,
            defaultVisible: true,
          },
          {
            id: "s1-lineamientos",
            label: "Radar Sentinel-1 · lineamientos candidatos (≥300 m)",
            evidence: "INTERPRETADO",
            caution: `Copernicus Sentinel-1 RTC (${scenes}). Bordes detectados automáticamente; pueden ser fallas, quebradas, caminos o cambios de pendiente. Requiere validación estructural en terreno.`,
            features: s1,
            color: geoColors.signal,
            defaultVisible: true,
          },
        ]);
      })
      .catch(() => !cancelled && setLayers([]));
    return () => {
      cancelled = true;
    };
  }, []);
  return layers;
}

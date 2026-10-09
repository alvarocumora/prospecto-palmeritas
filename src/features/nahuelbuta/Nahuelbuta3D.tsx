import type { FeatureCollection } from "geojson";
import { ProjectTerrain3D } from "@/components/geo/ProjectTerrain3D";
import panosRaw from "@/data/geo/losalamos_panos_arcillas.geojson?raw";
import catastroRaw from "@/data/geo/losalamos_catastro_sngm.geojson?raw";
import { NAHUELBUTA } from "./data/nahuelbuta";

const parse = (raw: string): FeatureCollection | null => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** Paños solicitados (tenencia declarada en trámite) + catastro vecino sobre relieve real. */
export function Nahuelbuta3D() {
  const panos = parse(panosRaw);
  const catastro = parse(catastroRaw);
  const concessions: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      ...(catastro?.features ?? []),
      ...(panos?.features ?? []).map((f) => ({
        ...f,
        properties: { ...(f.properties ?? {}), es_tenencia_proyecto: true },
      })),
    ],
  };
  return (
    <ProjectTerrain3D
      slug="nahuelbuta"
      center={NAHUELBUTA.center}
      extentMeters={20000}
      concessions={concessions}
    />
  );
}

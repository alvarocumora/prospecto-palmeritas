import type { FeatureCollection } from "geojson";
import panosRaw from "@/data/geo/losalamos_panos_arcillas.geojson?raw";
import nuevosRaw from "@/data/geo/losalamos_panos_arcillas_nuevos.geojson?raw";
import pedimentosRaw from "@/data/geo/losalamos_pedimentos_nuevos.geojson?raw";
import catastroRaw from "@/data/geo/losalamos_catastro_sngm.geojson?raw";
import franjasRaw from "@/data/geo/losalamos_franjas.geojson?raw";
import lineamientosRaw from "@/data/geo/losalamos_lineamientos.geojson?raw";
import { ProjectSceneFrame } from "../UnifiedProjectScene";
import type { ProjectView } from "@/lib/projects/navigation";
import type { GeoSceneProjectLayer } from "@/components/geoscene/projectLayers";
const parse = (raw: string) => JSON.parse(raw) as FeatureCollection;
const layers: GeoSceneProjectLayer[] = [
  {
    id: "territory.cadastre",
    data: parse(catastroRaw),
    source: "SERNAGEOMIN · catastro vecino oficial",
  },
  {
    id: "territory.proposed_pedimentos",
    data: parse(panosRaw),
    source: "Paños Arcillas 1–34 · solicitud, no tenencia concedida",
  },
  {
    id: "territory.pending_pedimentos",
    data: {
      type: "FeatureCollection",
      features: [...parse(nuevosRaw).features, ...parse(pedimentosRaw).features],
    },
    source: "Ampliación declarada 35–56 y pedimentos; no mensura oficial",
  },
  { id: "geology.metallogenic_belts", data: parse(franjasRaw) },
  {
    id: "remote_sensing.lineaments",
    data: parse(lineamientosRaw),
    defaultVisible: false,
    source:
      "Copernicus DEM GLO-30 · Canny/Hough (2026-10-27); lineamientos INTERPRETADOS, no fallas verificadas",
  },
];
export function NahuelbutaScene({ view }: { view: ProjectView }) {
  return (
    <ProjectSceneFrame
      project={{ id: "nahuelbuta", name: "Nahuelbuta", center: [-73.2, -37.64] }}
      layers={layers}
      view={view}
    />
  );
}

import type { FeatureCollection } from "geojson";
import { ProjectMasterViewer } from "@/components/geo/ProjectMasterViewer";
import panosRaw from "@/data/geo/losalamos_panos_arcillas.geojson?raw";
import panosNuevosRaw from "@/data/geo/losalamos_panos_arcillas_nuevos.geojson?raw";
import pedimentosRaw from "@/data/geo/losalamos_pedimentos_nuevos.geojson?raw";
import catastroRaw from "@/data/geo/losalamos_catastro_sngm.geojson?raw";
import franjasRaw from "@/data/geo/losalamos_franjas.geojson?raw";
import { NAHUELBUTA } from "./data/nahuelbuta";

function parse(raw: string): FeatureCollection | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const panos = parse(panosRaw);
const panosNuevos = parse(panosNuevosRaw);
const pedimentos = parse(pedimentosRaw);
const catastro = parse(catastroRaw);
const franjas = parse(franjasRaw);

/** Visor maestro: paños Arcillas 1-34 (solicitud) + ampliación 35-56 + catastro vecino oficial. */
export function NahuelbutaMasterViewer() {
  return (
    <ProjectMasterViewer
      projectName={NAHUELBUTA.name}
      reportMapId="nahuelbuta"
      center={NAHUELBUTA.center}
      concessions={catastro}
      pedimentos={panos}
      pedimentosPendientes={
        panosNuevos && pedimentos
          ? {
              type: "FeatureCollection",
              features: [...pedimentos.features, ...panosNuevos.features],
            }
          : panosNuevos
      }
      franjas={franjas}
    />
  );
}

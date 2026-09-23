import type { FeatureCollection, Point } from "geojson";

export type RemoteEvidenceStatus = "DERIVED" | "INTERPRETED";

export type CholquiRemoteCandidateProperties = {
  rank: number;
  aloh_zscore: number;
  aloh_percentile: number;
  fe_oxides?: number | null;
  ferrous?: number | null;
  aloh?: number | null;
  gossan?: number | null;
  kind: "sampling_candidate";
  legend: string;
};

export type CholquiRemoteCandidateCollection = FeatureCollection<Point, CholquiRemoteCandidateProperties>;

export type RemoteSensingIndex = {
  key: "fe_oxides" | "ferrous" | "aloh" | "gossan";
  formula: string;
  sensor: "Sentinel-2 L2A";
  claim: string;
  status: RemoteEvidenceStatus;
};

export const CHOLQUI_REMOTE_INDICES: RemoteSensingIndex[] = [
  { key: "fe_oxides", formula: "B04/B02", sensor: "Sentinel-2 L2A", claim: "Realce relativo de óxidos de hierro (razón VIS).", status: "DERIVED" },
  { key: "ferrous", formula: "B11/B8A", sensor: "Sentinel-2 L2A", claim: "Realce relativo de hierro ferroso (razón NIR/SWIR).", status: "DERIVED" },
  { key: "aloh", formula: "B11/B12", sensor: "Sentinel-2 L2A", claim: "Anomalía de absorción SWIR compatible con minerales de Al-OH; no identifica mineral.", status: "DERIVED" },
  { key: "gossan", formula: "(B04/B02)*(B11/B12)", sensor: "Sentinel-2 L2A", claim: "Realce combinado hierro + Al-OH; indicio espectral, no diagnóstico.", status: "DERIVED" },
];

export const CHOLQUI_REMOTE_DISCLAIMER =
  "Sentinel-2 usa bandas anchas: los índices son evidencia espectral derivada, no identificación mineral, recurso, reserva ni depósito. Todo candidato requiere verificación de terreno.";

export function candidateStyle(z: number) {
  if (z >= 4) return { color: "#ef4444", radius: 10 };
  if (z >= 3) return { color: "#f59e0b", radius: 8 };
  return { color: "#eab308", radius: 7 };
}

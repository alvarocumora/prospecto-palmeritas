// Esquema sintético Hoja Illapel 1:250.000 — sector Tilama / Los Verdes 5.
// Equivalente a la carta SERNAGEOMIN renderizada en la página 5 del informe v3.1.
// CRS: WGS84 (lon, lat). Polígonos estilizados a partir del mapa publicado.

import type { FeatureCollection, Polygon, LineString } from "geojson";

export type IllapelUnitProps = {
  code: string; // Ki, Kac, Kig, Q
  name: string;
  age: string;
  lithology: string;
  color: string;
};

export const ILLAPEL_CENTER: [number, number] = [-32.095, -71.115]; // lat, lng (Tilama)

export const ILLAPEL_LEGEND: IllapelUnitProps[] = [
  {
    code: "Ki",
    name: "Fm. Lo Prado",
    age: "Cretácico Inferior",
    lithology: "Lavas andesíticas, tobas y calizas",
    color: "#4a7c2e",
  },
  {
    code: "Kac",
    name: "Fm. Las Chilcas",
    age: "Cretácico medio",
    lithology: "Volcanoclásticas y conglomerados",
    color: "#c97a3e",
  },
  {
    code: "Kig",
    name: "Intrusivos Cretácicos",
    age: "Cretácico Sup.",
    lithology: "Granodiorita / monzodiorita",
    color: "#b04a6a",
  },
  {
    code: "Q",
    name: "Cuaternario",
    age: "Pleistoceno–Holoceno",
    lithology: "Aluvial / coluvial",
    color: "#e8d77a",
  },
];

export const ILLAPEL_GEOLOGY: FeatureCollection<Polygon, IllapelUnitProps> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: ILLAPEL_LEGEND[0],
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-71.18, -32.13],
            [-71.10, -32.14],
            [-71.06, -32.10],
            [-71.08, -32.05],
            [-71.14, -32.04],
            [-71.18, -32.08],
            [-71.18, -32.13],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: ILLAPEL_LEGEND[1],
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-71.06, -32.10],
            [-71.00, -32.12],
            [-70.96, -32.08],
            [-70.98, -32.04],
            [-71.04, -32.03],
            [-71.08, -32.05],
            [-71.06, -32.10],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: ILLAPEL_LEGEND[2],
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-71.14, -32.04],
            [-71.08, -32.05],
            [-71.04, -32.03],
            [-71.05, -31.99],
            [-71.11, -31.98],
            [-71.15, -32.00],
            [-71.14, -32.04],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: ILLAPEL_LEGEND[3],
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-71.18, -32.13],
            [-71.18, -32.16],
            [-71.10, -32.17],
            [-71.04, -32.15],
            [-71.00, -32.12],
            [-71.06, -32.10],
            [-71.10, -32.14],
            [-71.18, -32.13],
          ],
        ],
      },
    },
  ],
};

// Lineamientos estructurales NW-SE (sistema Atacama-Vicuña local).
export const ILLAPEL_STRUCTURES: FeatureCollection<LineString, { name: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Lineamiento NW-1 (Falla Castellana)" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-71.17, -32.02],
          [-71.05, -32.14],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Lineamiento NW-2 (Falla La Guanaca)" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-71.14, -31.99],
          [-71.02, -32.11],
        ],
      },
    },
  ],
};

// Targets / vetas principales (espejo de la página 5 del informe).
export const LV5_TARGETS: FeatureCollection<Polygon, { name: string; rank: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "V-Castellana", rank: "A" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-71.115, -32.090],
            [-71.108, -32.095],
            [-71.101, -32.090],
            [-71.108, -32.085],
            [-71.115, -32.090],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "V-La Guanaca", rank: "A" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-71.085, -32.075],
            [-71.078, -32.080],
            [-71.071, -32.075],
            [-71.078, -32.070],
            [-71.085, -32.075],
          ],
        ],
      },
    },
  ],
};

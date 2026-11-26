import { describe, expect, it } from "vitest";
import type { PedimentoResult } from "@/lib/pedimentoGeometry";
import {
  computeEffectiveAreaHa,
  formatLegalTramiteMessage,
  validateLegalContact,
} from "./legalRequest";

const SAMPLE_PED: PedimentoResult = {
  rectangleWgs84: {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-71.05, -31.5],
          [-71.04, -31.5],
          [-71.04, -31.53],
          [-71.05, -31.53],
          [-71.05, -31.5],
        ],
      ],
    },
  },
  huso: 19,
  datum: "WGS84",
  cornersUtm: {
    NW: [305000, 6512000],
    NE: [306000, 6512000],
    SE: [306000, 6509000],
    SW: [305000, 6509000],
  },
  cornersWgs84: {
    NW: [-71.05, -31.5],
    NE: [-71.04, -31.5],
    SE: [-71.04, -31.53],
    SW: [-71.05, -31.53],
  },
  caraNorteUtm: { N: 6512000, E_centro: 305500 },
  ladosM: { "N-S": 3000, "E-W": 1000 },
  areaHa: 300,
  concessionsChecked: 42,
};

describe("legalRequest", () => {
  it("valida nombre obligatorio y formato de correo", () => {
    expect(validateLegalContact({ name: "", email: "a@b.cl" })).not.toBeNull();
    expect(validateLegalContact({ name: "María Soto", email: "correo-invalido" })).not.toBeNull();
    expect(validateLegalContact({ name: "María Soto", email: "maria@minera.cl" })).toBeNull();
  });

  it("calcula superficie efectiva sumando pertenencias en manifestación", () => {
    const pertenencias = [
      { w: 305000, e: 305500, s: 6509000, n: 6509200 }, // 10 ha
      { w: 305500, e: 306000, s: 6509000, n: 6509200 }, // 10 ha
    ];
    expect(computeEffectiveAreaHa("pedimento", SAMPLE_PED, pertenencias)).toBe(300);
    expect(computeEffectiveAreaHa("manifestacion", SAMPLE_PED, pertenencias)).toBe(20);
  });

  it("serializa vértices UTM, datum, tribunal y notas para tramitación desde catastro", () => {
    const msg = formatLegalTramiteMessage(
      "pedimento",
      { name: "Álvaro", email: "alvaro@valle.cl", phone: "+56 9 1234 5678", notes: "Urgente esta semana" },
      {
        kind: "pedimento",
        ped: SAMPLE_PED,
        datos: { concesion: "LEONOR CERRO ALTO 1", comuna: "Illapel", tribunal: "Juzgado de Letras de Illapel" },
        pertenencias: [],
      },
    );
    expect(msg).toContain("LEONOR CERRO ALTO 1");
    expect(msg).toContain("Juzgado de Letras de Illapel");
    expect(msg).toContain("WGS84 · Huso 19S");
    expect(msg).toContain("300 ha");
    expect(msg).toContain("V1 (NW):");
    expect(msg).toContain("Urgente esta semana");
    expect(msg.length).toBeLessThanOrEqual(3950);
  });
});
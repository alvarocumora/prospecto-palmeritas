import { describe, expect, it } from "vitest";
import { buildPublicGeoManifest } from "./publicGeoContract";
import { buildLosVerdesPublicGeoBundle } from "./losVerdesPublicGeoAdapter";
import type { LosVerdesMapData } from "@/lib/losverdes-map.functions";
import type { LosVerdesMining } from "@/lib/losverdes-veins.functions";
import type { LosVerdesAnomalies } from "@/lib/livemap-public.functions";

const emptyFc = { type: "FeatureCollection" as const, features: [] };

describe("Los Verdes canonical public adapter", () => {
  it("keeps draft project sampling separate from certified assays", () => {
    const manifest = buildPublicGeoManifest(
      { id: "lv", name: "Los Verdes", center_lat: -32, center_lng: -71 },
      [
        "territory.cadastre",
        "remote_sensing.sentinel2_alteration",
        "remote_sensing.lineaments",
        "geology.structures",
        "geophysics.anomalies",
        "sampling.results",
        "targets.exploration",
      ],
    );

    const mapData = {
      bbox: [-71.2, -32.1, -70.9, -31.8],
      center: [-71.05, -31.95],
      concessions: emptyFc,
      targets: emptyFc,
      satAnomalies: emptyFc,
      magAnomalies: emptyFc,
      samples: {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            id: "s1",
            geometry: { type: "Point" as const, coordinates: [-71, -32] },
            properties: { record_status: "draft", cu_pct: 1.2 },
          },
        ],
      },
      counts: {
        concessions: 0,
        concessionsWithGeom: 0,
        targets: 0,
        satAnomalies: 0,
        magAnomalies: 0,
        samples: 1,
      },
    } as LosVerdesMapData;

    const mining = {
      veins: [],
      phases: [],
      totals: {
        veinTonnes: 0,
        veinRevenueUsd: 0,
        phaseTonnes: 0,
        phaseRevenueUsd: 0,
        npvUsdTotal: 0,
        capexUsdTotal: 0,
      },
    } as LosVerdesMining;

    const anomalies = {
      magTargets: [],
      satAnomalies: [],
      lineaments: [],
    } as LosVerdesAnomalies;

    const bundle = buildLosVerdesPublicGeoBundle(manifest, mapData, mining, anomalies);

    expect(bundle.layers["sampling.results"]?.features).toHaveLength(1);
    expect(bundle.layers["sampling.assays"]).toBeUndefined();
  });

  it("keeps satellite-derived lineaments separate from measured geological structures", () => {
    const manifest = buildPublicGeoManifest(
      { id: "lv", name: "Los Verdes", center_lat: -32, center_lng: -71 },
      ["remote_sensing.lineaments", "geology.structures"],
    );
    const mapData = {
      bbox: null,
      center: [-71, -32],
      concessions: emptyFc,
      targets: emptyFc,
      satAnomalies: emptyFc,
      magAnomalies: emptyFc,
      samples: emptyFc,
      counts: {
        concessions: 0,
        concessionsWithGeom: 0,
        targets: 0,
        satAnomalies: 0,
        magAnomalies: 0,
        samples: 0,
      },
    } as LosVerdesMapData;
    const mining = {
      veins: [
        {
          id: "v1",
          code: "V1",
          name: "Veta 1",
          commodity: "Cu",
          strike_deg: 20,
          dip_deg: 70,
          dip_dir_deg: null,
          thickness_m: 1,
          length_m: 100,
          depth_top_m: 0,
          depth_bottom_m: 50,
          grade_estimate: null,
          density_tm3: null,
          confidence: "conceptual",
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [-71, -32],
              [-70.99, -31.99],
            ],
          },
          notes: null,
          cubication: null,
        },
      ],
      phases: [],
      totals: {
        veinTonnes: 0,
        veinRevenueUsd: 0,
        phaseTonnes: 0,
        phaseRevenueUsd: 0,
        npvUsdTotal: 0,
        capexUsdTotal: 0,
      },
    } as LosVerdesMining;
    const anomalies = {
      magTargets: [],
      satAnomalies: [],
      lineaments: [
        {
          id: "l1",
          severity: "high",
          score: 0.8,
          path: [
            [-32, -71],
            [-31.99, -70.99],
          ],
        },
      ],
    } as LosVerdesAnomalies;

    const bundle = buildLosVerdesPublicGeoBundle(manifest, mapData, mining, anomalies);

    expect(bundle.layers["remote_sensing.lineaments"]?.features).toHaveLength(1);
    expect(bundle.layers["geology.structures"]?.features).toHaveLength(1);
  });
});

export type EvidenceClass = "CERTIFIED" | "DECLARED" | "DERIVED" | "INTERPRETED";

export type TargetEvidenceVector = {
  id: string;
  lat: number;
  lng: number;
  spectral: {
    alohZ: number;
    percentile: number;
    feOxides: number | null;
    gossan: number | null;
    evidenceClass: "DERIVED";
  };
  field: {
    nearestPointCode: string | null;
    distanceM: number | null;
    assayCuPct: number | null;
    evidenceClass: "CERTIFIED" | "DECLARED" | null;
  };
  convergence: {
    components: number;
    labels: string[];
  };
};

type Candidate = {
  rank: number;
  lat: number;
  lng: number;
  alohZ: number;
  percentile: number;
  feOxides?: number | null;
  gossan?: number | null;
};

type FieldPoint = {
  code: string;
  lat: number;
  lng: number;
  assayCuPct?: number | null;
};

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const p1 = aLat * Math.PI / 180, p2 = bLat * Math.PI / 180;
  const dp = (bLat - aLat) * Math.PI / 180, dl = (bLng - aLng) * Math.PI / 180;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Transparent convergence: this does not estimate discovery probability.
 * It only records which independent evidence families coincide spatially.
 */
export function buildTargetEvidenceVectors(
  candidates: Candidate[],
  fieldPoints: FieldPoint[],
  fieldRadiusM = 250,
): TargetEvidenceVector[] {
  return candidates.map((c) => {
    const nearest = fieldPoints
      .map((p) => ({ p, d: haversineM(c.lat, c.lng, p.lat, p.lng) }))
      .sort((a, b) => a.d - b.d)[0];
    const field = nearest && nearest.d <= fieldRadiusM ? nearest : null;
    const labels = ["spectral"];
    if (field) labels.push(field.p.assayCuPct != null ? "field+assay" : "field");
    return {
      id: `SAT-${c.rank}`,
      lat: c.lat,
      lng: c.lng,
      spectral: {
        alohZ: c.alohZ,
        percentile: c.percentile,
        feOxides: c.feOxides ?? null,
        gossan: c.gossan ?? null,
        evidenceClass: "DERIVED",
      },
      field: {
        nearestPointCode: field?.p.code ?? null,
        distanceM: field ? Math.round(field.d) : null,
        assayCuPct: field?.p.assayCuPct ?? null,
        evidenceClass: field ? (field.p.assayCuPct != null ? "CERTIFIED" : "DECLARED") : null,
      },
      convergence: { components: labels.length, labels },
    };
  });
}

// Block model worker — Datamine-style XYZ blocks with IDW grade estimation,
// classification (measured/indicated/inferred), tonnage and metal content.
// All heavy compute stays here; main thread receives a typed-array bundle
// via transferables.

export type BlockCommodity = "au" | "ag" | "cu" | "zn" | "fe" | "li" | "generic";

export type BlockSamplePoint = {
  x: number;
  y: number;
  z: number;
  /** Anomaly intensity 0..1 used as a synthetic grade proxy. */
  v: number;
};

export type BlockModelInput = {
  samples: BlockSamplePoint[];
  /** Bbox in engine coordinates (meters, ENU). */
  bbox: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  blockSize: { x: number; y: number; z: number };
  /** IDW exponent. */
  power: number;
  searchRadius: number;
  minSamples: number;
  maxSamples: number;
  /** Density tonnes / m³. */
  density: number;
  /** Convert v(0..1) to grade in commodity unit (g/t for Au/Ag, % for base metals). */
  gradeScale: number;
  commodity: BlockCommodity;
  /** Confidence radii — measured ≤ r1 < indicated ≤ r2 < inferred. */
  classMeasuredR: number;
  classIndicatedR: number;
};

export type BlockModelOutput = {
  /** Block centers (Float32Array length = count*3). */
  positions: Float32Array;
  /** Estimated grade per block. */
  grades: Float32Array;
  /** Tonnage per block (tonnes). */
  tonnages: Float32Array;
  /** Contained metal per block (g for Au/Ag, t for base). */
  metals: Float32Array;
  /** 0=measured, 1=indicated, 2=inferred, 3=waste/unestimated. */
  classification: Uint8Array;
  /** Confidence 0..1 (1 = many close samples). */
  confidence: Float32Array;
  /** Closest sample distance per block. */
  nearestDist: Float32Array;
  count: number;
  blockSize: { x: number; y: number; z: number };
  commodity: BlockCommodity;
  density: number;
  stats: {
    gradeMin: number;
    gradeMax: number;
    gradeMean: number;
    tonnesTotal: number;
    metalTotal: number;
    measured: number;
    indicated: number;
    inferred: number;
    waste: number;
    elapsedMs: number;
  };
};

self.onmessage = (ev: MessageEvent<BlockModelInput>) => {
  const t0 = performance.now();
  const input = ev.data;
  const out = buildBlockModel(input);
  const elapsedMs = performance.now() - t0;
  const payload: BlockModelOutput = { ...out, stats: { ...out.stats, elapsedMs } };
  (self as unknown as Worker).postMessage(payload, [
    payload.positions.buffer,
    payload.grades.buffer,
    payload.tonnages.buffer,
    payload.metals.buffer,
    payload.classification.buffer,
    payload.confidence.buffer,
    payload.nearestDist.buffer,
  ]);
};

function buildBlockModel(p: BlockModelInput): Omit<BlockModelOutput, "stats"> & {
  stats: Omit<BlockModelOutput["stats"], "elapsedMs">;
} {
  const { bbox, blockSize, samples } = p;
  const nx = Math.max(1, Math.floor((bbox.maxX - bbox.minX) / blockSize.x));
  const ny = Math.max(1, Math.floor((bbox.maxY - bbox.minY) / blockSize.y));
  const nz = Math.max(1, Math.floor((bbox.maxZ - bbox.minZ) / blockSize.z));
  const total = nx * ny * nz;

  const positions = new Float32Array(total * 3);
  const grades = new Float32Array(total);
  const tonnages = new Float32Array(total);
  const metals = new Float32Array(total);
  const classification = new Uint8Array(total);
  const confidence = new Float32Array(total);
  const nearestDist = new Float32Array(total);

  const blockVolume = blockSize.x * blockSize.y * blockSize.z;
  const blockTonnes = blockVolume * p.density;
  // For Au/Ag: grade (g/t) × tonnes = grams. For base metals (%): metal_t = tonnes * grade/100.
  const isPrecious = p.commodity === "au" || p.commodity === "ag";

  let gMin = Infinity;
  let gMax = -Infinity;
  let gSumEstimated = 0;
  let nEstimated = 0;
  let measured = 0;
  let indicated = 0;
  let inferred = 0;
  let waste = 0;
  let metalTotal = 0;
  let tonnesTotal = 0;

  const r2 = p.searchRadius * p.searchRadius;
  let idx = 0;

  for (let iz = 0; iz < nz; iz++) {
    const cz = bbox.minZ + (iz + 0.5) * blockSize.z;
    for (let iy = 0; iy < ny; iy++) {
      const cy = bbox.minY + (iy + 0.5) * blockSize.y;
      for (let ix = 0; ix < nx; ix++) {
        const cx = bbox.minX + (ix + 0.5) * blockSize.x;
        positions[idx * 3] = cx;
        positions[idx * 3 + 1] = cy;
        positions[idx * 3 + 2] = cz;

        // Collect neighbors within search radius
        const neigh: Array<{ d2: number; v: number }> = [];
        let near = Infinity;
        for (let s = 0; s < samples.length; s++) {
          const sp = samples[s];
          const dx = sp.x - cx;
          const dy = sp.y - cy;
          const dz = sp.z - cz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 <= r2) {
            neigh.push({ d2, v: sp.v });
            if (d2 < near) near = d2;
          }
        }

        if (neigh.length < p.minSamples) {
          classification[idx] = 3; // waste / unestimated
          waste++;
          nearestDist[idx] = neigh.length === 0 ? p.searchRadius : Math.sqrt(near);
          idx++;
          continue;
        }
        // Keep closest maxSamples
        neigh.sort((a, b) => a.d2 - b.d2);
        const use = neigh.slice(0, p.maxSamples);
        // IDW
        let num = 0;
        let den = 0;
        for (const n of use) {
          const d = Math.sqrt(n.d2);
          const w = 1 / Math.pow(Math.max(d, 0.01), p.power);
          num += n.v * w;
          den += w;
        }
        const vEst = den > 0 ? num / den : 0;
        const grade = vEst * p.gradeScale;
        grades[idx] = grade;
        tonnages[idx] = blockTonnes;
        const metal = isPrecious ? grade * blockTonnes : (blockTonnes * grade) / 100;
        metals[idx] = metal;

        const nearD = Math.sqrt(near);
        nearestDist[idx] = nearD;
        // Confidence: closer + more samples = higher
        const cConf =
          Math.min(1, use.length / p.maxSamples) * (1 - Math.min(1, nearD / p.searchRadius));
        confidence[idx] = cConf;

        if (nearD <= p.classMeasuredR) {
          classification[idx] = 0;
          measured++;
        } else if (nearD <= p.classIndicatedR) {
          classification[idx] = 1;
          indicated++;
        } else {
          classification[idx] = 2;
          inferred++;
        }

        gSumEstimated += grade;
        nEstimated++;
        if (grade < gMin) gMin = grade;
        if (grade > gMax) gMax = grade;
        tonnesTotal += blockTonnes;
        metalTotal += metal;
        idx++;
      }
    }
  }

  return {
    positions,
    grades,
    tonnages,
    metals,
    classification,
    confidence,
    nearestDist,
    count: total,
    blockSize,
    commodity: p.commodity,
    density: p.density,
    stats: {
      gradeMin: nEstimated ? gMin : 0,
      gradeMax: nEstimated ? gMax : 0,
      gradeMean: nEstimated ? gSumEstimated / nEstimated : 0,
      tonnesTotal,
      metalTotal,
      measured,
      indicated,
      inferred,
      waste,
    },
  };
}

export {};

// Worker: voxelización IDW de puntos XYZV → grid 3D filtrado por isovalue.
// Salida: arrays planos transferibles con posición/valor de celdas activas.
//
// Pipeline:
//   1. Recibe puntos { x, y, z, v } en metros ENU + parámetros
//   2. Calcula bbox extendido y resolución (NxNxN)
//   3. Para cada celda: IDW(power=2) sobre N vecinos más cercanos
//   4. Filtra celdas con valor >= isovalue
//   5. Devuelve posiciones + valores como Float32Array transferible

export type VoxelInput = {
  points: Array<{ x: number; y: number; z: number; v: number }>;
  resolution: number; // celdas por eje, ej 48
  isovalue: number;   // 0..1
  power: number;      // IDW power, típico 2
  margin: number;     // metros de margen alrededor del bbox
  /** búsqueda de vecinos máximo (k). 0 = todos */
  kNearest: number;
};

export type VoxelOutput = {
  positions: Float32Array; // [x,y,z,...] N*3
  values: Float32Array;    // [v,...] N
  cellSize: number;        // metros por celda (promedio xy)
  cellSizeZ: number;
  bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
  cellCount: number;
  activeCount: number;
};

function idwAt(
  px: number, py: number, pz: number,
  points: Float32Array, n: number,
  power: number, k: number,
): number {
  // points layout: [x,y,z,v, x,y,z,v, ...]
  if (k === 0 || k >= n) {
    // todos los puntos
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const off = i * 4;
      const dx = points[off] - px;
      const dy = points[off + 1] - py;
      const dz = points[off + 2] - pz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 1) return points[off + 3]; // muy cerca → toma el valor
      const w = 1 / Math.pow(d2, power / 2);
      num += w * points[off + 3];
      den += w;
    }
    return den > 0 ? num / den : 0;
  }
  // top-k vecinos
  const dists = new Float32Array(n);
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const dx = points[off] - px;
    const dy = points[off + 1] - py;
    const dz = points[off + 2] - pz;
    dists[i] = dx * dx + dy * dy + dz * dz;
    idx[i] = i;
  }
  // partial sort top-k
  for (let i = 0; i < k; i++) {
    let min = i;
    for (let j = i + 1; j < n; j++) if (dists[j] < dists[min]) min = j;
    if (min !== i) {
      const td = dists[i]; dists[i] = dists[min]; dists[min] = td;
      const ti = idx[i]; idx[i] = idx[min]; idx[min] = ti;
    }
  }
  let num = 0; let den = 0;
  for (let i = 0; i < k; i++) {
    const d2 = dists[i];
    if (d2 < 1) return points[idx[i] * 4 + 3];
    const w = 1 / Math.pow(d2, power / 2);
    num += w * points[idx[i] * 4 + 3];
    den += w;
  }
  return den > 0 ? num / den : 0;
}

function buildVoxels(input: VoxelInput): VoxelOutput {
  const { points, resolution, isovalue, power, margin, kNearest } = input;
  const n = points.length;

  if (n === 0) {
    return {
      positions: new Float32Array(0),
      values: new Float32Array(0),
      cellSize: 0,
      cellSizeZ: 0,
      bounds: { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 },
      cellCount: 0,
      activeCount: 0,
    };
  }

  // Empaqueta puntos
  const flat = new Float32Array(n * 4);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    flat[i * 4] = p.x;
    flat[i * 4 + 1] = p.y;
    flat[i * 4 + 2] = p.z;
    flat[i * 4 + 3] = p.v;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }
  minX -= margin; maxX += margin;
  minY -= margin; maxY += margin;
  minZ -= margin * 0.3; maxZ += margin * 0.3;
  // Asegura un rango Z razonable
  if (maxZ - minZ < 50) { minZ -= 50; maxZ += 10; }

  const sx = (maxX - minX) / resolution;
  const sy = (maxY - minY) / resolution;
  const sz = (maxZ - minZ) / resolution;
  const cellSize = (sx + sy) / 2;

  // Pre-asigna buffers worst-case y luego trunca
  const total = resolution * resolution * resolution;
  const posTmp = new Float32Array(total * 3);
  const valTmp = new Float32Array(total);
  let active = 0;

  for (let iz = 0; iz < resolution; iz++) {
    const z = minZ + (iz + 0.5) * sz;
    for (let iy = 0; iy < resolution; iy++) {
      const y = minY + (iy + 0.5) * sy;
      for (let ix = 0; ix < resolution; ix++) {
        const x = minX + (ix + 0.5) * sx;
        const v = idwAt(x, y, z, flat, n, power, kNearest);
        if (v >= isovalue) {
          posTmp[active * 3] = x;
          posTmp[active * 3 + 1] = y;
          posTmp[active * 3 + 2] = z;
          valTmp[active] = v;
          active++;
        }
      }
    }
  }

  const positions = new Float32Array(active * 3);
  const values = new Float32Array(active);
  positions.set(posTmp.subarray(0, active * 3));
  values.set(valTmp.subarray(0, active));

  return {
    positions,
    values,
    cellSize,
    cellSizeZ: sz,
    bounds: { minX, minY, minZ, maxX, maxY, maxZ },
    cellCount: total,
    activeCount: active,
  };
}

self.addEventListener("message", (ev: MessageEvent<VoxelInput>) => {
  const out = buildVoxels(ev.data);
  // Transfiere buffers (no copia)
  (self as unknown as Worker).postMessage(out, [out.positions.buffer, out.values.buffer]);
});

export {};

// Isosurface worker: voxeliza puntos XYZV (IDW) → scalar field denso →
// Marching Cubes → mesh BufferGeometry (positions/normals/indices).
// Mesh continuo "Leapfrog-like" reemplaza los cubos voxel para impacto visual AAA.
//
// Salida totalmente transferible (Float32Array + Uint32Array).
import { EDGE_TABLE, TRI_TABLE, EDGE_CORNERS, CORNER_OFFSETS } from "./mcTables";

export type IsoInput = {
  points: Array<{ x: number; y: number; z: number; v: number }>;
  resolution: number; // celdas por eje (típico 48-72)
  isovalue: number;   // 0..1
  power: number;      // IDW power
  margin: number;     // metros margen bbox
  kNearest: number;   // 0 = todos
};

export type IsoOutput = {
  positions: Float32Array; // [x,y,z,...]
  normals: Float32Array;   // [nx,ny,nz,...]
  values: Float32Array;    // valor interpolado por vértice (para color)
  indices: Uint32Array;    // triángulos
  bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
  resolution: number;
  vertexCount: number;
  triangleCount: number;
  fieldMin: number;
  fieldMax: number;
};

function idwAt(
  px: number, py: number, pz: number,
  pts: Float32Array, n: number,
  power: number, k: number,
): number {
  if (k === 0 || k >= n) {
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      const off = i * 4;
      const dx = pts[off] - px, dy = pts[off+1] - py, dz = pts[off+2] - pz;
      const d2 = dx*dx + dy*dy + dz*dz;
      if (d2 < 1) return pts[off+3];
      const w = 1 / Math.pow(d2, power/2);
      num += w * pts[off+3];
      den += w;
    }
    return den > 0 ? num / den : 0;
  }
  // top-k partial sort
  const dists = new Float32Array(n);
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const off = i*4;
    const dx = pts[off]-px, dy = pts[off+1]-py, dz = pts[off+2]-pz;
    dists[i] = dx*dx+dy*dy+dz*dz;
    idx[i] = i;
  }
  for (let i = 0; i < k; i++) {
    let m = i;
    for (let j = i+1; j < n; j++) if (dists[j] < dists[m]) m = j;
    if (m !== i) {
      const td = dists[i]; dists[i] = dists[m]; dists[m] = td;
      const ti = idx[i]; idx[i] = idx[m]; idx[m] = ti;
    }
  }
  let num = 0, den = 0;
  for (let i = 0; i < k; i++) {
    const d2 = dists[i];
    if (d2 < 1) return pts[idx[i]*4+3];
    const w = 1 / Math.pow(d2, power/2);
    num += w * pts[idx[i]*4+3];
    den += w;
  }
  return den > 0 ? num/den : 0;
}

function marchingCubes(
  field: Float32Array,
  res: number,
  iso: number,
  minX: number, minY: number, minZ: number,
  sx: number, sy: number, sz: number,
): { positions: Float32Array; normals: Float32Array; values: Float32Array; indices: Uint32Array; min: number; max: number } {
  // Pre-estima: usa arrays dinámicos
  const posArr: number[] = [];
  const valArr: number[] = [];
  const idxArr: number[] = [];

  // hash de aristas para deduplicar vértices entre celdas adyacentes
  const edgeCache = new Map<number, number>();

  const sample = (i: number, j: number, k: number) => field[(k * res + j) * res + i];

  let fMin = Infinity, fMax = -Infinity;


  // Cache valid samples to avoid recomputing
  for (let k = 0; k < res - 1; k++) {
    for (let j = 0; j < res - 1; j++) {
      for (let i = 0; i < res - 1; i++) {
        // 8 corner samples
        const v0 = sample(i,   j,   k);
        const v1 = sample(i+1, j,   k);
        const v2 = sample(i+1, j+1, k);
        const v3 = sample(i,   j+1, k);
        const v4 = sample(i,   j,   k+1);
        const v5 = sample(i+1, j,   k+1);
        const v6 = sample(i+1, j+1, k+1);
        const v7 = sample(i,   j+1, k+1);

        if (v0 < fMin) fMin = v0; if (v0 > fMax) fMax = v0;

        let ci = 0;
        if (v0 < iso) ci |= 1;
        if (v1 < iso) ci |= 2;
        if (v2 < iso) ci |= 4;
        if (v3 < iso) ci |= 8;
        if (v4 < iso) ci |= 16;
        if (v5 < iso) ci |= 32;
        if (v6 < iso) ci |= 64;
        if (v7 < iso) ci |= 128;

        const edges = EDGE_TABLE[ci];
        if (edges === 0) continue;

        const corners: number[] = [v0,v1,v2,v3,v4,v5,v6,v7];
        const cornerCoord = (idx: number): [number, number, number] => {
          const o = CORNER_OFFSETS[idx];
          return [i + o[0], j + o[1], k + o[2]];
        };

        // Interpola posiciones de los 12 edges si cruzan la iso
        const edgeVertIdx: number[] = new Array(12).fill(-1);
        for (let e = 0; e < 12; e++) {
          if (!(edges & (1 << e))) continue;
          const [a, b] = EDGE_CORNERS[e];
          // Determinar la celda canónica que "posee" esta arista (cell con menor coord en los ejes ortogonales)
          const ca = cornerCoord(a);
          const cb = cornerCoord(b);
          const minI = Math.min(ca[0], cb[0]);
          const minJ = Math.min(ca[1], cb[1]);
          const minK = Math.min(ca[2], cb[2]);
          // direction of edge: 0=x, 1=y, 2=z
          let dir = 0;
          if (ca[0] !== cb[0]) dir = 0;
          else if (ca[1] !== cb[1]) dir = 1;
          else dir = 2;
          const key = ((minK * (res + 1) + minJ) * (res + 1) + minI) * 3 + dir;

          let vi = edgeCache.get(key);
          if (vi === undefined) {
            const va = corners[a];
            const vb = corners[b];
            let t = 0.5;
            const denom = vb - va;
            if (Math.abs(denom) > 1e-6) t = (iso - va) / denom;
            t = Math.max(0, Math.min(1, t));

            const ax = minX + ca[0] * sx, ay = minY + ca[1] * sy, az = minZ + ca[2] * sz;
            const bx = minX + cb[0] * sx, by = minY + cb[1] * sy, bz = minZ + cb[2] * sz;
            const px = ax + t * (bx - ax);
            const py = ay + t * (by - ay);
            const pz = az + t * (bz - az);
            const pv = va + t * (vb - va);

            vi = posArr.length / 3;
            posArr.push(px, py, pz);
            valArr.push(pv);
            edgeCache.set(key, vi);
          }
          edgeVertIdx[e] = vi;
        }

        // Triangulación según tri table (16 ints, -1 terminator)
        const triBase = ci * 16;
        for (let t = 0; t < 16; t += 3) {
          const a = TRI_TABLE[triBase + t];
          if (a === -1) break;
          const b = TRI_TABLE[triBase + t + 1];
          const c = TRI_TABLE[triBase + t + 2];
          idxArr.push(edgeVertIdx[a], edgeVertIdx[b], edgeVertIdx[c]);
        }
      }
    }
  }

  const positions = new Float32Array(posArr);
  const values = new Float32Array(valArr);
  const indices = new Uint32Array(idxArr);

  // Calcular normales por face → acumulación por vértice → normalizar
  const normals = new Float32Array(positions.length);
  const triCount = indices.length / 3;
  for (let i = 0; i < triCount; i++) {
    const ia = indices[i*3] * 3;
    const ib = indices[i*3+1] * 3;
    const ic = indices[i*3+2] * 3;
    const ax = positions[ia], ay = positions[ia+1], az = positions[ia+2];
    const bx = positions[ib], by = positions[ib+1], bz = positions[ib+2];
    const cx = positions[ic], cy = positions[ic+1], cz = positions[ic+2];
    const ex = bx-ax, ey = by-ay, ez = bz-az;
    const fx = cx-ax, fy = cy-ay, fz = cz-az;
    const nx = ey*fz - ez*fy;
    const ny = ez*fx - ex*fz;
    const nz = ex*fy - ey*fx;
    normals[ia]   += nx; normals[ia+1] += ny; normals[ia+2] += nz;
    normals[ib]   += nx; normals[ib+1] += ny; normals[ib+2] += nz;
    normals[ic]   += nx; normals[ic+1] += ny; normals[ic+2] += nz;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i], y = normals[i+1], z = normals[i+2];
    const len = Math.hypot(x, y, z);
    if (len > 1e-8) {
      normals[i] = x/len; normals[i+1] = y/len; normals[i+2] = z/len;
    } else {
      normals[i] = 0; normals[i+1] = 1; normals[i+2] = 0;
    }
  }

  return { positions, normals, values, indices, min: fMin, max: fMax };
}

function buildIsosurface(input: IsoInput): IsoOutput {
  const { points, resolution, isovalue, power, margin, kNearest } = input;
  const n = points.length;
  const res = Math.max(4, Math.min(160, Math.floor(resolution)));

  if (n === 0) {
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      values: new Float32Array(0),
      indices: new Uint32Array(0),
      bounds: { minX:0,minY:0,minZ:0,maxX:0,maxY:0,maxZ:0 },
      resolution: res,
      vertexCount: 0,
      triangleCount: 0,
      fieldMin: 0, fieldMax: 0,
    };
  }

  // Empaqueta puntos + bbox
  const flat = new Float32Array(n * 4);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    flat[i*4] = p.x; flat[i*4+1] = p.y; flat[i*4+2] = p.z; flat[i*4+3] = p.v;
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; if (p.z > maxZ) maxZ = p.z;
  }
  minX -= margin; maxX += margin;
  minY -= margin; maxY += margin;
  minZ -= margin * 0.3; maxZ += margin * 0.3;
  if (maxZ - minZ < 50) { minZ -= 50; maxZ += 10; }

  const sx = (maxX - minX) / (res - 1);
  const sy = (maxY - minY) / (res - 1);
  const sz = (maxZ - minZ) / (res - 1);

  // Genera el scalar field denso res^3
  const field = new Float32Array(res * res * res);
  let fMin = Infinity, fMax = -Infinity;
  for (let k = 0; k < res; k++) {
    const z = minZ + k * sz;
    for (let j = 0; j < res; j++) {
      const y = minY + j * sy;
      for (let i = 0; i < res; i++) {
        const x = minX + i * sx;
        const v = idwAt(x, y, z, flat, n, power, kNearest);
        field[(k * res + j) * res + i] = v;
        if (v < fMin) fMin = v;
        if (v > fMax) fMax = v;
      }
    }
  }

  // Marching Cubes
  const mc = marchingCubes(field, res, isovalue, minX, minY, minZ, sx, sy, sz);

  return {
    positions: mc.positions,
    normals: mc.normals,
    values: mc.values,
    indices: mc.indices,
    bounds: { minX, minY, minZ, maxX, maxY, maxZ },
    resolution: res,
    vertexCount: mc.positions.length / 3,
    triangleCount: mc.indices.length / 3,
    fieldMin: fMin,
    fieldMax: fMax,
  };
}

self.addEventListener("message", (ev: MessageEvent<IsoInput>) => {
  const out = buildIsosurface(ev.data);
  (self as unknown as Worker).postMessage(out, [
    out.positions.buffer,
    out.normals.buffer,
    out.values.buffer,
    out.indices.buffer,
  ]);
});

export {};

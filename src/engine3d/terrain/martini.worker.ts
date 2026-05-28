// Worker: convierte un heightmap regular en TIN adaptativo con Martini.
// Devuelve buffers transferibles (positions, normals, indices) listos para BufferGeometry.
//
// Coordenadas de salida: ya en frame "three" (X este, Y altura, Z = -norte).
import Martini from "martini";

export type MartiniInput = {
  heights: number[];
  size: number;
  extentMeters: number;
  /** Error de aproximación en metros (menor = más triángulos). */
  errorMeters: number;
  /** Exageración vertical aplicada a Y. */
  verticalExaggeration: number;
};

export type MartiniOutput = {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
};

self.onmessage = (e: MessageEvent<MartiniInput>) => {
  const { heights, size, extentMeters, errorMeters, verticalExaggeration } = e.data;

  // Martini requiere Float32Array de tamaño size*size
  const terrain = new Float32Array(heights);
  const martini = new Martini(size);
  const tile = martini.createTile(terrain);
  const mesh = tile.getMesh(errorMeters);

  const vertices: Uint16Array = mesh.vertices; // [i,j, i,j, ...]
  const triangles: Uint32Array = mesh.triangles;

  const numVerts = vertices.length / 2;
  const positions = new Float32Array(numVerts * 3);
  const meterPerPixel = extentMeters / (size - 1);
  const half = extentMeters / 2;

  for (let v = 0; v < numVerts; v++) {
    const i = vertices[v * 2];
    const j = vertices[v * 2 + 1];
    const h = terrain[j * size + i];
    // Centro local: i → X (este), j → -Z (norte)
    positions[v * 3]     = i * meterPerPixel - half;
    positions[v * 3 + 1] = h * verticalExaggeration;
    positions[v * 3 + 2] = -(j * meterPerPixel - half);
  }

  // Normales por triángulo, acumuladas en vértices
  const normals = new Float32Array(numVerts * 3);
  const triCount = triangles.length / 3;
  const a = new Float32Array(3), b = new Float32Array(3), n = new Float32Array(3);

  for (let t = 0; t < triCount; t++) {
    const i0 = triangles[t * 3];
    const i1 = triangles[t * 3 + 1];
    const i2 = triangles[t * 3 + 2];
    const ax = positions[i0 * 3],     ay = positions[i0 * 3 + 1],     az = positions[i0 * 3 + 2];
    const bx = positions[i1 * 3] - ax, by = positions[i1 * 3 + 1] - ay, bz = positions[i1 * 3 + 2] - az;
    const cx = positions[i2 * 3] - ax, cy = positions[i2 * 3 + 1] - ay, cz = positions[i2 * 3 + 2] - az;
    a[0] = bx; a[1] = by; a[2] = bz;
    b[0] = cx; b[1] = cy; b[2] = cz;
    n[0] = a[1] * b[2] - a[2] * b[1];
    n[1] = a[2] * b[0] - a[0] * b[2];
    n[2] = a[0] * b[1] - a[1] * b[0];
    normals[i0 * 3]     += n[0]; normals[i0 * 3 + 1] += n[1]; normals[i0 * 3 + 2] += n[2];
    normals[i1 * 3]     += n[0]; normals[i1 * 3 + 1] += n[1]; normals[i1 * 3 + 2] += n[2];
    normals[i2 * 3]     += n[0]; normals[i2 * 3 + 1] += n[1]; normals[i2 * 3 + 2] += n[2];
  }
  // Normalizar
  for (let v = 0; v < numVerts; v++) {
    const nx = normals[v * 3], ny = normals[v * 3 + 1], nz = normals[v * 3 + 2];
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[v * 3]     = nx / len;
    normals[v * 3 + 1] = ny / len;
    normals[v * 3 + 2] = nz / len;
  }

  const out: MartiniOutput = {
    positions,
    normals,
    indices: new Uint32Array(triangles),
    vertexCount: numVerts,
    triangleCount: triCount,
  };

  (self as unknown as Worker).postMessage(out, [
    out.positions.buffer,
    out.normals.buffer,
    out.indices.buffer,
  ]);
};

// Worker: convierte un heightmap regular en malla triangulada ligera.
// Evitamos la dependencia `martini` en runtime porque en este proyecto
// rompe la optimización de dependencias del cliente y deja el visor en fallback.
// Devuelve buffers transferibles (positions, normals, indices) listos para BufferGeometry.
//
// Coordenadas de salida: ya en frame "three" (X este, Y altura, Z = -norte).

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

function strideFromErrorMeters(errorMeters: number) {
  if (errorMeters >= 6) return 4;
  if (errorMeters >= 2) return 2;
  return 1;
}

self.onmessage = (e: MessageEvent<MartiniInput>) => {
  const { heights, size, extentMeters, errorMeters, verticalExaggeration } = e.data;

  const terrain = new Float32Array(heights);
  const meterPerPixel = extentMeters / (size - 1);
  const half = extentMeters / 2;
  const stride = strideFromErrorMeters(errorMeters);

  const xs: number[] = [];
  for (let i = 0; i < size; i += stride) xs.push(i);
  if (xs[xs.length - 1] !== size - 1) xs.push(size - 1);

  const ys: number[] = [];
  for (let j = 0; j < size; j += stride) ys.push(j);
  if (ys[ys.length - 1] !== size - 1) ys.push(size - 1);

  const cols = xs.length;
  const rows = ys.length;
  const numVerts = cols * rows;
  const positions = new Float32Array(numVerts * 3);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = r * cols + c;
      const i = xs[c];
      const j = ys[r];
      const h = terrain[j * size + i];
      positions[v * 3] = i * meterPerPixel - half;
      positions[v * 3 + 1] = h * verticalExaggeration;
      positions[v * 3 + 2] = -(j * meterPerPixel - half);
    }
  }

  const triangles = new Uint32Array((rows - 1) * (cols - 1) * 6);
  let t = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i0 = r * cols + c;
      const i1 = i0 + 1;
      const i2 = i0 + cols;
      const i3 = i2 + 1;

      triangles[t++] = i0;
      triangles[t++] = i2;
      triangles[t++] = i1;

      triangles[t++] = i1;
      triangles[t++] = i2;
      triangles[t++] = i3;
    }
  }

  // Normales por triángulo, acumuladas en vértices
  const normals = new Float32Array(numVerts * 3);
  const triCount = triangles.length / 3;
  const a = new Float32Array(3),
    b = new Float32Array(3),
    n = new Float32Array(3);

  for (let t = 0; t < triCount; t++) {
    const i0 = triangles[t * 3];
    const i1 = triangles[t * 3 + 1];
    const i2 = triangles[t * 3 + 2];
    const ax = positions[i0 * 3],
      ay = positions[i0 * 3 + 1],
      az = positions[i0 * 3 + 2];
    const bx = positions[i1 * 3] - ax,
      by = positions[i1 * 3 + 1] - ay,
      bz = positions[i1 * 3 + 2] - az;
    const cx = positions[i2 * 3] - ax,
      cy = positions[i2 * 3 + 1] - ay,
      cz = positions[i2 * 3 + 2] - az;
    a[0] = bx;
    a[1] = by;
    a[2] = bz;
    b[0] = cx;
    b[1] = cy;
    b[2] = cz;
    n[0] = a[1] * b[2] - a[2] * b[1];
    n[1] = a[2] * b[0] - a[0] * b[2];
    n[2] = a[0] * b[1] - a[1] * b[0];
    normals[i0 * 3] += n[0];
    normals[i0 * 3 + 1] += n[1];
    normals[i0 * 3 + 2] += n[2];
    normals[i1 * 3] += n[0];
    normals[i1 * 3 + 1] += n[1];
    normals[i1 * 3 + 2] += n[2];
    normals[i2 * 3] += n[0];
    normals[i2 * 3 + 1] += n[1];
    normals[i2 * 3 + 2] += n[2];
  }
  // Normalizar
  for (let v = 0; v < numVerts; v++) {
    const nx = normals[v * 3],
      ny = normals[v * 3 + 1],
      nz = normals[v * 3 + 2];
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[v * 3] = nx / len;
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

// Capa deck.gl: wireframes RBF persistidos (geology_wireframes).
// Los vertices vienen en metros locales (mismo sistema que drill_holes:
// easting/northing/profundidad). Convertimos cada vértice a lng/lat y
// usamos SimpleMeshLayer en (0,0,0) para evitar transformaciones por instancia.
import { useMemo } from "react";
import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { COORDINATE_SYSTEM } from "@deck.gl/core";
import { useWireframes } from "@/hooks/useWireframes";

const M_PER_DEG_LAT = 111320;

// Paleta por commodity (RGB)
const COMMODITY_COLOR: Record<string, [number, number, number]> = {
  au: [212, 175, 55],
  ag: [192, 192, 192],
  cu: [184, 115, 51],
  default: [212, 175, 55],
};

type MeshGeometry = {
  positions: { value: Float32Array; size: 3 };
  indices: { value: Uint32Array; size: 1 };
};

export function useWireframesLayer(
  projectId: string | null,
  centerLng: number,
  centerLat: number,
  visible = true,
) {
  const { data: wireframes } = useWireframes(projectId);

  const meshes = useMemo(() => {
    if (!visible || !wireframes?.length) return [];
    const mPerDegLng = M_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180);

    return wireframes
      .filter((w) => w.vertices?.length && w.faces?.length)
      .map((w) => {
        const verts = w.vertices;
        const faces = w.faces;
        const positions = new Float32Array(verts.length * 3);
        for (let i = 0; i < verts.length; i++) {
          const [x, y, z] = verts[i];
          // x = easting (m), y = northing (m), z = profundidad (m, abajo = negativo)
          const lng = centerLng + Number(x) / mPerDegLng;
          const lat = centerLat + Number(y) / M_PER_DEG_LAT;
          positions[i * 3] = lng;
          positions[i * 3 + 1] = lat;
          // deck.gl espera elevación en metros; z ya está en m. Forzamos negativo (subsuelo).
          positions[i * 3 + 2] = -Math.abs(Number(z));
        }
        const indices = new Uint32Array(faces.length * 3);
        for (let i = 0; i < faces.length; i++) {
          const [a, b, c] = faces[i];
          indices[i * 3] = a;
          indices[i * 3 + 1] = b;
          indices[i * 3 + 2] = c;
        }
        const mesh: MeshGeometry = {
          positions: { value: positions, size: 3 },
          indices: { value: indices, size: 1 },
        };
        const color =
          COMMODITY_COLOR[(w.commodity ?? "").toLowerCase()] ?? COMMODITY_COLOR.default;
        return { id: w.id, name: w.name, mesh, color };
      });
  }, [wireframes, centerLng, centerLat, visible]);

  const layers = useMemo(
    () =>
      meshes.map(
        (m) =>
          new SimpleMeshLayer({
            id: `geoscene-wireframe-${m.id}`,
            data: [{ position: [0, 0, 0] }],
            mesh: m.mesh as never,
            coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
            getPosition: (d: { position: [number, number, number] }) => d.position,
            getColor: [...m.color, 180] as [number, number, number, number],
            wireframe: false,
            pickable: true,
          }),
      ),
    [meshes],
  );

  return { layers, count: meshes.length };
}

import { useEffect, useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { DemTile } from "@/engine3d/terrain/dem.functions";
import type { GeophysicsLine, GeophysicsStation } from "@/types/geophysics";
import type { GeophysicsSurface } from "@/lib/geoscience/geophysicsSurface";
import { geophysicsSurfaceColor } from "@/components/map/geophysicsLayers";
import { geophysicsTerrainTriangles } from "@/lib/cholqui/geophysicsTerrain";
import { projectTerrainPoint, terrainFootprintPaths } from "@/lib/geospatial/terrainCoordinates";

type Point = [number, number, number];
type Hover = { position: Point; title: string; lines: string[] } | null;
const SCALE = 0.02;
const position = (point: Point): Point => [
  point[0] * SCALE,
  (point[1] + 3) * SCALE,
  point[2] * SCALE,
];

export function CholquiGeophysicsTerrainLayer({
  tile,
  stations,
  lines,
  surface,
  showStations,
  opacity,
  onHover,
}: {
  tile: DemTile;
  stations: GeophysicsStation[];
  lines: GeophysicsLine[];
  surface: GeophysicsSurface | null;
  showStations: boolean;
  opacity: number;
  onHover: (hover: Hover) => void;
}) {
  const projectedLines = useMemo(
    () => lines.flatMap((line) => terrainFootprintPaths(line.geometry_geojson, tile)),
    [lines, tile],
  );
  const triangles = useMemo(
    () => surface ? geophysicsTerrainTriangles(surface, tile) : [],
    [surface, tile],
  );
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];
    for (const triangle of triangles) {
      if (!surface) continue;
      const color = new THREE.Color(
        geophysicsSurfaceColor(surface, triangle.normalized, triangle.value),
      );
      for (const point of triangle.points) {
        vertices.push(...position(point));
        colors.push(color.r, color.g, color.b);
      }
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [surface, triangles]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      {surface && triangles.length > 0 && (
        <mesh
          geometry={geometry}
          onPointerMove={(event) => {
            const triangle = event.faceIndex != null ? triangles[event.faceIndex] : null;
            if (!triangle) return;
            event.stopPropagation();
            onHover({
              position: [event.point.x, event.point.y, event.point.z],
              title: triangle.value.toFixed(2) + " " + surface.unit,
              lines: [
                "DERIVADO · IDW de " + surface.sourceCount + " estaciones de la campaña",
                "Superficie interpolada sobre el DEM; no inversión ni cuerpo mineral.",
              ],
            });
          }}
          onPointerOut={() => onHover(null)}
        >
          <meshBasicMaterial
            vertexColors
            side={THREE.DoubleSide}
            transparent
            opacity={opacity * 0.65}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}
      {showStations && projectedLines.map((points, index) => (
        <Line key={index} points={points.map(position)} color="#f472b6" lineWidth={1.5} />
      ))}
      {showStations && stations.map((station) => {
        const point = projectTerrainPoint(tile, station.lng, station.lat);
        if (!point) return null;
        const p = position(point);
        const values = [
          station.mag_nt != null ? "TMI medida: " + station.mag_nt + " nT" : null,
          station.ip_chargeability_mvv != null
            ? "Cargabilidad: " + station.ip_chargeability_mvv + " mV/V" : null,
          station.ip_resistivity_ohmm != null
            ? "Resistividad: " + station.ip_resistivity_ohmm + " Ω·m" : null,
        ].filter((value): value is string => value !== null);
        return (
          <mesh
            key={station.id}
            position={p}
            onPointerOver={(event) => {
              event.stopPropagation();
              onHover({
                position: p,
                title: station.station_id,
                lines: ["MEDIDO · estación de campo de Cholqui", ...values],
              });
            }}
            onPointerOut={() => onHover(null)}
          >
            <sphereGeometry args={[0.65, 10, 10]} />
            <meshBasicMaterial color="#f472b6" />
          </mesh>
        );
      })}
    </group>
  );
}

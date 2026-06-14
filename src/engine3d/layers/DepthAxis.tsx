// DepthAxis: eje vertical con marcas cada 100m para dar escala de profundidad.
import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";

export function DepthAxis({
  maxDepth = 400,
  verticalExaggeration = 1,
}: {
  maxDepth?: number;
  verticalExaggeration?: number;
}) {
  const lineGeo = useMemo(() => {
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -maxDepth * verticalExaggeration, 0),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [maxDepth, verticalExaggeration]);

  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let d = 100; d <= maxDepth; d += 100) arr.push(d);
    return arr;
  }, [maxDepth]);

  return (
    <group position={[0, 0, 0]}>
      <line>
        <primitive object={lineGeo} attach="geometry" />
        <lineBasicMaterial color={0x888888} />
      </line>
      {ticks.map((d) => (
        <Text
          key={d}
          position={[20, -d * verticalExaggeration, 0]}
          fontSize={18}
          color="#aaaaaa"
          anchorX="left"
          anchorY="middle"
        >
          {`-${d}m`}
        </Text>
      ))}
    </group>
  );
}

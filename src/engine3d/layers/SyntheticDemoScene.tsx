// SyntheticDemoScene — fallback cuando no hay datasets reales.
// Renderiza terreno, 3 sondajes, un blob de anomalía y un mini block model.
import { useMemo } from "react";
import * as THREE from "three";

export function SyntheticDemoScene({ verticalExaggeration = 1 }: { verticalExaggeration?: number }) {
  const terrainGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(2000, 2000, 60, 60);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h = Math.sin(x / 280) * 90 + Math.cos(y / 220) * 70 + Math.sin((x + y) / 180) * 40;
      pos.setZ(i, h);
    }
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const holes = useMemo(
    () =>
      [
        { x: -300, z: 0, az: 30, depth: 350 },
        { x: 0, z: 0, az: 90, depth: 420 },
        { x: 280, z: -120, az: 150, depth: 300 },
      ].map((h) => ({ ...h, y: h.z * verticalExaggeration })),
    [verticalExaggeration],
  );

  const blocks = useMemo(() => {
    const arr: Array<{ p: [number, number, number]; c: string }> = [];
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        for (let k = -2; k <= 0; k++) {
          const grade = 1 - Math.hypot(i, j, k) / 4;
          if (grade <= 0.1) continue;
          arr.push({
            p: [i * 60, k * 60 * verticalExaggeration - 120 * verticalExaggeration, j * 60],
            c: grade > 0.7 ? "#f5a623" : grade > 0.4 ? "#c8741a" : "#5a3a18",
          });
        }
      }
    }
    return arr;
  }, [verticalExaggeration]);

  return (
    <group>
      {/* Terreno */}
      <mesh geometry={terrainGeo} receiveShadow>
        <meshStandardMaterial color="#6b5a44" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* Anomalía esférica */}
      <mesh position={[60, -80 * verticalExaggeration, -40]}>
        <sphereGeometry args={[90, 24, 24]} />
        <meshStandardMaterial
          color="#ffaa33"
          emissive="#882200"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>

      {/* Sondajes demo */}
      {holes.map((h, i) => {
        const azRad = (h.az * Math.PI) / 180;
        const length = h.depth * verticalExaggeration;
        const dir = new THREE.Vector3(Math.sin(azRad), -1, -Math.cos(azRad)).normalize();
        const mid = new THREE.Vector3(h.x, h.y, -h.z).add(dir.clone().multiplyScalar(length / 2));
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const m = new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1));
        return (
          <mesh key={i} matrix={m} matrixAutoUpdate={false}>
            <cylinderGeometry args={[4, 4, length, 12]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
        );
      })}

      {/* Block model demo (instanced visual sin instancing por simplicidad) */}
      {blocks.map((b, i) => (
        <mesh key={i} position={b.p}>
          <boxGeometry args={[50, 50, 50]} />
          <meshStandardMaterial color={b.c} />
        </mesh>
      ))}

      {/* Etiqueta inferida visual via mesh plana */}
      <mesh position={[0, 250, 0]}>
        <ringGeometry args={[140, 150, 32]} />
        <meshBasicMaterial color="#22d3ee" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

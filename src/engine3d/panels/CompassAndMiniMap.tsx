// Brújula reactiva + Mini-mapa cenital sincronizados con la cámara R3F.
// - CameraOrientationTracker: corre dentro del Canvas, reporta azimut + posición XZ.
// - CompassRose: rosa de los vientos DOM que rota según azimut de cámara.
// - MiniMap: SVG cenital con extent del proyecto, collares, pit shells y FOV de cámara.
import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type CameraOrientation = {
  azimuthDeg: number; // 0 = norte (eje -Z en three), CW positivo
  cameraXZ: { x: number; z: number };
  targetXZ: { x: number; z: number };
};

type TrackerProps = {
  onUpdate: (o: CameraOrientation) => void;
};

/** Reporta orientación de cámara hacia el HUD DOM. Corre dentro de <Canvas>. */
export function CameraOrientationTracker({ onUpdate }: TrackerProps) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target?: THREE.Vector3 } | null;
  const last = useRef<number>(0);

  useFrame(() => {
    const now = performance.now();
    if (now - last.current < 80) return; // ~12Hz suficiente para HUD
    last.current = now;
    const tgt = controls?.target ?? new THREE.Vector3(0, 0, 0);
    const dx = camera.position.x - tgt.x;
    const dz = camera.position.z - tgt.z;
    // Azimut: ángulo del vector cámara→target en plano XZ.
    // North = -Z en nuestro mapeo ENU→three (y = -y). atan2 con (x, -z).
    const az = (Math.atan2(-dx, dz) * 180) / Math.PI;
    const azimuthDeg = (az + 360) % 360;
    onUpdate({
      azimuthDeg,
      cameraXZ: { x: camera.position.x, z: camera.position.z },
      targetXZ: { x: tgt.x, z: tgt.z },
    });
  });

  useEffect(() => () => undefined, []);
  return null;
}

type CompassProps = {
  azimuthDeg: number;
};

/** Rosa de los vientos: la aguja roja apunta al norte mientras gira el mundo. */
export function CompassRose({ azimuthDeg }: CompassProps) {
  // El dial rota -azimut para que la N siempre apunte al norte real.
  const dialRotation = -azimuthDeg;
  return (
    <div className="absolute bottom-3 right-3 z-10 select-none">
      <div className="relative w-16 h-16 rounded-full bg-black/70 backdrop-blur border border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.25)]">
        <svg
          viewBox="-50 -50 100 100"
          className="absolute inset-0 w-full h-full"
          style={{ transform: `rotate(${dialRotation}deg)`, transition: "transform 90ms linear" }}
        >
          {/* tickmarks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 360) / 12;
            const major = i % 3 === 0;
            const r1 = major ? 36 : 40;
            const r2 = 46;
            const rad = (a * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={r1 * Math.sin(rad)}
                y1={-r1 * Math.cos(rad)}
                x2={r2 * Math.sin(rad)}
                y2={-r2 * Math.cos(rad)}
                stroke={major ? "#67e8f9" : "#475569"}
                strokeWidth={major ? 1.5 : 0.8}
              />
            );
          })}
          {/* aguja N (roja) / S (gris) */}
          <polygon points="0,-32 5,0 0,6 -5,0" fill="#ef4444" />
          <polygon points="0,32 5,0 0,-6 -5,0" fill="#64748b" />
          <circle cx={0} cy={0} r={3} fill="#0f172a" stroke="#67e8f9" strokeWidth={1} />
          {/* letras cardinales */}
          <text x={0} y={-38} textAnchor="middle" fontSize={9} fill="#ef4444" fontFamily="monospace" fontWeight={700}>N</text>
          <text x={38} y={3} textAnchor="middle" fontSize={8} fill="#cbd5e1" fontFamily="monospace">E</text>
          <text x={0} y={43} textAnchor="middle" fontSize={8} fill="#cbd5e1" fontFamily="monospace">S</text>
          <text x={-38} y={3} textAnchor="middle" fontSize={8} fill="#cbd5e1" fontFamily="monospace">W</text>
        </svg>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-mono text-cyan-300/80">
          {azimuthDeg.toFixed(0)}°
        </div>
      </div>
    </div>
  );
}

type Collar = { x: number; y: number; z?: number };
type ShellOutline = { points: Array<{ x: number; y: number }> };

type MiniMapProps = {
  extentMeters: number; // semi-extent (ej 4000) — el mapa cubre [-extent, +extent]
  orientation: CameraOrientation;
  drillCollars?: Collar[];
  pitShells?: ShellOutline[];
  // Si se da, agrega un texto centro
  label?: string;
};

/** Mini-mapa cenital 2D con FOV de cámara, collares y pit shell. */
export function MiniMap({ extentMeters, orientation, drillCollars = [], pitShells = [], label }: MiniMapProps) {
  const size = 144;
  const scale = (size / 2) / extentMeters; // unidades de mundo → px
  // En three: x→este, z→sur (porque mapeamos y_enu→-z). Mini-mapa con norte arriba.
  // Pasamos (x_world, z_world) → svg: (x_world * scale, z_world * scale)
  const camX = orientation.cameraXZ.x * scale;
  const camY = orientation.cameraXZ.z * scale;
  const tgtX = orientation.targetXZ.x * scale;
  const tgtY = orientation.targetXZ.z * scale;
  // Vector cámara→target define dirección de mirada
  const dx = tgtX - camX;
  const dy = tgtY - camY;
  const lookLen = Math.hypot(dx, dy) || 1;
  const dirX = dx / lookLen;
  const dirY = dy / lookLen;
  const fov = 35; // grados a cada lado
  const fovRad = (fov * Math.PI) / 180;
  const cos = Math.cos(fovRad);
  const sin = Math.sin(fovRad);
  const ray = 80;
  const leftX = camX + (dirX * cos - dirY * sin) * ray;
  const leftY = camY + (dirX * sin + dirY * cos) * ray;
  const rightX = camX + (dirX * cos + dirY * sin) * ray;
  const rightY = camY + (dirX * -sin + dirY * cos) * ray;

  return (
    <div className="absolute top-3 right-3 z-10 select-none pointer-events-none">
      <div className="rounded-lg bg-black/75 backdrop-blur border border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.2)] p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-mono text-cyan-300/80 uppercase tracking-wider">Mini-mapa</span>
          <span className="text-[9px] font-mono text-foreground/60">{(extentMeters / 1000).toFixed(1)} km</span>
        </div>
        <svg
          viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
          width={size}
          height={size}
          className="block"
        >
          {/* fondo grilla */}
          <rect x={-size / 2} y={-size / 2} width={size} height={size} fill="#020617" stroke="#0e7490" strokeWidth={0.5} />
          {Array.from({ length: 5 }).map((_, i) => {
            const off = -size / 2 + ((i + 1) * size) / 6;
            return (
              <g key={i}>
                <line x1={off} y1={-size / 2} x2={off} y2={size / 2} stroke="#0e7490" strokeOpacity={0.25} strokeWidth={0.3} />
                <line x1={-size / 2} y1={off} x2={size / 2} y2={off} stroke="#0e7490" strokeOpacity={0.25} strokeWidth={0.3} />
              </g>
            );
          })}
          {/* cruz norte */}
          <line x1={0} y1={-size / 2 + 4} x2={0} y2={-size / 2 + 12} stroke="#ef4444" strokeWidth={1.2} />
          <text x={0} y={-size / 2 + 22} textAnchor="middle" fontSize={8} fill="#ef4444" fontFamily="monospace" fontWeight={700}>N</text>

          {/* pit shells (outline simplificado) */}
          {pitShells.map((sh, i) => {
            if (sh.points.length < 3) return null;
            const d = sh.points
              .map((p, k) => `${k === 0 ? "M" : "L"} ${(p.x * scale).toFixed(1)} ${(-p.y * scale).toFixed(1)}`)
              .join(" ") + " Z";
            return <path key={i} d={d} fill="none" stroke="#fbbf24" strokeWidth={0.8} strokeOpacity={0.7} />;
          })}

          {/* collares */}
          {drillCollars.slice(0, 400).map((c, i) => {
            const px = c.x * scale;
            const py = -c.y * scale; // y_world→up en mapa (norte arriba)
            if (Math.abs(px) > size / 2 || Math.abs(py) > size / 2) return null;
            return <circle key={i} cx={px} cy={py} r={1.2} fill="#22d3ee" fillOpacity={0.8} />;
          })}

          {/* target */}
          <circle cx={tgtX} cy={tgtY} r={2.5} fill="none" stroke="#a7f3d0" strokeWidth={1} />
          <circle cx={tgtX} cy={tgtY} r={0.8} fill="#a7f3d0" />

          {/* FOV de cámara */}
          <path
            d={`M ${camX.toFixed(1)} ${camY.toFixed(1)} L ${leftX.toFixed(1)} ${leftY.toFixed(1)} L ${rightX.toFixed(1)} ${rightY.toFixed(1)} Z`}
            fill="#22d3ee"
            fillOpacity={0.15}
            stroke="#22d3ee"
            strokeWidth={0.8}
          />
          {/* cámara */}
          <circle cx={camX} cy={camY} r={2.2} fill="#22d3ee" stroke="#0f172a" strokeWidth={0.8} />
        </svg>
        {label && <div className="mt-1 text-[9px] font-mono text-foreground/60 text-center truncate">{label}</div>}
      </div>
    </div>
  );
}

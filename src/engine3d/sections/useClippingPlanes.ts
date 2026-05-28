// Hook para gestionar planos de corte (clipping) X/Y/Z + libre.
// Devuelve un array estable de THREE.Plane que se pasa a materiales.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type ClipAxis = "x" | "y" | "z" | "free";

export type ClipParams = {
  enabled: boolean;
  axis: ClipAxis;
  /** Posición del plano a lo largo de su normal, en unidades de escena (m). */
  position: number;
  /** Invierte el lado recortado. */
  invert: boolean;
  /** Sólo para axis="free": normal personalizada (será normalizada). */
  freeNormal?: { x: number; y: number; z: number };
};

export const DEFAULT_CLIP_PARAMS: ClipParams = {
  enabled: false,
  axis: "z",
  position: 0,
  invert: false,
  freeNormal: { x: 1, y: 0, z: 0 },
};

/** Devuelve la normal del plano según el eje en coordenadas three.js (Y=up). */
function axisNormal(axis: ClipAxis, free: ClipParams["freeNormal"]): THREE.Vector3 {
  switch (axis) {
    case "x":
      return new THREE.Vector3(1, 0, 0);
    case "y":
      // En three Y es altura → corte horizontal (profundidad)
      return new THREE.Vector3(0, 1, 0);
    case "z":
      // Norte/Sur en ENU rota a Z en three. Usamos Z para "N-S".
      return new THREE.Vector3(0, 0, 1);
    case "free":
      return new THREE.Vector3(free?.x ?? 1, free?.y ?? 0, free?.z ?? 0).normalize();
  }
}

export function useClippingPlanes(params: ClipParams): THREE.Plane[] {
  // Mantenemos una sola instancia de Plane y mutamos para no romper memo de materiales.
  const planeRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  useEffect(() => {
    const n = axisNormal(params.axis, params.freeNormal);
    if (params.invert) n.multiplyScalar(-1);
    // constant = -n·p donde p es un punto del plano = n * position
    planeRef.current.set(n, -params.position);
  }, [params.axis, params.position, params.invert, params.freeNormal]);

  return useMemo(
    () => (params.enabled ? [planeRef.current] : []),
    [params.enabled, params.axis, params.position, params.invert, params.freeNormal],
  );
}

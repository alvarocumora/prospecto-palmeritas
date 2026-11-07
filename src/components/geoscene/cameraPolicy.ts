import type { ProjectView } from "@/lib/projects/navigation";

/** Camera-only switch: never resets center, zoom or the layer selection. */
export function projectCamera(view: ProjectView) {
  return view === "2d" ? { pitch: 0, bearing: 0 } : { pitch: 55, bearing: -20 };
}

/**
 * Vistas predefinidas estilo "cubo de orientación" minero (gizmo), para
 * orientarse rápido en la escena 3D sin perder el centro ni el zoom.
 * "Sección N"/"Sección E" son una aproximación con el pitch máximo que
 * soporta MapLibre (80°, no hay cámara libre a 90° real mirando al
 * horizonte): miran hacia el norte o el este respectivamente, no son un
 * corte real a lo largo del rumbo de una estructura.
 */
export type MiningViewPreset = "plan" | "isometric" | "section_n" | "section_e";

export const MINING_VIEW_LABEL: Record<MiningViewPreset, string> = {
  plan: "Planta",
  isometric: "Isométrica",
  section_n: "Sección N",
  section_e: "Sección E",
};

export function miningViewCamera(preset: MiningViewPreset): { pitch: number; bearing: number } {
  switch (preset) {
    case "plan":
      return { pitch: 0, bearing: 0 };
    case "isometric":
      return { pitch: 55, bearing: -20 };
    case "section_n":
      return { pitch: 80, bearing: 0 };
    case "section_e":
      return { pitch: 80, bearing: 90 };
  }
}

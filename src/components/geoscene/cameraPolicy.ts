import type { ProjectView } from "@/lib/projects/navigation";

/** Camera-only switch: never resets center, zoom or the layer selection. */
export function projectCamera(view: ProjectView) {
  return view === "2d" ? { pitch: 0, bearing: 0 } : { pitch: 55, bearing: -20 };
}

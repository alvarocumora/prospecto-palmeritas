// Worker: ejecuta computeSection fuera del main thread.
// Se usa cuando el mesh isosurface supera 100k triángulos para no
// bloquear el render.
import { computeSection, type SectionInput, type SectionResult } from "@/engine3d/sections/sectionEngine";

self.addEventListener("message", (ev: MessageEvent<SectionInput>) => {
  const out: SectionResult = computeSection(ev.data);
  (self as unknown as Worker).postMessage(out);
});

export {};

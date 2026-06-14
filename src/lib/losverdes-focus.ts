// Bus de selección entre el visor 3D (LosVerdesScene3D) y el mapa de campo (FieldMapPublic).
// Cualquier vista emite `losverdes:focus` con kind+id+coords; el resto escucha y resalta.
export type LosVerdesFocusKind = "target" | "sat" | "mag";

export interface LosVerdesFocusDetail {
  kind: LosVerdesFocusKind;
  id: string;
  label?: string;
  lat: number;
  lng: number;
  source: "scene3d" | "fieldmap";
}

export const LOSVERDES_FOCUS_EVENT = "losverdes:focus";

export function emitLosVerdesFocus(detail: LosVerdesFocusDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<LosVerdesFocusDetail>(LOSVERDES_FOCUS_EVENT, { detail }));
}

export function onLosVerdesFocus(handler: (d: LosVerdesFocusDetail) => void) {
  if (typeof window === "undefined") return () => {};
  const fn = (e: Event) => handler((e as CustomEvent<LosVerdesFocusDetail>).detail);
  window.addEventListener(LOSVERDES_FOCUS_EVENT, fn);
  return () => window.removeEventListener(LOSVERDES_FOCUS_EVENT, fn);
}

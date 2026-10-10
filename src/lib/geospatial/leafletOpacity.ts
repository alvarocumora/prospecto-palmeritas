import type { Layer } from "leaflet";

type StyledLayer = Layer & {
  options?: { opacity?: number; fillOpacity?: number };
  eachLayer?: (callback: (layer: Layer) => void) => void;
  setStyle?: (style: { opacity: number; fillOpacity: number }) => void;
  setOpacity?: (opacity: number) => void;
};
const original = new WeakMap<Layer, { opacity: number; fillOpacity: number }>();

/** Scale each original style rather than making translucent fills opaque. */
export function applyLayerOpacity(layer: Layer, factor: number): void {
  const styled = layer as StyledLayer;
  if (styled.eachLayer) {
    styled.eachLayer((child) => applyLayerOpacity(child, factor));
    return;
  }
  let baseline = original.get(layer);
  if (!baseline) {
    baseline = {
      opacity: styled.options?.opacity ?? 1,
      fillOpacity: styled.options?.fillOpacity ?? 0.2,
    };
    original.set(layer, baseline);
  }
  const amount = Number.isFinite(factor) ? Math.max(0, Math.min(1, factor)) : 1;
  if (styled.setStyle) {
    styled.setStyle({ opacity: baseline.opacity * amount, fillOpacity: baseline.fillOpacity * amount });
  } else if (styled.setOpacity) {
    styled.setOpacity(baseline.opacity * amount);
  }
}

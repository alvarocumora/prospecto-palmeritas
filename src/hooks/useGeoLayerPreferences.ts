import { useEffect, useRef, useState } from "react";
import { parseLayerPreferences, preferenceLayerId } from "@/lib/geospatial/layerPreferences";

function read(namespace: string | null) {
  if (!namespace || typeof window === "undefined") return {};
  try {
    return parseLayerPreferences(window.localStorage.getItem(`geo-layer-preferences:${namespace}`));
  } catch {
    return {};
  }
}

/** Canonical IDs retain project-specific layer choices across 2D/3D and SSR hydration. */
export function useGeoLayerPreferences<T extends string>(
  namespace: string | null,
  initial: Record<T, boolean>,
) {
  const initialRef = useRef(initial);
  const [visible, setVisible] = useState<Record<T, boolean>>(initial);
  const [opacity, setOpacity] = useState<Partial<Record<T, number>>>({});
  const [loadedNamespace, setLoadedNamespace] = useState<string | null>();
  useEffect(() => {
    const saved = read(namespace);
    setVisible(Object.fromEntries(
      Object.entries(initialRef.current).map(([key, value]) =>
        [key, saved[preferenceLayerId(key)]?.visible ?? value]),
    ) as Record<T, boolean>);
    setOpacity(Object.fromEntries(
      Object.keys(initialRef.current).map((key) =>
        [key, saved[preferenceLayerId(key)]?.opacity ?? 1]),
    ) as Partial<Record<T, number>>);
    setLoadedNamespace(namespace);
  }, [namespace]);
  useEffect(() => {
    if (!namespace || loadedNamespace !== namespace || typeof window === "undefined") return;
    try {
      const next = read(namespace);
      for (const key of Object.keys(visible) as T[]) {
        next[preferenceLayerId(key)] = { visible: visible[key], opacity: opacity[key] ?? 1 };
      }
      window.localStorage.setItem(`geo-layer-preferences:${namespace}`, JSON.stringify(next));
    } catch {
      // Viewer controls remain available when storage is disabled.
    }
  }, [namespace, loadedNamespace, visible, opacity]);
  return { visible, setVisible, opacity, setOpacity };
}

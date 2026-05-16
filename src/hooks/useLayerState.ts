import { useCallback, useEffect, useState } from "react";

export type LayerState = {
  visible: boolean;
  opacity: number; // 0..1
};

export type LayerStateMap = Record<string, LayerState>;

const STORAGE_KEY = "map:layer-state:v1";

function readStorage(): LayerStateMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LayerStateMap) : {};
  } catch {
    return {};
  }
}

function writeStorage(state: LayerStateMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function useLayerState(defaults: LayerStateMap) {
  const [state, setState] = useState<LayerStateMap>(() => {
    const stored = readStorage();
    return { ...defaults, ...stored };
  });

  useEffect(() => {
    writeStorage(state);
  }, [state]);

  const setVisible = useCallback((id: string, visible: boolean) => {
    setState((s) => ({ ...s, [id]: { ...(s[id] ?? { opacity: 1, visible: true }), visible } }));
  }, []);

  const setOpacity = useCallback((id: string, opacity: number) => {
    setState((s) => ({
      ...s,
      [id]: {
        ...(s[id] ?? { visible: true, opacity: 1 }),
        opacity: Math.max(0, Math.min(1, opacity)),
      },
    }));
  }, []);

  const ensure = useCallback((id: string, init: LayerState) => {
    setState((s) => (s[id] ? s : { ...s, [id]: init }));
  }, []);

  return { state, setVisible, setOpacity, ensure };
}

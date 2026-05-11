import { useCallback, useEffect, useState, type RefObject } from "react";
import type { Map as LeafletMap } from "leaflet";

type UseFullscreenMapParams = {
  wrapperRef: RefObject<HTMLElement | null>;
  mapRef: RefObject<LeafletMap | null>;
};

export function useFullscreenMap({ wrapperRef, mapRef }: UseFullscreenMapParams) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(async () => {
    const element = wrapperRef.current;
    if (!element) return;

    if (!document.fullscreenElement) {
      await element.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }, [wrapperRef]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const nextIsFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(nextIsFullscreen);
      window.setTimeout(() => mapRef.current?.invalidateSize(), 200);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [mapRef]);

  return { isFullscreen, toggleFullscreen };
}

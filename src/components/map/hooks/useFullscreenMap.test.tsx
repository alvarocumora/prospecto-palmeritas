import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFullscreenMap } from "./useFullscreenMap";

describe("useFullscreenMap", () => {
  it("invalidates map size after fullscreen changes", () => {
    vi.useFakeTimers();

    const invalidateSize = vi.fn();
    const wrapper = document.createElement("div");
    const wrapperRef = { current: wrapper };
    const mapRef = { current: { invalidateSize } };

    renderHook(() => useFullscreenMap({ wrapperRef, mapRef: mapRef as never }));

    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
      vi.advanceTimersByTime(200);
    });

    expect(invalidateSize).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("requests fullscreen when not already fullscreen", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const wrapper = document.createElement("div");
    Object.defineProperty(wrapper, "requestFullscreen", { value: requestFullscreen });

    const { result } = renderHook(() =>
      useFullscreenMap({ wrapperRef: { current: wrapper }, mapRef: { current: null } })
    );

    await act(async () => {
      await result.current.toggleFullscreen();
    });

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});

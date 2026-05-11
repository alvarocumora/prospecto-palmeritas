# ProjectMap hook wiring guide

This document describes the exact low-risk wiring needed to connect the ProjectMap hook foundation into `src/components/ProjectMap.tsx`.

The hooks already exist and are tested:

- `src/components/map/hooks/useBasemapOverride.ts`
- `src/components/map/hooks/useFullscreenMap.ts`

## Goal

Replace local inline logic in `ProjectMap.tsx` with the extracted hooks without changing runtime behavior.

## 1. Add imports

In `src/components/ProjectMap.tsx`, add:

```ts
import { useBasemapOverride, useFullscreenMap } from "./map/hooks";
```

## 2. Remove local fullscreen state

Find this state declaration:

```ts
const [isFullscreen, setIsFullscreen] = useState(false);
```

Remove it.

## 3. Wire `useBasemapOverride`

Find the existing inline effect:

```ts
// External basemap override (used by NI 43-101 report capture).
// Switches Esri Imagery / Esri Topo while hiding the other basemaps.
useEffect(() => {
  if (!basemapOverride) return;
  if (basemapOverride === "satellite") {
    setVisible("basemap:esri-imagery", true);
    setVisible("basemap:esri-topo", false);
    setVisible("basemap:carto-dark", false);
    setVisible("basemap:opentopo", false);
  } else {
    setVisible("basemap:esri-topo", true);
    setVisible("basemap:esri-imagery", false);
    setVisible("basemap:carto-dark", false);
    setVisible("basemap:opentopo", false);
  }
}, [basemapOverride, setVisible]);
```

Replace it with:

```ts
useBasemapOverride({ basemapOverride, setVisible });
```

## 4. Wire `useFullscreenMap`

Find the existing local fullscreen block:

```ts
// Fullscreen toggle
const toggleFullscreen = useCallback(async () => {
  const el = wrapperRef.current;
  if (!el) return;
  if (!document.fullscreenElement) {
    await el.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
}, []);

useEffect(() => {
  const handler = () => {
    const fs = !!document.fullscreenElement;
    setIsFullscreen(fs);
    setTimeout(() => mapRef.current?.invalidateSize(), 200);
  };
  document.addEventListener("fullscreenchange", handler);
  return () => document.removeEventListener("fullscreenchange", handler);
}, []);
```

Replace it with:

```ts
const { isFullscreen, toggleFullscreen } = useFullscreenMap({ wrapperRef, mapRef });
```

## 5. Expected behavior

No user-facing behavior should change.

- Basemap override should still switch to Esri Imagery for `satellite`.
- Basemap override should still switch to Esri Topo for `topo`.
- Fullscreen button should still enter/exit fullscreen.
- Map size should still invalidate after `fullscreenchange`.

## 6. Validation

Run:

```bash
npm run validate
```

At minimum, run:

```bash
npm run typecheck
npm run test
```

## 7. Notes

The connector returned `ProjectMap.tsx` truncated because the file is very large. Avoid applying this change through partial text replacement unless the full file is available locally. The safest implementation path is a local editor or patch-capable tool.


Add a second column to `StripLog` showing lithology, color-coded by lithology code, side-by-side with the Au heat column for visual grade-vs-rock comparison.

## Approach

Add a lithology column (same height/scale as Au column) to the right of the Au strip. Color each interval by a deterministic mapping of common lithology codes (granite, andesite, breccia, vein, etc.) with a fallback hash-based color for unknowns. Include short code labels inside bars when tall enough.

### Lithology color palette (geology-conventional)
- `granite` / `granito` → `#fcd9b6` (pink-tan)
- `andesite` / `andesita` → `#7c8a99` (slate)
- `basalt` / `basalto` → `#3d3d3d` (dark gray)
- `rhyolite` / `riolita` → `#e8a598` (salmon)
- `dacite` / `dacita` → `#b89968` (tan)
- `diorite` / `diorita` → `#5a6b7a` (blue-gray)
- `breccia` / `brecha` → `#a0522d` (sienna)
- `vein` / `veta` / `vetilla` → `#fbbf24` (amber — quartz/sulfide)
- `skarn` → `#84cc16` (lime)
- `shale` / `lutita` → `#4a5568` (dark slate)
- `sandstone` / `arenisca` → `#f5d491` (sand)
- `limestone` / `caliza` → `#e8e0d0` (cream)
- `tuff` / `toba` → `#d4b8a8` (dusty rose)
- unknown → hash-derived HSL (stable per string)
- null/empty → muted gray

### Layout changes (StripLog.tsx)
```
[depth axis 28px] [Au col 36px] [Litho col 48px] [legend ~80px]
```
- Litho column shows abbreviation (first 3 letters uppercase) centered when bar height ≥ 14px
- Hover tooltip on litho bar shows full lithology + depth range
- Header labels above each column ("Au" / "Lito") replacing the inline `Au` legend label

### Legend restructure
Two compact legend stacks (Au + Lito) side by side, or stacked vertically. Keep current Au legend; add a second small Litho legend listing only the codes actually present in this hole (dynamic) — avoids clutter.

## Files
- **edit** `src/components/drilling/StripLog.tsx`:
  - Add `LITHOLOGY_COLORS` map + `lithoColor(code)` with hash fallback
  - Add second column rendering (same scale function)
  - Compute `presentLithos` via useMemo for dynamic legend
  - Restructure legend into two compact sections
  - Adjust outer container width

No DB / no deps / no other files touched.

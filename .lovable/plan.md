
Add click-to-scroll: clicking a bar in StripLog scrolls the matching table row into view and briefly highlights it.

## Files
- **edit** `src/components/drilling/StripLog.tsx`: add optional `onSelect?: (id: string) => void` prop; wire `onClick` on Au/Lito/Alt bars
- **edit** `src/components/drilling/CoreLogPanel.tsx`: add `rowRefs` map, pass `onSelect={scrollToRow}` to StripLog, set `ref` + `data-row-id` on each `<tr>`, scroll into view with `block: "center"` and a brief `bg-primary/20` flash via `flashId` state

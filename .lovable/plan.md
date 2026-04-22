

# Plan: In-drawer file previews (PDF + image)

Add an inline preview viewer to `ConcessionFilesPanel` so users can tap a file row and see PDFs/images directly in the drawer without downloading.

## Changes

### 1. New component: `src/components/ops/FilePreviewModal.tsx`

Full-screen modal (mobile-first, with desktop centered variant) that renders:
- **Image files** (`png|jpe?g|webp|heic`): `<img>` with `object-contain`, max-h 90vh, pinch/zoom via native browser, dark backdrop.
- **PDF files**: `<iframe src={signedUrl}>` filling 90vh — uses browser's native PDF viewer (works on Chrome, Safari, Firefox, mobile Safari).
- **Unsupported types**: fallback message + "Abrir / Descargar" button.
- **Header**: file name (truncated), type badge, close button (X), and a "Descargar" link as escape hatch.
- **Loading state**: spinner while signed URL is being generated.
- **Swipe-down to close** on mobile (reuse pattern from `ConcessionDetailDrawer`: pointer events + translateY transform + 120px threshold).
- **Esc key** to close on desktop.
- Dark backdrop with `backdrop-blur-sm`, click-outside closes.

Props:
```ts
{ file: { file_path: string; file_name: string; file_type: string } | null;
  getDownloadUrl: (path: string) => Promise<string | null>;
  onClose: () => void; }
```

### 2. Update `src/components/ops/ConcessionFilesPanel.tsx`

- Add `previewing` state (`useState<HolderFile | null>(null)` style, but typed for `ConcessionFile`).
- Wrap the file name + icon area of each row in a `<button>` that calls `setPreviewing(f)` for previewable types (PDF, png, jpg, webp). Keep the standalone Download/Trash icon buttons untouched on the right.
- Add an `Eye` icon button (lucide) next to Download for explicit preview affordance — keeps discoverability obvious.
- Mount `<FilePreviewModal file={previewing} getDownloadUrl={getDownloadUrl} onClose={() => setPreviewing(null)} />` at the bottom of the panel.
- HEIC files: not natively viewable in browsers → fall back to "Descargar" message in the modal (no preview attempt).

### 3. Reuse for holder files (parity)

`HolderFilesPanel` (existing, similar shape) already renders the same row pattern. Apply identical changes there so behavior is consistent across Concession and Holder file panels. Both use the same `FilePreviewModal` component.

## Technical details

- **No new dependencies**. Uses native `<img>` and `<iframe>` for PDFs (browser built-in viewer). No PDF.js bundle needed.
- **Signed URLs**: reuse existing `getDownloadUrl()` (10-min TTL) — generated lazily when modal opens to avoid wasting signatures on rows that are never previewed.
- **Storage**: no DB or bucket changes. `concession-files` and `holder-files` buckets stay private; signed URLs handle access.
- **Accessibility**: modal gets `role="dialog"`, `aria-modal="true"`, `aria-label={file.file_name}`. Close button has `aria-label="Cerrar previsualización"`.
- **Performance**: iframe/img only mounts when `previewing !== null`, unmounts on close to free memory.
- **Type safety**: verified with `tsc --noEmit` after changes.

## Result

Tapping a file row (or the new eye icon) opens a full-screen preview overlay inside the drawer flow — PDFs render in the browser's native viewer, images display fitted to viewport with pinch-zoom, and users can swipe down or tap X to dismiss without ever leaving the concession context. Download remains one tap away as a fallback.


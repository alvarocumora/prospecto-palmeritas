import html2canvas from "html2canvas-pro";

/**
 * Capture an element (typically the project map container) as a high-resolution JPEG data URL.
 * Returns null silently if capture fails so the PDF generation can continue.
 */
export async function captureElement(
  selector: string,
  opts: { scale?: number; bg?: string } = {},
): Promise<string | null> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  // Wait for tile/animation settle.
  await new Promise((r) => setTimeout(r, 600));
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: opts.bg ?? "#FAF7F2",
      scale: opts.scale ?? 2,
      useCORS: true,
      logging: false,
      windowWidth: el.scrollWidth,
    });
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch (err) {
    console.warn("[pdf] capture failed:", err);
    return null;
  }
}

/**
 * Captures the mounted GeoScene viewer by compositing its WebGL canvases
 * (MapLibre + deck.gl, rendered with preserveDrawingBuffer). html2canvas
 * cannot read WebGL reliably, so this is the preferred path for the 3D viewer.
 */
export async function captureGeoScene(): Promise<string | null> {
  const root = document.querySelector<HTMLElement>("[data-geo-engine]");
  if (!root) return null;
  await new Promise((r) => setTimeout(r, 900));
  const canvases = Array.from(root.querySelectorAll("canvas")).filter((c) => c.width && c.height);
  if (!canvases.length) return null;
  const base = canvases.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  const out = document.createElement("canvas");
  out.width = base.width;
  out.height = base.height;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  try {
    ctx.fillStyle = "#F7F5F0";
    ctx.fillRect(0, 0, out.width, out.height);
    for (const c of canvases) ctx.drawImage(c, 0, 0, out.width, out.height);
    const url = out.toDataURL("image/jpeg", 0.9);
    // Reject a blank buffer (all one colour) so the renderer keeps its fallback.
    const px = ctx.getImageData(out.width / 2, out.height / 2, 1, 1).data;
    return px[0] === 247 && px[1] === 245 && px[2] === 240 ? null : url;
  } catch (err) {
    console.warn("[pdf] geoscene capture failed:", err);
    return null;
  }
}

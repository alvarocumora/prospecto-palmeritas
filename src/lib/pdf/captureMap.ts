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

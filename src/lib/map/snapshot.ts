import html2canvas from "html2canvas-pro";

export interface SnapshotOptions {
  /** Title printed in the top banner (e.g. project name). */
  title?: string;
  /** Subtitle printed under the title (e.g. campaign name + date). */
  subtitle?: string;
  /** Legend rows: { color, label } rendered as a vertical list. */
  legend?: Array<{ color: string; label: string }>;
  /** Output scale (1 = native, 2 = retina). */
  scale?: number;
  /** Background fallback for transparent areas. */
  bg?: string;
}

/**
 * Capture the Leaflet map container as a PNG and decorate it with a title
 * banner, legend card, north arrow, and a footer with the date / scale bar
 * (Leaflet's own scale control is captured along with the map).
 *
 * Returns a data URL (image/png) ready to download or embed in reports.
 */
export async function captureMapSnapshot(
  containerSelector = "[data-export-map]",
  opts: SnapshotOptions = {},
): Promise<string | null> {
  const el = document.querySelector<HTMLElement>(containerSelector);
  if (!el) return null;

  // Allow tiles + canvas overlays to settle.
  await new Promise((r) => setTimeout(r, 700));

  let mapCanvas: HTMLCanvasElement;
  try {
    mapCanvas = await html2canvas(el, {
      backgroundColor: opts.bg ?? "#0A0A0A",
      scale: opts.scale ?? 2,
      useCORS: true,
      logging: false,
      windowWidth: el.scrollWidth,
    });
  } catch (err) {
    console.warn("[snapshot] html2canvas failed:", err);
    return null;
  }

  const w = mapCanvas.width;
  const h = mapCanvas.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return mapCanvas.toDataURL("image/png");

  ctx.drawImage(mapCanvas, 0, 0);

  const dpi = opts.scale ?? 2;
  const pad = 16 * dpi;
  const fontHeader = `${14 * dpi}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const fontTitle = `bold ${18 * dpi}px ui-sans-serif, system-ui, sans-serif`;
  const fontSub = `${12 * dpi}px ui-monospace, monospace`;
  const fontSmall = `${11 * dpi}px ui-monospace, monospace`;

  // ---- Top banner (title + subtitle) ------------------------------------
  if (opts.title || opts.subtitle) {
    const bannerH = (opts.subtitle ? 56 : 38) * dpi;
    ctx.fillStyle = "rgba(10,10,10,0.78)";
    roundRect(ctx, pad, pad, w - pad * 2, bannerH, 8 * dpi);
    ctx.fill();
    ctx.fillStyle = "#D4A24C";
    ctx.font = fontTitle;
    ctx.textBaseline = "top";
    ctx.fillText(opts.title ?? "", pad + 14 * dpi, pad + 8 * dpi);
    if (opts.subtitle) {
      ctx.fillStyle = "#E5E5E5";
      ctx.font = fontSub;
      ctx.fillText(opts.subtitle, pad + 14 * dpi, pad + 30 * dpi);
    }
  }

  // ---- Legend (top-right card) -----------------------------------------
  if (opts.legend && opts.legend.length > 0) {
    ctx.font = fontSmall;
    const rowH = 16 * dpi;
    const swatch = 10 * dpi;
    const innerPad = 10 * dpi;
    const titleH = 16 * dpi;
    const widths = opts.legend.map((l) => ctx.measureText(l.label).width);
    const cardW = Math.max(120 * dpi, Math.max(...widths) + swatch + innerPad * 2 + 8 * dpi);
    const cardH = innerPad * 2 + titleH + opts.legend.length * rowH;
    const cardX = w - pad - cardW;
    const cardY = pad + (opts.title ? 70 * dpi : 0);

    ctx.fillStyle = "rgba(10,10,10,0.82)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 8 * dpi);
    ctx.fill();
    ctx.strokeStyle = "rgba(212,162,76,0.4)";
    ctx.lineWidth = 1 * dpi;
    ctx.stroke();

    ctx.fillStyle = "#D4A24C";
    ctx.font = `bold ${11 * dpi}px ui-monospace, monospace`;
    ctx.textBaseline = "top";
    ctx.fillText("LEYENDA", cardX + innerPad, cardY + innerPad);

    ctx.font = fontSmall;
    opts.legend.forEach((row, i) => {
      const y = cardY + innerPad + titleH + i * rowH;
      ctx.fillStyle = row.color;
      ctx.beginPath();
      ctx.arc(cardX + innerPad + swatch / 2, y + swatch / 2 + 1 * dpi, swatch / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1 * dpi;
      ctx.stroke();
      ctx.fillStyle = "#F5F5F5";
      ctx.fillText(row.label, cardX + innerPad + swatch + 8 * dpi, y);
    });
  }

  // ---- North arrow (bottom-right above footer) -------------------------
  const naSize = 44 * dpi;
  const naX = w - pad - naSize;
  const naY = h - pad - 32 * dpi - naSize - 8 * dpi;
  ctx.fillStyle = "rgba(10,10,10,0.78)";
  roundRect(ctx, naX, naY, naSize, naSize, 6 * dpi);
  ctx.fill();
  ctx.strokeStyle = "rgba(212,162,76,0.5)";
  ctx.lineWidth = 1 * dpi;
  ctx.stroke();
  // Arrow
  const cx = naX + naSize / 2;
  const cy = naY + naSize / 2 + 2 * dpi;
  ctx.fillStyle = "#D4A24C";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14 * dpi);
  ctx.lineTo(cx - 7 * dpi, cy + 8 * dpi);
  ctx.lineTo(cx, cy + 3 * dpi);
  ctx.lineTo(cx + 7 * dpi, cy + 8 * dpi);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#F5F5F5";
  ctx.font = `bold ${10 * dpi}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("N", cx, naY + 3 * dpi);
  ctx.textAlign = "start";

  // ---- Footer banner (date + brand) ------------------------------------
  const footerH = 28 * dpi;
  const footerY = h - pad - footerH;
  ctx.fillStyle = "rgba(10,10,10,0.78)";
  roundRect(ctx, pad, footerY, w - pad * 2, footerH, 6 * dpi);
  ctx.fill();
  ctx.fillStyle = "#A1A1A1";
  ctx.font = fontHeader;
  ctx.textBaseline = "middle";
  const ts = new Date().toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  ctx.fillText(ts, pad + 12 * dpi, footerY + footerH / 2);
  ctx.textAlign = "right";
  ctx.fillStyle = "#D4A24C";
  ctx.fillText("GEOCAPITALS · Centro de Operaciones", w - pad - 12 * dpi, footerY + footerH / 2);
  ctx.textAlign = "start";

  return out.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

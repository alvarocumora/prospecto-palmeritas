import type jsPDF from 'jspdf';
import type { InvestorVisualSlide, ProjectDoc } from '../model';
import { GC_BRAND, GC_COLOR, GC_PAGE, type RGB } from '../brand/tokens';
import { fill, ink, font, brandQr, drawMark, stroke } from '../brand/kit';
import { IM_GOLD, IM_NAVY } from '../brand/institutional';

const PAPER: RGB = [247, 244, 238];
const CREAM: RGB = [236, 229, 214];

async function imageData(url: string, w: number, h: number): Promise<string> {
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; await img.decode();
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d'); if (!c) throw new Error('Image canvas unavailable');
  const contain = url.includes('plataforma');
  if (contain) { c.fillStyle = '#1E2533'; c.fillRect(0, 0, w, h); }
  const s = (contain ? Math.min : Math.max)(w / img.naturalWidth, h / img.naturalHeight);
  c.drawImage(img, (w - img.naturalWidth * s) / 2, (h - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  return canvas.toDataURL('image/jpeg', .86);
}

function lines(doc: jsPDF, text: string, w: number) { return doc.splitTextToSize(text, w) as string[]; }

/** Tamaño de fuente que hace caber `text` en `maxW` sin bajar de `min`. */
export function fitSize(doc: jsPDF, text: string, maxW: number, size: number, min = 12): number {
  let s = size;
  font(doc, 'display', 'bold', s);
  while (s > min && doc.getTextWidth(text) > maxW) { s -= 0.5; font(doc, 'display', 'bold', s); }
  return s;
}

/** Cifras de todas las columnas comparten un tamaño, ajustado a la más ancha. */
function statSize(doc: jsPDF, values: string[], colW: number, size: number) {
  return Math.min(...values.map(v => fitSize(doc, v, colW, size)));
}

/** Ficha de inversión estilo app: tarjeta navy con ronda, barra y valuación. */
function ficha(doc: jsPDF, x: number, y: number, f: NonNullable<InvestorVisualSlide['ficha']>) {
  const w = 250, h = 196;
  fill(doc, IM_NAVY); doc.roundedRect(x, y, w, h, 8, 8, 'F');
  font(doc, 'body', 'bold', 6.5); ink(doc, IM_GOLD); doc.text('FICHA DE INVERSIÓN', x + 18, y + 22, { charSpace: 0.8 });
  font(doc, 'display', 'bold', 17); ink(doc, PAPER); doc.text(lines(doc, f.project, w - 36)[0], x + 18, y + 44);
  font(doc, 'body', 'normal', 7.5); ink(doc, GC_COLOR.cobaltSoft); doc.text(f.commodity, x + 18, y + 57);
  font(doc, 'display', 'bold', 26); ink(doc, PAPER); doc.text('USD 1,5 M', x + 18, y + 90);
  fill(doc, [44, 72, 92]); doc.roundedRect(x + 18, y + 100, w - 36, 5, 2.5, 2.5, 'F');
  fill(doc, IM_GOLD); doc.roundedRect(x + 18, y + 100, (w - 36) * f.placement / 100, 5, 2.5, 2.5, 'F');
  font(doc, 'body', 'bold', 7.5); ink(doc, PAPER); doc.text(`${f.placement}% colocado*`, x + 18, y + 117);
  const cols: Array<[string, string]> = [['Acción', 'USD 100'], ['Mínimo', 'USD 15.000'], ['Valuación*', f.valuation]];
  cols.forEach(([k, v], i) => {
    const cx = x + 18 + i * 74;
    font(doc, 'body', 'normal', 6.2); ink(doc, GC_COLOR.cobaltSoft); doc.text(k, cx, y + 140);
    font(doc, 'body', 'bold', 8.6); ink(doc, PAPER); doc.text(v, cx, y + 153);
  });
  fill(doc, GC_COLOR.cobalt); doc.roundedRect(x + 18, y + 164, w - 36, 22, 4, 4, 'F');
  font(doc, 'body', 'bold', 8); ink(doc, GC_COLOR.white); doc.text(`Reservar · horizonte ${f.horizon}`, x + w / 2, y + 178.5, { align: 'center' });
}

function footer(doc: jsPDF, W: number, H: number, note: string, page: number, total: number, dark = false) {
  font(doc, 'body', 'normal', 7); ink(doc, dark ? CREAM : GC_COLOR.slate);
  const full = note + (note.includes('NI 43-101') ? '' : ' Sin recursos ni reservas certificados NI 43-101/JORC.');
  doc.text(lines(doc, '* ' + full, W - 120).slice(0, 3), 44, H - 28);
  font(doc, 'body', 'bold', 7); doc.text(`${String(page).padStart(2, '0')} / ${total}`, W - 44, H - 22, { align: 'right' });
}

/** Visual layout inside the canonical deck renderer, not a separate exporter. */
export async function renderVisualInvestorSlides(doc: jsPDF, model: ProjectDoc) {
  const slides = model.visualSlides ?? []; const { w: W, h: H } = GC_PAGE.deck;
  const split = 500; // ancho del panel de texto
  const urls = [...new Set(slides.map(s => s.image))];
  const images = new Map(await Promise.all(urls.map(async u => [u, { half: await imageData(u, 920, 1080), full: await imageData(u, 1920, 1080) }] as const)));
  const qr = await brandQr(model.liveUrl, 220);
  const total = slides.length;

  for (let i = 0; i < total; i++) {
    if (i > 0) doc.addPage([W, H], 'landscape');
    const s = slides[i]; const img = images.get(s.image)!;
    const last = i === total - 1;

    if (s.hero) {
      doc.addImage(img.full, 'JPEG', 0, 0, W, H, undefined, 'FAST');
      fill(doc, IM_NAVY); doc.setGState(new (doc as any).GState({ opacity: 0.82 })); doc.rect(0, 0, 600, H, 'F'); doc.setGState(new (doc as any).GState({ opacity: 1 }));
      const mw = drawMark(doc, 44, 40, 20); font(doc, 'body', 'bold', 10); ink(doc, PAPER); doc.text(GC_BRAND.name, 44 + mw + 8, 55, { charSpace: 1 });
      font(doc, 'body', 'bold', 8); ink(doc, IM_GOLD); doc.text(s.kicker.toUpperCase(), 44, 150, { charSpace: 1.2 });
      font(doc, 'display', 'bold', 46); ink(doc, PAPER); const t = lines(doc, s.title, 500); doc.text(t, 44, 196, { lineHeightFactor: 1.02 });
      let y = 196 + t.length * 47 + 6;
      font(doc, 'body', 'normal', 12); ink(doc, CREAM); const l = lines(doc, s.lead, 470); doc.text(l, 44, y); y += l.length * 16 + 34;
      {
        const cw = 512 / Math.max(1, s.stats.length);
        const fs = statSize(doc, s.stats.map(st => st.value), cw - 18, 26);
        s.stats.forEach((st, j) => {
          const x = 44 + j * cw; font(doc, 'display', 'bold', fs); ink(doc, PAPER); doc.text(st.value, x, y);
          font(doc, 'body', 'normal', 7.5); ink(doc, GC_COLOR.cobaltSoft); doc.text(lines(doc, st.label, cw - 18).slice(0, 2), x, y + 15);
        });
      }
      font(doc, 'body', 'normal', 8); ink(doc, CREAM); doc.text(s.items.map(it => `${it.title} — ${it.body}`), 44, y + 56, { lineHeightFactor: 1.6 });
      footer(doc, W, H, s.note, i + 1, total, true);
      continue;
    }

    // Panel editorial izquierdo + imagen a sangre derecha
    fill(doc, PAPER); doc.rect(0, 0, W, H, 'F');
    doc.addImage(img.half, 'JPEG', split, 0, W - split, H, undefined, 'FAST');
    fill(doc, IM_GOLD); doc.rect(split, 0, 3, H, 'F');
    const mw = drawMark(doc, 44, 30, 14); font(doc, 'body', 'bold', 7.5); ink(doc, IM_NAVY); doc.text(GC_BRAND.name, 44 + mw + 6, 41, { charSpace: 1 });
    font(doc, 'body', 'bold', 7.5); ink(doc, IM_GOLD); doc.text(s.kicker.toUpperCase(), 44, 92, { charSpace: 1 });
    font(doc, 'display', 'bold', 31); ink(doc, IM_NAVY); const t = lines(doc, s.title, 420); doc.text(t, 44, 128, { lineHeightFactor: 1.05 });
    let y = 128 + (t.length - 1) * 33 + 26;
    font(doc, 'body', 'normal', 10.5); ink(doc, GC_COLOR.inkSoft); const l = lines(doc, s.lead, 410); doc.text(l, 44, y, { lineHeightFactor: 1.4 }); y += l.length * 14.7 + 22;

    if (s.stats.length) {
      const sw = 420 / s.stats.length;
      const fs = statSize(doc, s.stats.map(st => st.value), sw - 22, s.stats.length > 2 ? 22 : 26);
      s.stats.forEach((st, j) => {
        const x = 44 + j * sw + (j > 0 ? 6 : 0);
        if (j > 0) { stroke(doc, CREAM); doc.setLineWidth(0.8); doc.line(x - 10, y - 20, x - 10, y + 22); }
        font(doc, 'display', 'bold', fs); ink(doc, GC_COLOR.cobalt); doc.text(st.value, x, y);
        font(doc, 'body', 'normal', 7.5); ink(doc, GC_COLOR.slate); doc.text(lines(doc, [st.label, st.note].filter(Boolean).join(' · '), sw - 22).slice(0, 2), x, y + 14);
      });
      y += 54;
    }
    const size = s.items.length > 3 ? 8.6 : 9.6;
    for (const [j, it] of s.items.entries()) {
      if (y > H - 80) break;
      fill(doc, IM_GOLD); doc.circle(48, y - 3, 2, 'F');
      font(doc, 'body', 'bold', size + 0.6); ink(doc, IM_NAVY); doc.text(lines(doc, it.title, 400)[0], 58, y);
      y += size + 4;
      font(doc, 'body', 'normal', size); ink(doc, GC_COLOR.inkSoft); const b = lines(doc, it.body, 396).slice(0, 3); doc.text(b, 58, y, { lineHeightFactor: 1.35 });
      y += b.length * size * 1.35 + (j < s.items.length - 1 ? 10 : 0);
    }

    // Rótulo de procedencia sobre la imagen
    font(doc, 'body', 'normal', 6); const lab = lines(doc, s.imageLabel, 300)[0]; const lw = doc.getTextWidth(lab) + 16;
    fill(doc, IM_NAVY); doc.rect(W - 24 - lw, H - 64, lw, 16, 'F'); ink(doc, PAPER); doc.text(lab, W - 24 - lw + 8, H - 53.5);

    if (s.ficha) ficha(doc, W - 24 - 250, 40, s.ficha);
    if (last) {
      fill(doc, GC_COLOR.white); doc.roundedRect(W - 190, 40, 166, 190, 8, 8, 'F');
      doc.addImage(qr, 'PNG', W - 172, 54, 130, 130); doc.link(W - 172, 54, 130, 130, { url: model.liveUrl });
      font(doc, 'body', 'bold', 8); ink(doc, IM_NAVY); doc.text('Escanea y reserva', W - 107, 202, { align: 'center' });
      font(doc, 'body', 'normal', 6.5); ink(doc, GC_COLOR.slate); doc.text(GC_BRAND.site, W - 107, 214, { align: 'center' });
    }
    stroke(doc, CREAM); doc.setLineWidth(0.6); doc.line(44, H - 38, split - 30, H - 38);
    footer(doc, split, H, s.note, i + 1, total);
  }
}

import type jsPDF from 'jspdf';
import type { ProjectDoc } from '../model';
import { GC_COLOR, GC_PAGE } from '../brand/tokens';
import { fill, ink, font, paragraph, brandQr } from '../brand/kit';
import { letterhead, section } from '../brand/institutional';

async function imageData(url: string): Promise<string> {
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; await img.decode();
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1200;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Image canvas unavailable');
  const scale = Math.max(1200/img.naturalWidth, 1200/img.naturalHeight);
  context.drawImage(img, (1200-img.naturalWidth*scale)/2, (1200-img.naturalHeight*scale)/2, img.naturalWidth*scale, img.naturalHeight*scale);
  return canvas.toDataURL('image/jpeg', .88);
}
/** Visual layout inside the canonical deck renderer, not a separate exporter. */
export async function renderVisualInvestorSlides(doc: jsPDF, model: ProjectDoc) {
  const slides = model.visualSlides ?? []; const f = GC_PAGE.deck;
  const urls = [...new Set(slides.map(s=>s.image))];
  const images = new Map(await Promise.all(urls.map(async url => [url, await imageData(url)] as const)));
  const qr = await brandQr(model.liveUrl, 200);
  for (let i=0;i<slides.length;i++) {
    if (i>0) doc.addPage([f.w, f.h], 'landscape');
    const s = slides[i];
    letterhead(doc, f, { unit: 'INVESTOR DECK / SERIE A', ref: 'GC-2026', version: model.docVersion, page: i+1, total: slides.length, issued: 'Octubre 2026', classification: 'DOCUMENTO COMERCIAL / NO OFERTA PÚBLICA' });
    const image = images.get(s.image); if (!image) throw new Error('Image missing');
    doc.addImage(image,'JPEG', 530,100,386,352,undefined,'FAST');
    font(doc,'body','normal',6.3); ink(doc,GC_COLOR.slate);
    doc.text(doc.splitTextToSize(s.imageLabel,386),530,462);
    section(doc,f,84,String(i+1).padStart(2,'0'), s.kicker);
    font(doc,'display','bold',30); ink(doc,GC_COLOR.ink);
    const titleLines = doc.splitTextToSize(s.title,475) as string[];
    doc.text(titleLines,44,128); let y = 128 + (titleLines.length-1)*33 + 24;
    y += paragraph(doc,44,y,s.lead,470,12) + 14;
    const statW = 470/Math.max(s.stats.length,1);
    s.stats.forEach((stat,j) => {
      const x = 44 + j*statW; font(doc,'display','bold',s.stats.length>2 ? 21 : 25); ink(doc,GC_COLOR.cobalt); doc.text(stat.value,x,y+12);
      font(doc,'body','normal',7); ink(doc,GC_COLOR.slate); doc.text(doc.splitTextToSize([stat.label,stat.note].filter(Boolean).join(' / '), statW-10),x,y+27);
    });
    if (s.stats.length) y+=64;
    const bodySize = s.items.length>3 ? 11 : s.items.some(it=>it.body.length>200) ? 10 : 12;
    for (const item of s.items) {
      font(doc,'body','bold',bodySize+1); ink(doc,GC_COLOR.ink);
      const heading = doc.splitTextToSize(item.title,470) as string[]; doc.text(heading,44,y); y+=heading.length*(bodySize+3);
      y+=paragraph(doc,44,y,item.body,470,bodySize)+9;
    }
    fill(doc,GC_COLOR.paperDeep); doc.rect(44,468,872,24,'F');
    paragraph(doc,52,477,s.note+' · Sin recursos ni reservas certificados NI 43-101/JORC.',850,6.1);
    if (i===slides.length-1) { doc.addImage(qr,'PNG',822,355,80,80); doc.link(822,355,80,80,{url:model.liveUrl}); }
  }
}

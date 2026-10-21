/**
 * Mapa geológico institucional: vista capturada del visor + leyenda de la
 * carta oficial. Usa la estructura institucional común (letterhead, folio,
 * sello de verificación) como el resto de la familia documental.
 */
import { brandQr, bullets, ensureBrandFonts, font, ink } from "./brand/kit";
import {
  folio,
  kvRow,
  letterhead,
  section,
  verificationSeal,
  type Frame,
  IM_NAVY,
} from "./brand/institutional";
import { GC_COLOR } from "./brand/tokens";
import { publicUrl } from "@/lib/publicUrl";
import { unitColor } from "@/components/geoscene/analysisTools";
import type { GeologyMapSummary } from "@/components/geoscene/geologyMapSummary";

async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildGeologicalMapPdf(o: {
  projectName: string;
  image: string | null;
  viewNote: string;
  summary: GeologyMapSummary;
}): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureBrandFonts(doc);
  const f: Frame = {
    w: doc.internal.pageSize.getWidth(),
    h: doc.internal.pageSize.getHeight(),
    m: 48,
  };
  const cw = f.w - f.m * 2;
  const issued = new Date().toISOString().slice(0, 10);
  const s = o.summary;
  const hash = await sha256(JSON.stringify({ project: o.projectName, s, issued }));
  const ref = `MAPA-${hash.slice(0, 8).toUpperCase()}`;

  let page = 1;
  const newPage = () => {
    doc.addPage("a4", "portrait");
    page++;
    letterhead(doc, f, {
      unit: "Geología",
      ref,
      version: "v1",
      page,
      total: 0,
      issued,
      deferFooter: true,
    });
    return 76;
  };
  const ensure = (y: number, need: number) => (y + need < f.h - 60 ? y : newPage());

  letterhead(doc, f, {
    unit: "Geología",
    ref,
    version: "v1",
    page: 1,
    total: 0,
    issued,
    deferFooter: true,
  });

  font(doc, "display", "normal", 20);
  ink(doc, IM_NAVY);
  doc.text("Mapa geológico", f.m, 92);

  let y = section(doc, f, 118, "01", o.projectName);
  y = kvRow(doc, f, y, "Carta oficial", s.sheets.length ? s.sheets.join(" · ") : "Sin cobertura");
  y = kvRow(
    doc,
    f,
    y,
    "Evidencia",
    `${s.units.length} unidad(es) · ${s.faultsCount} falla(s) · ${s.structuresMeasured} estructura(s) medida(s)`,
  );

  if (o.image) {
    y = ensure(y + 6, 220);
    const ih = cw * 0.56;
    doc.addImage(o.image, "JPEG", f.m, y, cw, ih);
    y += ih + 10;
    font(doc, "body", "normal", 7.2);
    ink(doc, GC_COLOR.slate);
    const lines = doc.splitTextToSize(o.viewNote, cw) as string[];
    doc.text(lines, f.m, y);
    y += lines.length * 9 + 10;
  }

  y = ensure(y + 6, 60);
  y = section(doc, f, y, "02", "Leyenda · unidades geológicas");
  if (s.units.length) {
    for (const u of s.units) {
      y = ensure(y, 16);
      const [r, g, b] = unitColor(u.code);
      doc.setFillColor(r, g, b);
      doc.rect(f.m, y - 8, 9, 9, "F");
      y = kvRow(doc, f, y, u.code, [u.nombre, u.edad, u.litologia].filter(Boolean).join(" · "), 44);
    }
  } else {
    y = kvRow(doc, f, y, "—", "Sin unidades de carta oficial dentro del área del proyecto.");
  }

  y = ensure(y + 6, 60);
  y = section(doc, f, y, "03", "Evidencia estructural");
  y = kvRow(
    doc,
    f,
    y,
    "Fallas carta geológica",
    `${s.faultsCount} · OFICIAL · SERNAGEOMIN · escala 1:100.000`,
  );
  y = kvRow(
    doc,
    f,
    y,
    "Estructuras medidas en terreno",
    `${s.structuresMeasured} (${s.structuresWithDip} con manteo) · MEDIDO en terreno`,
  );

  if (s.gaps.length) {
    y = ensure(y + 6, 20 + s.gaps.length * 14);
    y += bullets(doc, f.m, y + 8, s.gaps, cw, 8.5) + 6;
  }

  y = ensure(y + 6, 70);
  y = section(doc, f, y, "04", "Aviso de alcance");
  font(doc, "body", "normal", 7.6);
  ink(doc, GC_COLOR.inkSoft);
  const notice = [
    "Cartografía regional (1:100.000, SERNAGEOMIN/CIGeo); los contactos no tienen precisión de detalle del prospecto.",
    "Las fallas y unidades mostradas son trazas regionales oficiales; no reemplazan estructuras medidas en terreno.",
    "Documento informativo; no constituye informe técnico NI 43-101/JORC ni declara recursos o reservas.",
  ].join(" ");
  const noticeLines = doc.splitTextToSize(notice, cw) as string[];
  doc.text(noticeLines, f.m, y);
  y += noticeLines.length * 10 + 14;

  const url = publicUrl("/dashboard");
  verificationSeal(doc, f, Math.min(y, f.h - 160), {
    qr: await brandQr(url),
    title: "Sello de integridad",
    body: `SHA-256 ${hash}`,
    url,
    ref,
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    folio(doc, f, { page: p, total, issued });
  }
  doc.setPage(total);

  return doc.output("blob");
}

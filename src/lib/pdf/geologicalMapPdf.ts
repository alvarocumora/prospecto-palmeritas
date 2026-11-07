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
import { PRIORITY_LABEL, suggestedSamplePoints } from "@/components/geoscene/priority";
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
  imageAspect?: number;
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
    const ih = cw * Math.min(Math.max(o.imageAspect ?? 0.56, 0.4), 1.1);
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

  const lin = s.lineamentsCount ?? 0;
  const zones = s.zones ?? [];
  const belts = s.belts ?? [];
  if (lin || zones.length || belts.length) {
    y = ensure(y + 6, 80);
    y = section(doc, f, y, "04", "Interpretación · halos y zonas de prioridad");
    if (belts.length) y = kvRow(doc, f, y, "Franja metalogénica", `${belts.join(" · ")} · OFICIAL`);
    if (lin)
      y = kvRow(
        doc,
        f,
        y,
        "Lineamientos",
        `${lin} trazas DEM · INTERPRETADO (no fallas verificadas)`,
      );
    // Resumen por prioridad: recuento, superficie y programa de muestreo sugerido.
    const tiers = (["P1", "P2", "P3"] as const).map((p) => {
      const zs = zones.filter((z) => z.priority === p);
      return { p, n: zs.length, ha: zs.reduce((s, z) => s + z.ha, 0) };
    });
    if (zones.length) {
      y = ensure(y + 4, 70);
      font(doc, "body", "bold", 8);
      ink(doc, IM_NAVY);
      const cols = [f.m, f.m + 90, f.m + 160, f.m + 260];
      ["Prioridad", "Zonas", "Superficie", "Malla 200 m sugerida"].forEach((h, i) =>
        doc.text(h, cols[i], y),
      );
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(f.m, y, f.m + cw, y);
      font(doc, "body", "normal", 8);
      for (const t of tiers) {
        y += 12;
        doc.text(`${t.p} · ${PRIORITY_LABEL[t.p]}`, cols[0], y);
        doc.text(String(t.n), cols[1], y);
        doc.text(t.ha > 0 ? `${Math.round(t.ha).toLocaleString("es-CL")} ha` : "—", cols[2], y);
        doc.text(
          t.p === "P3" || t.ha <= 0 ? "—" : `~${suggestedSamplePoints(t.ha)} puntos`,
          cols[3],
          y,
        );
      }
      y += 14;
    }
    for (const z of zones.filter((z) => z.priority !== "P3")) {
      y = ensure(y, 34);
      const [r, g, b] = z.priority === "P1" ? [196, 106, 52] : [201, 162, 74];
      doc.setFillColor(r, g, b);
      doc.rect(f.m, y - 8, 9, 9, "F");
      const ha = z.ha > 0 ? ` · ${Math.round(z.ha)} ha` : "";
      y = kvRow(
        doc,
        f,
        y,
        z.name.split(" · ")[0],
        `${z.priority}${ha}${z.comment ? ` · ${z.comment}` : ""}`,
        70,
      );
    }
    font(doc, "body", "normal", 7.4);
    ink(doc, GC_COLOR.slate);
    const note = doc.splitTextToSize(
      "Prioridades INTERPRETADAS a partir de la evidencia cargada en el visor (morfología, estructuras, teledetección, geoquímica según el proyecto). Ordenan el trabajo de terreno; la malla de muestreo es una propuesta y no constituye anomalía de ley, recurso ni reserva.",
      cw,
    ) as string[];
    y = ensure(y + 4, note.length * 9 + 6);
    doc.text(note, f.m, y + 6);
    y += note.length * 9 + 10;
  }

  y = ensure(y + 6, 70);
  y = section(doc, f, y, "05", "Aviso de alcance");
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
  y = ensure(y, 92);
  verificationSeal(doc, f, y, {
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

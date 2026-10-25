/**
 * Holder Profile PDF generator
 *
 * Aggregates everything we know about a watched holder (RUT or name) across:
 *   - mining_bulletins        (publications: pedimentos, mensuras, manifestaciones)
 *   - mining_court_cases      (PJUD judicial cases)
 *   - bulletin_alerts         (matches against this project's AOI/holders)
 *   - court_case_alerts
 *
 * Produces a single PDF for executive distribution / due-diligence.
 */
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import {
  drawFooter,
  drawHeader,
  editorialTable,
  ensureBrandFonts,
  eyebrow,
  fitTableRows,
  font,
  paragraph,
  title,
} from "./brand/kit";

export type HolderProfileInput = {
  projectId: string;
  projectName: string;
  holderName: string | null;
  holderRut: string | null;
};

function normalizeRut(r: string | null | undefined): string | null {
  if (!r) return null;
  return r.replace(/\./g, "").trim().toLowerCase();
}

export async function generateHolderProfilePdf(input: HolderProfileInput) {
  const { holderName, holderRut, projectName } = input;
  const rutNorm = normalizeRut(holderRut);

  // Fetch publications + cases by RUT and/or name
  const [pubsRes, casesRes] = await Promise.all([
    supabase.from("mining_bulletins").select("*").limit(500),
    supabase.from("mining_court_cases").select("*").limit(500),
  ]);

  const matchPub = (p: { holder_rut: string | null; holder_name: string | null }) => {
    const pRut = normalizeRut(p.holder_rut);
    if (rutNorm && pRut && pRut === rutNorm) return true;
    if (
      holderName &&
      p.holder_name &&
      p.holder_name.toLowerCase().includes(holderName.toLowerCase())
    )
      return true;
    return false;
  };
  const matchCase = (c: { defendant_rut: string | null; defendant: string | null }) => {
    const cRut = normalizeRut(c.defendant_rut);
    if (rutNorm && cRut && cRut === rutNorm) return true;
    if (holderName && c.defendant && c.defendant.toLowerCase().includes(holderName.toLowerCase()))
      return true;
    return false;
  };

  const pubs = (pubsRes.data ?? []).filter(matchPub);
  const cases = (casesRes.data ?? []).filter(matchCase);

  // Build PDF — estructura de marca institucional (brand/kit), igual que
  // propertyAnalysisPdf.ts, para documentos de due diligence puntuales.
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureBrandFonts(doc);
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const m = 48;
  const cw = w - 2 * m;
  const issued = new Date().toLocaleDateString("es-CL");
  let page = 1;
  const start = () => {
    drawHeader(doc, { w, m, left: "Perfil de titular minero", right: issued });
  };
  const ensure = (y: number, need: number) => {
    if (y + need < h - 50) return y;
    drawFooter(doc, { w, h, m, left: projectName, page });
    doc.addPage();
    page++;
    start();
    return 70;
  };
  const pagedTable = (y: number, head: string[], rows: string[][]): number => {
    let rest = rows;
    let cy = y;
    while (rest.length) {
      font(doc, "body", "normal", 8);
      const fit = fitTableRows(doc, { head, rows: rest, w: cw, size: 8 }, h - 50 - cy);
      if (!fit) {
        cy = ensure(cy, h - 50 - cy + 1);
        continue;
      }
      cy +=
        editorialTable(doc, { x: m, y: cy, w: cw, head, rows: rest.slice(0, fit), size: 8 }) + 4;
      rest = rest.slice(fit);
      if (rest.length) cy = ensure(cy, 9999);
    }
    return cy;
  };

  start();
  let y = 76;
  eyebrow(doc, m, y, projectName);
  y += 16;
  y += title(doc, m, y + 8, "Perfil de titular minero", 22, cw) + 10;

  y +=
    paragraph(doc, m, y, `Titular: ${holderName ?? "—"}  ·  RUT: ${holderRut ?? "—"}`, cw, 9) + 10;
  y +=
    paragraph(
      doc,
      m,
      y,
      `Publicaciones en Boletín Oficial de Minería: ${pubs.length}  ·  Causas judiciales (PJUD): ${cases.length}`,
      cw,
      9,
    ) + 12;

  y = ensure(y, 60);
  eyebrow(doc, m, y + 8, "Publicaciones en Boletín Oficial de Minería");
  y += 20;
  if (pubs.length > 0) {
    y = pagedTable(
      y,
      ["Fecha", "N°", "Tipo", "Concesión", "Comuna", "Área (ha)"],
      pubs
        .slice(0, 50)
        .map((p) => [
          p.publication_date ?? "—",
          p.publication_number ?? "—",
          p.publication_type ?? "—",
          p.concession_name ?? "—",
          p.comuna ?? "—",
          p.area_ha != null ? String(p.area_ha) : "—",
        ]),
    );
  } else {
    y += paragraph(doc, m, y, "Sin publicaciones recientes en el Boletín.", cw, 9) + 10;
  }

  y = ensure(y, 60);
  eyebrow(doc, m, y + 8, "Causas judiciales (PJUD)");
  y += 20;
  if (cases.length > 0) {
    y = pagedTable(
      y,
      ["Fecha", "Rol", "Tribunal", "Materia", "Demandante", "Estado"],
      cases
        .slice(0, 50)
        .map((c) => [
          c.filed_at ?? "—",
          c.case_number ?? "—",
          c.court ?? "—",
          c.matter ?? "—",
          c.plaintiff ?? "—",
          c.status ?? "—",
        ]),
    );
  } else {
    y += paragraph(doc, m, y, "Sin causas judiciales registradas.", cw, 9);
  }

  drawFooter(doc, { w, h, m, left: projectName, page });

  const safeName = (holderName ?? holderRut ?? "titular")
    .replace(/[^a-zA-Z0-9-]+/g, "_")
    .slice(0, 40);
  const { triggerPdfDownload } = await import("@/lib/documents/pdf");
  await triggerPdfDownload(doc.output("blob"), `perfil-titular-${safeName}.pdf`);

  return { publications: pubs.length, cases: cases.length };
}

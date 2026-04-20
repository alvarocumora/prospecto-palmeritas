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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

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
    if (holderName && p.holder_name && p.holder_name.toLowerCase().includes(holderName.toLowerCase())) return true;
    return false;
  };
  const matchCase = (c: { defendant_rut: string | null; defendant: string | null }) => {
    const cRut = normalizeRut(c.defendant_rut);
    if (rutNorm && cRut && cRut === rutNorm) return true;
    if (holderName && c.defendant && c.defendant.toLowerCase().includes(holderName.toLowerCase())) return true;
    return false;
  };

  const pubs = (pubsRes.data ?? []).filter(matchPub);
  const cases = (casesRes.data ?? []).filter(matchCase);

  // Build PDF
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 215, 0);
  doc.setFontSize(16);
  doc.text("PERFIL DE TITULAR MINERO", 40, 30);
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(9);
  doc.text(`Geocapitals · Proyecto: ${projectName}`, 40, 48);
  doc.text(`Generado: ${new Date().toLocaleString("es-CL")}`, 40, 60);

  doc.setTextColor(0, 0, 0);
  let y = 95;

  // Identity
  doc.setFontSize(12);
  doc.text("Identidad", 40, y);
  y += 14;
  doc.setFontSize(10);
  doc.text(`Titular: ${holderName ?? "—"}`, 40, y);
  y += 12;
  doc.text(`RUT: ${holderRut ?? "—"}`, 40, y);
  y += 18;

  // Summary metrics
  doc.setFontSize(12);
  doc.text("Resumen", 40, y);
  y += 14;
  doc.setFontSize(10);
  doc.text(`Publicaciones en Boletín Oficial de Minería: ${pubs.length}`, 40, y);
  y += 12;
  doc.text(`Causas judiciales (PJUD): ${cases.length}`, 40, y);
  y += 8;

  // Publications table
  if (pubs.length > 0) {
    autoTable(doc, {
      startY: y + 12,
      head: [["Fecha", "N°", "Tipo", "Concesión", "Comuna", "Área (ha)"]],
      body: pubs.slice(0, 50).map((p) => [
        p.publication_date ?? "—",
        p.publication_number ?? "—",
        p.publication_type ?? "—",
        p.concession_name ?? "—",
        p.comuna ?? "—",
        p.area_ha != null ? String(p.area_ha) : "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  } else {
    doc.text("Sin publicaciones recientes en el Boletín.", 40, y + 14);
    y += 26;
  }

  // Court cases table
  if (cases.length > 0) {
    autoTable(doc, {
      startY: y + 14,
      head: [["Fecha", "Rol", "Tribunal", "Materia", "Demandante", "Estado"]],
      body: cases.slice(0, 50).map((c) => [
        c.filed_at ?? "—",
        c.case_number ?? "—",
        c.court ?? "—",
        c.matter ?? "—",
        c.plaintiff ?? "—",
        c.status ?? "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [127, 29, 29], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
  } else {
    doc.text("Sin causas judiciales registradas.", 40, y + 26);
  }

  // Footer page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Geocapitals · Perfil de Titular · Página ${i}/${pages}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" },
    );
  }

  const safeName = (holderName ?? holderRut ?? "titular")
    .replace(/[^a-zA-Z0-9-]+/g, "_")
    .slice(0, 40);
  doc.save(`perfil-titular-${safeName}.pdf`);

  return { publications: pubs.length, cases: cases.length };
}

// Escrito legal (BORRADOR) de pedimento / manifestación en el navegador (jsPDF).
// Enlaza G1 (geometría generada sobre el AOI) con G3 (documento legal). Estructura
// del Código de Minería con los vértices UTM reales; los datos del peticionario van
// como [POR COMPLETAR] (no se inventan). GUARDA: borrador para abogado de minería,
// no es la presentación oficial (requiere OJV + estudio de títulos + Convenio 169).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PedimentoResult } from "@/lib/pedimentoGeometry";

export type EscritoTipo = "pedimento" | "manifestacion";

const TIPO_TXT: Record<EscritoTipo, { titulo: string; arts: string }> = {
  pedimento: {
    titulo: "pedimento de concesión de exploración",
    arts: "Artículos 112 y siguientes del Código de Minería",
  },
  manifestacion: {
    titulo: "manifestación de concesión de explotación",
    arts: "Artículos 44 y siguientes del Código de Minería",
  },
};

export function downloadPedimentoEscrito(ped: PedimentoResult, tipo: EscritoTipo = "pedimento") {
  const { titulo, arts } = TIPO_TXT[tipo];
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 64;
  const W = doc.internal.pageSize.getWidth();
  let y = 56;

  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(120);
  doc.text(
    `GeoCapitals · Catastro Intelligence — BORRADOR ${new Date().toLocaleDateString("es-CL")}`,
    W - M,
    y,
    { align: "right" },
  );
  doc.setDrawColor(180).line(M, y + 6, W - M, y + 6);
  y += 30;

  doc.setFont("times", "bold").setFontSize(13).setTextColor(20);
  doc.text(`EN LO PRINCIPAL: constituye ${titulo}`.toUpperCase(), W / 2, y, { align: "center" });
  y += 16;
  doc.setFont("times", "italic").setFontSize(10).setTextColor(70);
  doc.text(`Borrador para revisión legal · ${arts}`, W / 2, y, { align: "center" });
  y += 26;

  const para = (text: string) => {
    doc.setFont("times", "normal").setFontSize(11).setTextColor(17);
    const lines = doc.splitTextToSize(text, W - 2 * M);
    doc.text(lines, M, y, { align: "justify", maxWidth: W - 2 * M });
    y += lines.length * 15 + 6;
  };

  doc.setFont("times", "normal").setFontSize(11);
  doc.text("S. J. L. de [COMUNA / TRIBUNAL COMPETENTE]", W - M, y, { align: "right" });
  y += 22;

  para(
    "[NOMBRE DEL PETICIONARIO], [NACIONALIDAD], [PROFESIÓN U OFICIO], cédula nacional de " +
      "identidad / RUT N° [RUT], domiciliado(a) en [DOMICILIO], a US. respetuosamente digo:",
  );
  para(
    `Que por el presente acto vengo en constituir ${titulo}, de conformidad con ${arts}, ` +
      `en la comuna de [COMUNA], Región de [REGIÓN], con las siguientes características:`,
  );
  para(
    `Punto medio de la cara norte (coordenadas UTM, Datum [PSAD56 / SIRGAS], Huso ${ped.huso} Sur): ` +
      `Este ${ped.caraNorteUtm.E_centro.toLocaleString("es-CL")} m, Norte ${ped.caraNorteUtm.N.toLocaleString("es-CL")} m.`,
  );
  para(
    `Dimensiones: lado Este-Oeste ${ped.ladosM["E-W"].toLocaleString("es-CL")} metros; lado ` +
      `Norte-Sur ${ped.ladosM["N-S"].toLocaleString("es-CL")} metros. Superficie: ${ped.areaHa} hectáreas. ` +
      "Los lados están orientados norte-sur y este-oeste según los ejes de la proyección UTM, conforme a la ley.",
  );

  autoTable(doc, {
    startY: y,
    head: [["Vértice", "Este (m)", "Norte (m)"]],
    body: (["NW", "NE", "SE", "SW"] as const).map((k) => [
      k,
      ped.cornersUtm[k][0].toLocaleString("es-CL"),
      ped.cornersUtm[k][1].toLocaleString("es-CL"),
    ]),
    theme: "grid",
    styles: { font: "times", fontSize: 10, halign: "right" },
    headStyles: { fillColor: [238, 238, 238], textColor: 20, halign: "center" },
    columnStyles: { 0: { halign: "center" } },
    margin: { left: M + 90, right: M + 90 },
    tableWidth: W - 2 * M - 180,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  para(
    "Por tanto, conforme a lo expuesto y a las normas del Código de Minería, ruego a US.: tener por " +
      `constituido el presente ${titulo} en los términos señalados, ordenando las inscripciones, ` +
      "publicaciones y trámites que en derecho correspondan.",
  );

  y += 28;
  doc.setFont("times", "normal").setFontSize(11).setTextColor(17);
  doc.text("_______________________________________", W / 2, y, { align: "center" });
  y += 15;
  doc.text("[NOMBRE Y FIRMA DEL PETICIONARIO] — RUT [RUT]", W / 2, y, { align: "center" });
  y += 28;

  doc.setDrawColor(184, 134, 11).setFillColor(255, 248, 236);
  const gh = 78;
  doc.rect(M, y, W - 2 * M, gh, "FD");
  doc.setFont("helvetica", "normal").setFontSize(8.2).setTextColor(122, 91, 18);
  const guarda = doc.splitTextToSize(
    "BORRADOR — no es la presentación oficial. Documento generado por GeoCapitals como apoyo técnico. " +
      "Requiere revisión y patrocinio de abogado(a) de minería, verificación de vacancia y prioridad en la " +
      "Oficina Judicial Virtual, estudio de títulos y, donde aplique, consulta indígena (Convenio 169 OIT). " +
      `Geometría: ${ped.datum}, superficie ${ped.areaHa} ha (vacancia indicativa SERNAGEOMIN). Confirmar el ` +
      "Datum oficial por huso antes de presentar. No constituye asesoría legal.",
    W - 2 * M - 20,
  );
  doc.text(guarda, M + 10, y + 14);

  doc.save(`escrito-${tipo}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

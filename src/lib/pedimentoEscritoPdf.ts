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

export type EscritoDatos = {
  nombre?: string; rut?: string; nacionalidad?: string; estadoCivil?: string; profesion?: string; domicilio?: string;
  comuna?: string; provincia?: string; region?: string; sector?: string; tribunal?: string; concesion?: string;
  representada?: string; fantasia?: string; rutRepresentada?: string; cargo?: string; email?: string;
};

const fmt = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function downloadPedimentoEscrito(ped: PedimentoResult, tipo: EscritoTipo = "pedimento", d: EscritoDatos = {}) {
  const v = (x: string | undefined, ph: string) => (x && x.trim() ? x.trim() : ph);
  const { titulo } = TIPO_TXT[tipo];
  const clase = tipo === "pedimento" ? "exploración" : "explotación";
  const nom = v(d.concesion, "[NOMBRE CONCESIÓN]");
  const rep = d.representada?.trim();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 64;
  const W = doc.internal.pageSize.getWidth();
  let y = 56;

  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(120);
  doc.text(`GeoCapitals · Catastro — BORRADOR ${new Date().toLocaleDateString("es-CL")}`, W - M, y, { align: "right" });
  doc.setDrawColor(180).line(M, y + 6, W - M, y + 6);
  y += 26;

  const para = (text: string, bold = false) => {
    doc.setFont("times", bold ? "bold" : "normal").setFontSize(11).setTextColor(17);
    const lines = doc.splitTextToSize(text, W - 2 * M);
    doc.text(lines, M, y, { align: "justify", maxWidth: W - 2 * M });
    y += lines.length * 14 + 6;
  };

  const otrosis = rep
    ? " PRIMER OTROSÍ: Acompaña documentos. SEGUNDO OTROSÍ: Personería. TERCER OTROSÍ: Forma de notificación."
    : d.email ? " OTROSÍ: Forma de notificación." : "";
  para(`EN LO PRINCIPAL: Solicita concesión minera de ${clase} denominada "${nom}".${otrosis}`, true);
  y += 4;
  doc.setFont("times", "bold").setFontSize(11);
  doc.text(`S.J.L. ${v(d.tribunal, "[TRIBUNAL COMPETENTE]")}`.toUpperCase(), M, y);
  y += 20;

  const persona = `${v(d.nombre, "[NOMBRE DEL PETICIONARIO]")}, ${v(d.nacionalidad, "[NACIONALIDAD]")}, ` +
    `${d.estadoCivil?.trim() ? d.estadoCivil.trim() + ", " : ""}${v(d.profesion, "[PROFESIÓN]")}, cédula nacional de identidad N° ${v(d.rut, "[RUT]")}`;
  const repTxt = rep
    ? `, en representación, según se acreditará, de ${rep}${d.fantasia?.trim() ? ` (nombre de fantasía ${d.fantasia.trim()})` : ""}, ` +
      `Rol Único Tributario N° ${v(d.rutRepresentada, "[RUT SOCIEDAD]")}, ambos domiciliados para estos efectos en ${v(d.domicilio, "[DOMICILIO]")}`
    : `, domiciliado para estos efectos en ${v(d.domicilio, "[DOMICILIO]")}`;
  const ubic = `${d.sector?.trim() ? `en el sector de ${d.sector.trim()}, ` : ""}comuna de ${v(d.comuna, "[COMUNA]")}` +
    `${d.provincia?.trim() ? `, provincia de ${d.provincia.trim()}` : ""}, Región ${v(d.region, "[REGIÓN]")}`;
  para(`${persona}${repTxt}, a US. respetuosamente digo: Que, de conformidad con lo dispuesto en los artículos 28, 34, 43 y siguientes ` +
    `del Código de Minería, vengo en solicitar se constituya a favor de ${rep ? "mi representada" : "mi persona"} una concesión minera de ${clase} ` +
    `sobre terrenos ubicados ${ubic}, conforme a las siguientes menciones:`);

  const cN = (ped.cornersUtm.NW[1] + ped.cornersUtm.SW[1]) / 2;
  const cE = (ped.cornersUtm.NW[0] + ped.cornersUtm.NE[0]) / 2;
  para(`1. Nombre de la concesión: "${nom}".`);
  para(`2. Punto medio de la cara superior: coordenadas U.T.M. Norte ${fmt(cN)} metros y Este ${fmt(cE)} metros, ${ped.datum}, Huso ${ped.huso}. ` +
    `[VERIFICAR DATUM OFICIAL EXIGIDO (PSAD56 / SIRGAS) Y TRANSFORMAR SI CORRESPONDE].`);
  para(`3. Superficie de la cara superior: ${ped.areaHa} hectáreas.`);
  para(`4. Forma y lados: paralelogramo de ángulos rectos, cuyos lados Norte-Sur U.T.M. miden ${ped.ladosM["N-S"].toLocaleString("es-CL")} metros ` +
    `y cuyos lados Este-Oeste U.T.M. miden ${ped.ladosM["E-W"].toLocaleString("es-CL")} metros.`);
  para(`5. Vértices (referenciales, mismo datum y huso):`);
  autoTable(doc, {
    startY: y,
    head: [["Vértice", "Norte (m)", "Este (m)"]],
    body: (["NW", "NE", "SE", "SW"] as const).map((k) => [
      k,
      fmt(ped.cornersUtm[k][1]),
      fmt(ped.cornersUtm[k][0]),
    ]),
    theme: "grid",
    styles: { font: "times", fontSize: 10, halign: "right" },
    headStyles: { fillColor: [238, 238, 238], textColor: 20, halign: "center" },
    columnStyles: { 0: { halign: "center" } },
    margin: { left: M + 90, right: M + 90 },
    tableWidth: W - 2 * M - 180,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  para(`POR TANTO, en mérito de lo expuesto y de las disposiciones legales citadas, RUEGO A US. tener por presentado el ${titulo === TIPO_TXT.pedimento.titulo ? "pedimento" : "escrito"} ` +
    `de la concesión minera de ${clase} "${nom}", ordenar su inscripción y publicación conforme a la ley, y darle la tramitación que corresponda ` +
    `hasta dictar sentencia constitutiva a favor de ${rep ? "mi representada" : "mi persona"}.`);
  if (rep) {
    para(`PRIMER OTROSÍ: Ruego a US. tener por acompañados, con citación, los siguientes documentos de ${rep}, emitidos por el Registro de Empresas y ` +
      "Sociedades: (a) certificado de estatuto actualizado; (b) certificado de vigencia; y (c) certificado de anotaciones.");
    para(`SEGUNDO OTROSÍ: Ruego a US. tener presente que mi personería para representar a ${rep}, en calidad de ${v(d.cargo, "[CARGO]")}, ` +
      "consta en los documentos acompañados en el primer otrosí.");
  }
  if (d.email?.trim()) para(`${rep ? "TERCER OTROSÍ" : "OTROSÍ"}: Ruego a US. disponer que las resoluciones que se dicten en esta causa me sean notificadas al correo electrónico ${d.email.trim()}.`);

  y += 26;
  if (y > 700) { doc.addPage(); y = 80; }
  doc.setFont("times", "normal").setFontSize(11).setTextColor(17);
  doc.text("________________________________", W / 2, y, { align: "center" });
  y += 15;
  doc.text(v(d.nombre, "[NOMBRE Y FIRMA]"), W / 2, y, { align: "center" });
  if (rep) { y += 14; doc.text(`p.p. ${rep}${d.fantasia?.trim() ? ` (${d.fantasia.trim()})` : ""}`, W / 2, y, { align: "center" }); }
  y += 26;
  if (y > 740) { doc.addPage(); y = 80; }

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

  doc.save(`escrito-${d.concesion?.trim() ? d.concesion.trim().replace(/\s+/g, "_") + "-" : ""}${tipo}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

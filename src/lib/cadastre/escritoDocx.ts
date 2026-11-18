// Escrito de pedimento / manifestación en Word editable (misma estructura que el PDF borrador).
// Datos vacíos quedan como [POR COMPLETAR]; no se inventa información del peticionario.
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle,
} from "docx";
import type { PedimentoResult } from "@/lib/pedimentoGeometry";
import type { EscritoDatos, EscritoTipo } from "@/lib/pedimentoEscritoPdf";

const fmt = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const run = (text: string, bold = false) => new TextRun({ text, bold, font: "Times New Roman", size: 24 });
const para = (text: string, bold = false, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED) =>
  new Paragraph({ children: [run(text, bold)], alignment: align, spacing: { after: 200, line: 340 } });
const bd = { style: BorderStyle.SINGLE, size: 4, color: "888888" };
const cell = (t: string, w: number, bold = false) => new TableCell({
  borders: { top: bd, bottom: bd, left: bd, right: bd },
  width: { size: w, type: WidthType.DXA },
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(t, bold)] })],
});

export async function buildEscritoDocx(ped: PedimentoResult, tipo: EscritoTipo, d: EscritoDatos): Promise<Blob> {
  const v = (x: string | undefined, ph: string) => (x && x.trim() ? x.trim() : ph);
  const clase = tipo === "pedimento" ? "exploración" : "explotación";
  const verbo = tipo === "pedimento" ? "Solicita" : "Manifiesta";
  const nom = v(d.concesion, "[NOMBRE CONCESIÓN]");
  const rep = d.representada?.trim();
  const cN = (ped.cornersUtm.NW[1] + ped.cornersUtm.NE[1]) / 2;
  const cE = (ped.cornersUtm.NW[0] + ped.cornersUtm.NE[0]) / 2;
  const otrosis = rep ? " PRIMER OTROSÍ: Acompaña documentos. SEGUNDO OTROSÍ: Personería. TERCER OTROSÍ: Forma de notificación." : d.email ? " OTROSÍ: Forma de notificación." : "";
  const persona = `${v(d.nombre, "[NOMBRE DEL PETICIONARIO]")}, ${v(d.nacionalidad, "[NACIONALIDAD]")}, ${d.estadoCivil?.trim() ? d.estadoCivil.trim() + ", " : ""}${v(d.profesion, "[PROFESIÓN]")}, cédula nacional de identidad N° ${v(d.rut, "[RUT]")}`;
  const repTxt = rep
    ? `, en representación, según se acreditará, de ${rep}${d.fantasia?.trim() ? ` (nombre de fantasía ${d.fantasia.trim()})` : ""}, Rol Único Tributario N° ${v(d.rutRepresentada, "[RUT SOCIEDAD]")}, ambos domiciliados para estos efectos en ${v(d.domicilio, "[DOMICILIO]")}`
    : `, domiciliado para estos efectos en ${v(d.domicilio, "[DOMICILIO]")}`;
  const ubic = `${d.sector?.trim() ? `en el sector de ${d.sector.trim()}, ` : ""}comuna de ${v(d.comuna, "[COMUNA]")}${d.provincia?.trim() ? `, provincia de ${d.provincia.trim()}` : ""}, Región ${v(d.region, "[REGIÓN]")}`;
  const mine = rep ? "mi representada" : "mi persona";

  const children: (Paragraph | Table)[] = [
    para(`EN LO PRINCIPAL: ${verbo} concesión minera de ${clase} denominada "${nom}".${otrosis}`, true),
    para(`S.J.L. ${v(d.tribunal, "[TRIBUNAL COMPETENTE]")}`.toUpperCase(), true, AlignmentType.LEFT),
    para(`${persona}${repTxt}, a US. respetuosamente digo: Que, de conformidad con lo dispuesto en el Código de Minería, vengo en ${tipo === "pedimento" ? "solicitar" : "manifestar"} se constituya a favor de ${mine} una concesión minera de ${clase} sobre terrenos ubicados ${ubic}, conforme a las siguientes menciones:`),
    para(`1. Nombre de la concesión: "${nom}".`),
    para(`2. Punto medio de la cara superior: coordenadas U.T.M. Norte ${fmt(cN)} metros y Este ${fmt(cE)} metros, ${ped.datum}, Huso ${ped.huso}.`),
    para(`3. Superficie: ${ped.areaHa.toLocaleString("es-CL")} hectáreas.`),
    para(`4. Forma y lados: paralelogramo de ángulos rectos, lados Norte-Sur U.T.M. de ${ped.ladosM["N-S"].toLocaleString("es-CL")} metros y lados Este-Oeste U.T.M. de ${ped.ladosM["E-W"].toLocaleString("es-CL")} metros.`),
    para("5. Vértices (mismo datum y huso):"),
    new Table({
      width: { size: 6000, type: WidthType.DXA }, columnWidths: [1600, 2200, 2200], alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({ children: [cell("Vértice", 1600, true), cell("Norte (m)", 2200, true), cell("Este (m)", 2200, true)] }),
        ...(["NW", "NE", "SE", "SW"] as const).map((k, i) => new TableRow({ children: [
          cell(`V${i + 1} (${k})`, 1600), cell(fmt(ped.cornersUtm[k][1]), 2200), cell(fmt(ped.cornersUtm[k][0]), 2200),
        ] })),
      ],
    }),
    para(""),
    para(`POR TANTO, RUEGO A US. tener por presentada la solicitud de concesión minera de ${clase} "${nom}", ordenar su inscripción y publicación conforme a la ley, y darle la tramitación que corresponda hasta dictar sentencia constitutiva a favor de ${mine}.`),
  ];
  if (rep) {
    children.push(para(`PRIMER OTROSÍ: Ruego a US. tener por acompañados, con citación, los siguientes documentos de ${rep}: (a) certificado de estatuto actualizado; (b) certificado de vigencia; y (c) certificado de anotaciones.`));
    children.push(para(`SEGUNDO OTROSÍ: Ruego a US. tener presente que mi personería para representar a ${rep}, en calidad de ${v(d.cargo, "[CARGO]")}, consta en los documentos acompañados en el primer otrosí.`));
  }
  if (d.email?.trim()) children.push(para(`${rep ? "TERCER OTROSÍ" : "OTROSÍ"}: Ruego a US. disponer que las resoluciones me sean notificadas al correo electrónico ${d.email.trim()}.`));
  children.push(para(""), para("________________________________", false, AlignmentType.CENTER), para(v(d.nombre, "[NOMBRE Y FIRMA]"), false, AlignmentType.CENTER));
  if (rep) children.push(para(`p.p. ${rep}`, false, AlignmentType.CENTER));

  const doc = new Document({
    sections: [{ properties: { page: { size: { width: 12240, height: 18720 }, margin: { top: 1700, right: 1440, bottom: 1440, left: 1700 } } }, children }],
  });
  return Packer.toBlob(doc);
}

export async function downloadEscritoDocx(ped: PedimentoResult, tipo: EscritoTipo, d: EscritoDatos) {
  const blob = await buildEscritoDocx(ped, tipo, d);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `escrito-${d.concesion?.trim() ? d.concesion.trim().replace(/\s+/g, "_") + "-" : ""}${tipo}.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

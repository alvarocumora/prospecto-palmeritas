/**
 * Ficha individual descargable por derecho de agua (A4, QR verificable).
 * Client-only: jsPDF / autotable / qrcode se importan dinámicamente.
 * Sólo imprime datos existentes en la base — nunca infiere ni "verifica".
 */
import { publicUrl } from "@/lib/publicUrl";
import {
  EXERCISE_LABEL,
  NATURE_LABEL,
  RIGHT_TYPE_LABEL,
  VALUATION_DISCLAIMER,
  VERIFICATION_META,
  fmtCLPFull,
  fmtFlow,
  type WaterAsset,
  type WaterLegalRecord,
} from "./data";

const NAVY: [number, number, number] = [4, 18, 42];
const OCEAN: [number, number, number] = [14, 116, 190];
const CYAN: [number, number, number] = [14, 165, 233];
const SLATE: [number, number, number] = [71, 85, 105];
const HAIR: [number, number, number] = [214, 222, 232];

export function waterVerifyUrl(assetId: string) {
  return publicUrl(`/agua/verificar/${assetId}`);
}

export async function downloadWaterFicha(
  asset: WaterAsset,
  legal: WaterLegalRecord[],
  opts: { mode: "public" | "investor" } = { mode: "public" },
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const QR = await import("qrcode");

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 46;
  const verify = waterVerifyUrl(asset.asset_id);
  const qr = await QR.toDataURL(verify, {
    margin: 1,
    width: 420,
    color: { dark: "#04122A", light: "#FFFFFF" },
  });

  // Header
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, W, 132, "F");
  pdf.setFillColor(...CYAN);
  pdf.rect(0, 130, W * 0.3, 3, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("GEOCAPITALS WATER ASSETS", M, 40);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(150, 200, 235);
  pdf.text("Water rights intelligence · geocapitals.com", M, 54);

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text(asset.river, M, 88);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(170, 210, 240);
  pdf.text(
    `${asset.asset_id}  ·  ${asset.commune} · ${asset.province} · Región de ${asset.region}, ${asset.country}`,
    M,
    106,
  );

  pdf.addImage(qr, "PNG", W - M - 62, 30, 62, 62);
  pdf.setFontSize(6.5);
  pdf.setTextColor(150, 200, 235);
  pdf.text("Verificar ficha", W - M - 62, 102);

  // KPI band
  let y = 156;
  const kpis: Array<[string, string]> = [
    ["PERMANENT FLOW", fmtFlow(asset.flow_permanent_ls)],
    ["EVENTUAL FLOW", asset.flow_eventual_ls ? `Hasta ${fmtFlow(asset.flow_eventual_ls)}` : "—"],
    ["TYPE", asset.nature === "consuntivo" ? "Consumptive" : "Non-consumptive"],
    ["REFERENCE VALUE", fmtCLPFull(asset.reference_value_clp)],
  ];
  const cw = (W - M * 2) / kpis.length;
  kpis.forEach(([label, value], i) => {
    const x = M + cw * i;
    pdf.setDrawColor(...HAIR);
    pdf.setFillColor(246, 250, 253);
    pdf.rect(x, y, cw - 8, 46, "FD");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...SLATE);
    pdf.text(label, x + 9, y + 16);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(...NAVY);
    pdf.text(value, x + 9, y + 33, { maxWidth: cw - 20 });
  });
  y += 66;

  const section = (title: string) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...OCEAN);
    pdf.text(title.toUpperCase(), M, y);
    y += 6;
    pdf.setDrawColor(...HAIR);
    pdf.line(M, y, W - M, y);
    y += 10;
  };

  const table = (rows: Array<[string, string]>) => {
    autoTable(pdf, {
      startY: y,
      margin: { left: M, right: M },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8.6,
        cellPadding: 5,
        textColor: [26, 32, 44],
        lineColor: HAIR,
      },
      columnStyles: { 0: { cellWidth: 170, fontStyle: "bold", textColor: SLATE } },
      body: rows,
    });
    y = ((pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y) + 20;
  };

  section("Identificación del activo");
  table([
    ["Asset ID", asset.asset_id],
    ["Fuente hídrica", asset.river],
    ["Comuna", asset.commune],
    ["Provincia", asset.province],
    ["Región", asset.region],
    ["Tipo de derecho", RIGHT_TYPE_LABEL[asset.right_type] ?? asset.right_type],
    ["Naturaleza", NATURE_LABEL[asset.nature] ?? asset.nature],
    ["Ejercicio", EXERCISE_LABEL[asset.exercise] ?? asset.exercise],
    ["Caudal permanente", fmtFlow(asset.flow_permanent_ls)],
    [
      "Caudal eventual",
      asset.flow_eventual_ls ? `Hasta ${fmtFlow(asset.flow_eventual_ls)}` : "No informado",
    ],
    [
      "Sistema de captación",
      asset.capture_system === "gravitacional" ? "Gravitacional" : (asset.capture_system ?? "—"),
    ],
    [
      "Coordenadas",
      opts.mode === "investor"
        ? `Lat ${asset.latitude.toFixed(6)} / Lon ${asset.longitude.toFixed(6)} · UTM ${asset.utm_datum} H${asset.utm_zone} N ${asset.utm_north} E ${asset.utm_east}`
        : "Ubicación aproximada — coordenadas precisas en el data room",
    ],
  ]);

  if (asset.flow_notes) {
    section("Nota de caudal");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.6);
    pdf.setTextColor(...SLATE);
    const lines = pdf.splitTextToSize(asset.flow_notes, W - M * 2);
    pdf.text(lines, M, y);
    y += lines.length * 12 + 16;
  }

  if (y > H - 260) {
    pdf.addPage();
    y = 60;
  }

  section("Ficha jurídica (estado documental)");
  if (legal.length === 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.6);
    pdf.setTextColor(...SLATE);
    pdf.text("Ficha jurídica disponible en el Investor Data Room (acceso autenticado).", M, y);
    y += 24;
  } else {
    autoTable(pdf, {
      startY: y,
      margin: { left: M, right: M },
      theme: "grid",
      head: [["Atributo", "Valor informado", "Estado"]],
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8 },
      styles: { font: "helvetica", fontSize: 8.2, cellPadding: 5, lineColor: HAIR },
      columnStyles: { 0: { cellWidth: 140, fontStyle: "bold" }, 2: { cellWidth: 110 } },
      body: legal.map((r) => [
        r.attribute,
        r.value ?? "No informado",
        VERIFICATION_META[r.verification]?.label ?? r.verification,
      ]),
    });
    y = ((pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y) + 20;
  }

  if (y > H - 190) {
    pdf.addPage();
    y = 60;
  }

  section("Valorización referencial");
  table([
    ["Caudal valorizado", fmtFlow(asset.flow_permanent_ls)],
    ["Valor unitario", `${fmtCLPFull(asset.unit_value_clp)} / L/s`],
    ["Valor referencial", fmtCLPFull(asset.reference_value_clp)],
    ["Método", "Caudal permanente × valor unitario de referencia"],
  ]);

  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(7.6);
  pdf.setTextColor(...SLATE);
  const disc = pdf.splitTextToSize(
    `${VALUATION_DISCLAIMER} No se valorizan caudales eventuales. La información legal proviene de la documentación aportada por el titular y se clasifica como Declarada, Documentada o Verificada según su respaldo.`,
    W - M * 2,
  );
  pdf.text(disc, M, y);

  // Footer en todas las páginas
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(...HAIR);
    pdf.line(M, H - 52, W - M, H - 52);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE);
    pdf.text(
      `Geocapitals Water Assets · ${asset.asset_id} · info@geocapitals.com · +56 9 6218 4071`,
      M,
      H - 36,
    );
    pdf.text(`${verify}   ·   ${p}/${pages}`, W - M, H - 36, { align: "right" });
  }

  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${asset.asset_id}-ficha-geocapitals.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

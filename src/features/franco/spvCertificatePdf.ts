/**
 * Certificado de participación en la SPV — colorimetría Geocapitals.
 * Client-only: jsPDF y qrcode se importan dinámicamente.
 */
import { publicUrl } from "@/lib/publicUrl";
import type { SpvEntity, SpvPosition } from "@/lib/spv.functions";

const INK: [number, number, number] = [18, 22, 26];
const PAPER: [number, number, number] = [245, 242, 236];
const COBALT: [number, number, number] = [36, 71, 214];
const SLATE: [number, number, number] = [110, 118, 126];
const HAIR: [number, number, number] = [227, 224, 216];

export const SPV_CERT_VERSION = "v1.0";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function downloadSpvCertificate(opts: {
  spv: SpvEntity;
  position: SpvPosition;
  projectName: string;
  verifyPath: string;
}): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const QR = await import("qrcode");

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 56;
  const verifyUrl = publicUrl(opts.verifyPath);

  const pct =
    opts.spv.total_shares > 0 ? (opts.position.shares / opts.spv.total_shares) * 100 : null;

  const hash = await sha256Hex(
    [
      opts.spv.legal_name,
      opts.position.id,
      opts.position.shares,
      opts.position.amount_paid,
      opts.position.subscribed_on,
      SPV_CERT_VERSION,
    ].join("|"),
  );

  const qr = await QR.toDataURL(verifyUrl, {
    margin: 1,
    width: 360,
    color: { dark: "#12161A", light: "#FFFFFF" },
  });

  pdf.setFillColor(...PAPER);
  pdf.rect(0, 0, W, H, "F");

  pdf.setFillColor(...INK);
  pdf.rect(0, 0, W, 96, "F");
  pdf.setTextColor(245, 242, 236);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("GEOCAPITALS", M, 46);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(190, 195, 200);
  pdf.text("Certificado de participación · documento informativo", M, 66);

  let y = 150;
  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("Certificado de participación", M, y);
  y += 22;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(...SLATE);
  pdf.text(`${opts.projectName} · ${opts.spv.legal_name}`, M, y);

  y += 34;
  const rows: Array<[string, string]> = [
    ["Titular", opts.position.investor_name],
    ["Correo", opts.position.investor_email ?? "—"],
    ["Sociedad (SPV)", opts.spv.legal_name + (opts.spv.rut ? ` · RUT ${opts.spv.rut}` : "")],
    ["Acciones suscritas", opts.position.shares.toLocaleString("es-CL")],
    ["Acciones emitidas", opts.spv.total_shares.toLocaleString("es-CL")],
    ["Participación", pct != null ? `${pct.toFixed(4)} %` : "por determinar"],
    [
      "Monto pagado",
      `${opts.position.currency} ${opts.position.amount_paid.toLocaleString("es-CL")}`,
    ],
    ["Instrumento", opts.position.instrument],
    ["Fecha de suscripción", opts.position.subscribed_on],
    ["Estado", opts.position.status === "active" ? "Vigente" : "Anulado"],
  ];

  pdf.setDrawColor(...HAIR);
  for (const [k, v] of rows) {
    pdf.setFontSize(9);
    pdf.setTextColor(...SLATE);
    pdf.text(k.toUpperCase(), M, y);
    pdf.setFontSize(11);
    pdf.setTextColor(...INK);
    pdf.text(String(v), M + 200, y);
    y += 12;
    pdf.line(M, y, W - M, y);
    y += 16;
  }

  y += 10;
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE);
  const disclaimer = pdf.splitTextToSize(
    "Este certificado deja constancia del registro interno de la participación indicada y no constituye un título valor, oferta pública de valores ni asesoría de inversión. El proyecto no cuenta con estimación de recursos ni reservas bajo CH 20235, NI 43-101, JORC o S-K 1300; los escenarios económicos publicados son ilustrativos y no incluyen VAN ni TIR.",
    W - M * 2 - 130,
  );
  pdf.text(disclaimer, M, y);

  pdf.addImage(qr, "PNG", W - M - 104, y - 14, 104, 104);
  pdf.setFontSize(7);
  pdf.text("Verificar en línea", W - M - 104, y + 100);

  pdf.setFillColor(...COBALT);
  pdf.rect(0, H - 42, W, 42, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.text(
    `${SPV_CERT_VERSION} · hash ${hash} · emitido ${new Date().toLocaleDateString("es-CL", { dateStyle: "long" })} · ${verifyUrl}`,
    M,
    H - 17,
  );

  pdf.save(`Certificado_Participacion_${opts.spv.legal_name.replace(/\s+/g, "_")}.pdf`);
}

// Estampado de marca de agua institucional GeoCapitals sobre un PDF ya
// congelado. Se usa para que cada firmante vea/descargue el documento con su
// nombre y rol impresos en diagonal en todas las páginas, tanto en la versión
// a firmar como en la firmada final. Client-only (pdf-lib).

import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

export type SignerWatermark = {
  name: string;
  role: string;
  reference?: string;
  status?: "pendiente" | "firmado";
  signedAt?: string | null;
};

const COBALT = rgb(43 / 255, 74 / 255, 203 / 255);
const INK = rgb(26 / 255, 26 / 255, 46 / 255);

/**
 * Devuelve un Blob del PDF con marcas de agua por firmante. La marca principal
 * es diagonal centrada con el nombre + rol; una banda inferior tenue repite el
 * dato y agrega el timestamp y hash corto de referencia.
 */
export async function stampSignerWatermark(
  input: ArrayBuffer | Uint8Array,
  signer: SignerWatermark,
): Promise<Blob> {
  const pdf = await PDFDocument.load(input, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontLight = await pdf.embedFont(StandardFonts.Helvetica);

  const label = `${signer.name} · ${roleLabel(signer.role)}`;
  const statusText = signer.status === "firmado" ? "FIRMADO" : "PENDIENTE DE FIRMA";
  const ts = signer.signedAt
    ? new Date(signer.signedAt).toLocaleString("es-CL")
    : new Date().toLocaleString("es-CL");
  const foot = [
    `Marca de agua personal · ${label}`,
    `${statusText} · ${ts}${signer.reference ? ` · REF ${signer.reference}` : ""}`,
  ];

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();

    // Diagonal principal centrada. Opacidad muy baja para no dañar la lectura.
    const size = Math.max(28, Math.min(48, width / 18));
    const text = label.toUpperCase();
    const textW = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: width / 2 - Math.cos(Math.PI / 6) * (textW / 2),
      y: height / 2 - Math.sin(Math.PI / 6) * (textW / 2),
      size,
      font,
      color: COBALT,
      opacity: 0.08,
      rotate: degrees(30),
    });

    // Cabecera lateral discreta (borde izquierdo, vertical) con el rol/nombre.
    page.drawText(text, {
      x: 14,
      y: 40,
      size: 7,
      font,
      color: INK,
      opacity: 0.55,
      rotate: degrees(90),
    });

    // Banda al pie con estado + timestamp.
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 22,
      color: COBALT,
      opacity: 0.06,
    });
    page.drawText(foot[0], {
      x: 24,
      y: 12,
      size: 7,
      font,
      color: INK,
      opacity: 0.75,
    });
    page.drawText(foot[1], {
      x: 24,
      y: 3,
      size: 6.2,
      font: fontLight,
      color: INK,
      opacity: 0.6,
    });
  }

  const bytes = await pdf.save();
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: "application/pdf" });
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    buyer: "Comprador",
    seller: "Vendedor",
    geocapitals: "GeoCapitals",
    advisor: "Asesor",
    witness: "Testigo",
  };
  return map[role] ?? role;
}

/** Descarga un Blob forzando `<a download>` (compatible Safari/mobile). */
export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function fetchAndStamp(
  url: string,
  signer: SignerWatermark,
): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el PDF (${res.status})`);
  const buf = await res.arrayBuffer();
  return stampSignerWatermark(buf, signer);
}

/**
 * Cartola / certificado de inversión del inversionista (wallet).
 * Usa la estructura institucional común; conserva siempre el aviso de riesgo.
 */
import { ensureBrandFonts, brandQr, font, ink } from "./brand/kit";
import {
  letterhead,
  section,
  kvRow,
  verificationSeal,
  type Frame,
  IM_NAVY,
} from "./brand/institutional";
import { GC_COLOR } from "./brand/tokens";
import { publicUrl } from "@/lib/publicUrl";

export type StatementPosition = {
  id: string;
  project: string;
  token: string;
  shares: number;
  amount_paid: number;
  currency: string;
  subscribed_on: string;
  pctOfSpv: number | null;
};
export type StatementTicket = {
  ticket_code: string;
  project: string;
  amount: number;
  status: string;
};

const usd = (n: number) => `USD ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateInvestmentStatement(o: {
  holder: string;
  positions: StatementPosition[];
  tickets: StatementTicket[];
  usdClp: number | null;
}) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureBrandFonts(doc);
  const f: Frame = {
    w: doc.internal.pageSize.getWidth(),
    h: doc.internal.pageSize.getHeight(),
    m: 48,
  };
  const issued = new Date().toISOString().slice(0, 10);
  const invested = o.positions.reduce((a, p) => a + p.amount_paid, 0);
  const shares = o.positions.reduce((a, p) => a + p.shares, 0);
  const hash = await sha256(JSON.stringify({ h: o.holder, p: o.positions, t: o.tickets, issued }));
  const ref = `CART-${hash.slice(0, 8).toUpperCase()}`;
  letterhead(doc, f, {
    unit: "Relación con Inversionistas",
    ref,
    version: "v1",
    page: 1,
    total: 1,
    issued,
  });

  font(doc, "display", "normal", 22);
  ink(doc, IM_NAVY);
  doc.text("Cartola de inversión", f.m, 92);

  let y = section(doc, f, 118, "01", "Titular y resumen");
  y = kvRow(doc, f, y, "Titular", o.holder);
  y = kvRow(doc, f, y, "Fecha de corte", issued);
  y = kvRow(
    doc,
    f,
    y,
    "Capital en posiciones",
    `${usd(invested)}${o.usdClp ? ` (≈ CLP ${Math.round(invested * o.usdClp).toLocaleString("es-CL")}, referencial)` : ""}`,
  );
  y = kvRow(doc, f, y, "Acciones totales", shares.toLocaleString("es-CL"));

  y = section(doc, f, y + 6, "02", "Posiciones SPV");
  if (!o.positions.length) y = kvRow(doc, f, y, "—", "Sin posiciones liquidadas a la fecha.");
  for (const p of o.positions)
    y = kvRow(
      doc,
      f,
      y,
      `${p.token}-SPV · ${p.project}`,
      `${p.shares.toLocaleString("es-CL")} acciones · ${usd(p.amount_paid)}${p.pctOfSpv != null ? ` · ${p.pctOfSpv.toFixed(3)} % de la SPV` : ""} · suscrita ${p.subscribed_on}`,
    );

  if (o.tickets.length) {
    y = section(doc, f, y + 6, "03", "Órdenes en curso");
    for (const t of o.tickets.slice(0, 6))
      y = kvRow(doc, f, y, t.ticket_code, `${t.project} · ${usd(t.amount)} · ${t.status}`);
  }

  y = section(doc, f, y + 6, "04", "Aviso");
  font(doc, "body", "normal", 7.6);
  ink(doc, GC_COLOR.inkSoft);
  const notice =
    "Documento informativo emitido desde la plataforma GeoCapitals. Las acciones constan en el registro de accionistas de la SPV emisora. Proyectos en explotación declarada por el titular, sin recursos ni reservas certificados (NI 43-101 / JORC). La inversión minera conlleva riesgo y no se garantiza rentabilidad. Equivalencias en CLP son referenciales.";
  const lines = doc.splitTextToSize(notice, f.w - f.m * 2) as string[];
  doc.text(lines, f.m, y);
  y += lines.length * 10 + 14;

  const url = publicUrl("/dashboard/investments");
  verificationSeal(doc, f, Math.min(y, f.h - 160), {
    qr: await brandQr(url),
    title: "Sello de integridad",
    body: `SHA-256 ${hash}`,
    url,
    ref,
  });
  doc.save(`GeoCapitals_Cartola_${issued}.pdf`);
}

import type { PedimentoResult } from "@/lib/pedimentoGeometry";
import type { EscritoDatos } from "@/lib/pedimentoEscritoPdf";
import type { Rect, SolicitudKind } from "@/lib/cadastre/designer";

export type LegalServiceType = "pedimento" | "manifestacion" | "due-diligence";

export interface LegalContactFields {
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  notes?: string;
}

export interface LegalTramiteContext {
  kind: SolicitudKind;
  ped: PedimentoResult;
  datos: EscritoDatos;
  pertenencias: Rect[];
}

const SERVICE_LABELS: Record<LegalServiceType, string> = {
  pedimento: "Tramitación de Pedimento (Exploración)",
  manifestacion: "Tramitación de Manifestación (Explotación)",
  "due-diligence": "Due Diligence y Blindaje Territorial",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function computeEffectiveAreaHa(
  kind: SolicitudKind,
  ped: PedimentoResult,
  pertenencias: Rect[],
): number {
  if (kind === "manifestacion" && pertenencias.length > 0) {
    return pertenencias.reduce((acc, r) => acc + ((r.e - r.w) * (r.n - r.s)) / 10000, 0);
  }
  return ped.areaHa;
}

export function validateLegalContact(fields: LegalContactFields): string | null {
  if (fields.name.trim().length < 2) return "Ingresa tu nombre completo.";
  if (!EMAIL_RE.test(fields.email.trim())) return "Ingresa un correo electrónico válido.";
  return null;
}

export function formatLegalTramiteMessage(
  service: LegalServiceType,
  contact: LegalContactFields,
  ctx?: LegalTramiteContext,
): string {
  const lines: string[] = [`[SOLICITUD LEGAL MINERA] ${SERVICE_LABELS[service]}`];
  if (contact.phone?.trim()) lines.push(`Teléfono / WhatsApp: ${contact.phone.trim()}`);

  if (ctx) {
    const { ped, datos, kind, pertenencias } = ctx;
    const r = (n: number) => Math.round(n).toLocaleString("es-CL");
    const areaHa = computeEffectiveAreaHa(kind, ped, pertenencias);
    const datumLabel = ped.datum.includes("UTM") ? ped.datum : `${ped.datum} · Huso ${ped.huso}S`;
    lines.push(
      "",
      "--- DATOS DEL DISEÑO CATASTRAL ---",
      `Tipo: ${kind === "manifestacion" ? "Manifestación (explotación)" : "Pedimento (exploración)"}`,
      `Concesión: ${datos.concesion?.trim() || "Por definir"}`,
      `Superficie: ${areaHa.toLocaleString("es-CL", { maximumFractionDigits: 1 })} ha`,
      `Datum / Huso: ${datumLabel}`,
      `Lados: N-S ${r(ped.ladosM["N-S"])} m · E-W ${r(ped.ladosM["E-W"])} m`,
    );
    if (datos.comuna?.trim()) lines.push(`Comuna: ${datos.comuna.trim()}`);
    if (datos.provincia?.trim()) lines.push(`Provincia: ${datos.provincia.trim()}`);
    if (datos.region?.trim()) lines.push(`Región: ${datos.region.trim()}`);
    if (datos.tribunal?.trim()) lines.push(`Tribunal sugerido: ${datos.tribunal.trim()}`);
    if (datos.rut?.trim()) lines.push(`RUT peticionario: ${datos.rut.trim()}`);
    if (datos.rutRepresentada?.trim()) lines.push(`RUT sociedad: ${datos.rutRepresentada.trim()}`);
    lines.push(
      `V1 (NW): N ${r(ped.cornersUtm.NW[1])} · E ${r(ped.cornersUtm.NW[0])}`,
      `V2 (NE): N ${r(ped.cornersUtm.NE[1])} · E ${r(ped.cornersUtm.NE[0])}`,
      `V3 (SE): N ${r(ped.cornersUtm.SE[1])} · E ${r(ped.cornersUtm.SE[0])}`,
      `V4 (SW): N ${r(ped.cornersUtm.SW[1])} · E ${r(ped.cornersUtm.SW[0])}`,
      `Cara norte (centro): N ${r(ped.caraNorteUtm.N)} · E ${r(ped.caraNorteUtm.E_centro)}`,
    );
    if (kind === "manifestacion" && pertenencias.length > 0) {
      lines.push(`Pertenencias diseñadas: ${pertenencias.length}`);
    }
    lines.push("Nota: vacancia y prelación indicativas; confirmar en OJV y Boletín Oficial.");
  }

  if (contact.notes?.trim()) {
    lines.push("", "Comentarios del solicitante:", contact.notes.trim());
  }

  return lines.join("\n").slice(0, 3950);
}
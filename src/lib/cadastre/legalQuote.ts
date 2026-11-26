import { getLegalService } from "./legalServices";
import { validateLegalContact, type LegalContactFields, type LegalServiceType } from "./legalRequest";

export type LegalApplicantType = "persona" | "sociedad";
export type LegalTiming = "evaluacion" | "prioritario" | "presupuesto";

export interface LegalQuoteDetails {
  service: LegalServiceType;
  region: string;
  comuna: string;
  areaHa: number;
  requestCount: number;
  applicantType: LegalApplicantType;
  hasDesign: boolean;
  timing: LegalTiming;
}

export const LEGAL_APPLICANT_LABELS: Record<LegalApplicantType, string> = {
  persona: "Persona natural",
  sociedad: "Sociedad o persona jurídica",
};

export const LEGAL_TIMING_LABELS: Record<LegalTiming, string> = {
  evaluacion: "Evaluar viabilidad antes de decidir",
  prioritario: "Existe una fecha de ingreso prioritaria",
  presupuesto: "Solicitar alcance y presupuesto",
};

export function quoteTotalAreaHa(details: Pick<LegalQuoteDetails, "areaHa" | "requestCount">): number {
  return details.areaHa * details.requestCount;
}

export function validateLegalQuote(details: LegalQuoteDetails): string | null {
  if (details.region.trim().length < 2) return "Indica la región del sector.";
  if (details.comuna.trim().length < 2) return "Indica la comuna o localidad del sector.";
  if (!Number.isFinite(details.areaHa) || details.areaHa <= 0) {
    return "Ingresa una superficie mayor que cero.";
  }
  if (details.service === "pedimento" && details.areaHa > 5000) {
    return "Un pedimento no puede superar 5.000 ha por solicitud.";
  }
  if (details.service === "manifestacion" && details.areaHa > 10) {
    return "Cada pertenencia de manifestación debe tener entre 1 y 10 ha.";
  }
  if (details.service === "manifestacion" && details.areaHa < 1) {
    return "Cada pertenencia de manifestación debe tener entre 1 y 10 ha.";
  }
  if (!Number.isInteger(details.requestCount) || details.requestCount < 1 || details.requestCount > 20) {
    return "Indica entre 1 y 20 solicitudes por cotización.";
  }
  return null;
}

export function formatLegalQuoteMessage(
  details: LegalQuoteDetails,
  contact: LegalContactFields & { notes?: string },
): string {
  const service = getLegalService(details.service);
  const area = details.areaHa.toLocaleString("es-CL", { maximumFractionDigits: 2 });
  const total = quoteTotalAreaHa(details).toLocaleString("es-CL", { maximumFractionDigits: 2 });
  const lines = [
    `[COTIZACIÓN LEGAL MINERA] ${service.title}`,
    `Región: ${details.region.trim()}`,
    `Comuna / localidad: ${details.comuna.trim()}`,
    `Superficie por solicitud: ${area} ha`,
    `Número de solicitudes: ${details.requestCount}`,
    `Superficie total preliminar: ${total} ha`,
    `Solicitante: ${LEGAL_APPLICANT_LABELS[details.applicantType]}`,
    `Diseño catastral disponible: ${details.hasDesign ? "Sí" : "No; requiere diseño o revisión"}`,
    `Prioridad declarada: ${LEGAL_TIMING_LABELS[details.timing]}`,
    "Honorarios profesionales y gastos externos: a confirmar por el equipo antes de cualquier presentación.",
  ];
  if (contact.phone?.trim()) lines.push(`Teléfono / WhatsApp: ${contact.phone.trim()}`);
  if (contact.notes?.trim()) lines.push("", "Antecedentes del solicitante:", contact.notes.trim());
  lines.push(
    "",
    "Nota: esta solicitud no confirma vacancia, prelación, aceptación del encargo ni presentación judicial. La revisión debe verificar OJV, Boletín Oficial y antecedentes formales.",
  );
  return lines.join("\n").slice(0, 3950);
}

export function validateLegalQuoteSubmission(
  details: LegalQuoteDetails,
  contact: LegalContactFields,
): string | null {
  return validateLegalQuote(details) ?? validateLegalContact(contact);
}

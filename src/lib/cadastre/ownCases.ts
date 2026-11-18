// Causas propias (Valle Escondido SpA) guardadas en este navegador: blindaje contra
// diseñar sobre una solicitud propia y semáforo del plazo de pago de tasa (TGR).
// El plazo se cuenta desde la fecha registrada (proxy de asignación de rol): confirmar en OJV.
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";

export type CaseDecision = "pagar" | "dejar_vencer" | "evaluar";
export type OwnCase = {
  id: string;
  name: string;
  rit: string | null;
  court: string | null;
  filedAt: string; // YYYY-MM-DD
  ha: number | null;
  decision: CaseDecision;
  paid: boolean;
  note?: string;
  geometry?: Feature<Polygon> | null;
};

export const TGR_DAYS = 30;
const KEY = "gc:own-cases:v1";

const seed = (name: string, rit: string, court: string, filedAt: string, ha: number | null, decision: CaseDecision, note?: string): OwnCase =>
  ({ id: `${rit}-${name}`, name, rit, court, filedAt, ha, decision, paid: false, note, geometry: null });

/** Solicitudes del 17-nov-2026 según la auditoría de esta conversación (sin geometría cargada). */
export const SEED_CASES: OwnCase[] = [
  seed("MARTINA 13", "V-326-2026", "Juzgado de Letras de Los Vilos", "2026-11-17", 300, "pagar", "Flanco suroeste Tilama"),
  seed("FRENTE LOS VILOS 3", "V-328-2026", "Juzgado de Letras de Los Vilos", "2026-11-17", 220, "evaluar", "Colinda con núcleo Tilama, sin faena visible"),
  seed("MARTINA SATURNO", "V-327-2026", "Juzgado de Letras de Los Vilos", "2026-11-17", 300, "dejar_vencer", "Labor ocupada por terceros"),
  seed("ELARA LAS PALMAS", "V-443-2026", "Juzgado de Letras de La Ligua", "2026-11-17", 300, "dejar_vencer", "Desplazada 3,6 km de la faena"),
  seed("LEONOR CANGALLA", "V-444-2026", "Juzgado de Letras de La Ligua", "2026-11-17", 300, "dejar_vencer", "Fondo agrícola"),
  seed("LEONOR LOS SAPOS", "V-249-2026", "—", "2026-11-17", 300, "dejar_vencer", "18,8 km de la trinchera"),
  seed("ELARA CALIFORNIA", "V-166-2026", "—", "2026-11-17", 300, "dejar_vencer", "19 km de la faena"),
  seed("MARTINA INDIO", "V-540-2026", "Juzgado de Letras de Illapel", "2026-11-17", 300, "dejar_vencer", "8,8 km de la faena"),
  seed("LEONOR COLLIGUAY", "V-132-2026", "—", "2026-11-17", 300, "dejar_vencer", "7,4 km de la faena"),
  seed("LEONOR HONDA", "V-133-2026", "—", "2026-11-17", 300, "dejar_vencer", "2,6 km de la faena"),
];

export function loadCases(): OwnCase[] {
  if (typeof window === "undefined") return SEED_CASES;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OwnCase[]) : SEED_CASES;
  } catch { return SEED_CASES; }
}
export function saveCases(list: OwnCase[]) {
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export type TgrLevel = "pagada" | "vencida" | "urgente" | "proxima" | "holgada" | "dejar_vencer";
export function tgrStatus(c: Pick<OwnCase, "filedAt" | "paid" | "decision">, today: string) {
  const deadline = addDays(c.filedAt, TGR_DAYS);
  const left = daysBetween(today, deadline);
  let level: TgrLevel;
  if (c.paid) level = "pagada";
  else if (c.decision === "dejar_vencer") level = "dejar_vencer";
  else if (left < 0) level = "vencida";
  else if (left <= 5) level = "urgente";
  else if (left <= 15) level = "proxima";
  else level = "holgada";
  return { deadline, left, level };
}

/** Hectáreas de traslape entre un polígono y las causas propias con geometría. */
export function overlapsWithOwn(poly: Feature<Polygon>, cases: OwnCase[]) {
  const out: { name: string; rit: string | null; ha: number }[] = [];
  for (const c of cases) {
    if (!c.geometry || c.decision === "dejar_vencer") continue;
    const inter = turf.intersect(turf.featureCollection([poly, c.geometry]));
    if (!inter) continue;
    const ha = turf.area(inter) / 10_000;
    if (ha > 0.01) out.push({ name: c.name, rit: c.rit, ha: Math.round(ha * 100) / 100 });
  }
  return out;
}

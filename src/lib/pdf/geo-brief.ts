// Sprint 5.2: PDF ligero para Geo-Intel Brief
import { jsPDF } from "jspdf";
import { createState, drawHeader, drawFooter, h1, h2, p, bullet, calloutBox, PAGE, COLORS, setRGB } from "./primitives";

export interface BriefEvidence {
  project?: { name?: string; code?: string; commodity?: string } | null;
  point: { lat: number; lng: number; radius_m: number };
  nearby_targets?: Array<{ code: string; name: string; priority: string; stage: string; score?: number; dist_m: number; rationale?: string }>;
  nearby_holes?: Array<{ hole_id: string; status: string; actual_depth?: number; target_zone?: string }>;
  best_intercepts?: Array<{ hole_id: string; depth_from: number; depth_to: number; au_gpt?: number; cu_pct?: number; lithology?: string; alteration?: string }>;
  lithology?: Array<{ unit_code: string; name: string; rock_type?: string; age?: string }>;
  alteration?: Array<{ zone_code: string; name: string; assemblage?: string; intensity?: string }>;
  expiring_permits?: Array<{ title: string; permit_type: string; expires_at?: string }>;
  concessions?: Array<{ code: string; name: string; status: string; holder?: string; area_ha?: number }>;
}

/** Render markdown lite: ##, **, lines, bullets. */
function renderMarkdown(s: ReturnType<typeof createState>, md: string) {
  const lines = md.split(/\r?\n/);
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) { p(s, buffer.join(" ")); buffer = []; }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith("## ")) { flush(); h2(s, line.slice(3).replace(/\*\*/g, "")); continue; }
    if (line.startsWith("# ")) { flush(); h2(s, line.slice(2).replace(/\*\*/g, "")); continue; }
    if (/^[-•*]\s+/.test(line)) {
      flush();
      bullet(s, [line.replace(/^[-•*]\s+/, "").replace(/\*\*/g, "")]);
      continue;
    }
    buffer.push(line.replace(/\*\*/g, ""));
  }
  flush();
}

export function generateGeoBriefPdf(brief: string, evidence: BriefEvidence): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const s = createState(doc);
  drawHeader(s);
  drawFooter(s);

  // Cover-ish title
  setRGB(doc, "text", COLORS.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("GEO-INTEL BRIEF", PAGE.margin, s.cursorY + 4);
  s.cursorY += 10;
  setRGB(doc, "text", COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(
    `${evidence.project?.name ?? "Proyecto"} [${evidence.project?.code ?? "—"}] · ${evidence.project?.commodity ?? "—"}`,
    PAGE.margin, s.cursorY,
  );
  s.cursorY += 5;
  doc.text(
    `Punto: ${evidence.point.lat.toFixed(5)}, ${evidence.point.lng.toFixed(5)} · radio ${evidence.point.radius_m} m · ${new Date().toLocaleString("es-CL")}`,
    PAGE.margin, s.cursorY,
  );
  s.cursorY += 8;

  h1(s, "Síntesis Geológica IA");
  renderMarkdown(s, brief);

  // Evidence appendix
  h1(s, "Evidencia consultada");

  if (evidence.nearby_targets?.length) {
    h2(s, "Targets cercanos");
    bullet(s, evidence.nearby_targets.map((t) =>
      `${t.code} ${t.name} — prioridad ${t.priority} · etapa ${t.stage} · score ${t.score ?? "—"} · ${t.dist_m.toFixed(0)} m${t.rationale ? ` — ${t.rationale}` : ""}`,
    ));
  }

  if (evidence.best_intercepts?.length) {
    h2(s, "Intercepts destacados (Au ≥ 0.3 g/t)");
    bullet(s, evidence.best_intercepts.map((i) =>
      `${i.hole_id} ${i.depth_from}-${i.depth_to} m · Au ${i.au_gpt ?? "—"} g/t${i.cu_pct ? ` · Cu ${i.cu_pct}%` : ""}${i.lithology ? ` · ${i.lithology}` : ""}${i.alteration ? ` / ${i.alteration}` : ""}`,
    ));
  }

  if (evidence.nearby_holes?.length) {
    h2(s, "Sondajes del proyecto");
    bullet(s, evidence.nearby_holes.map((h) =>
      `${h.hole_id} · ${h.status}${h.actual_depth ? ` · ${h.actual_depth} m` : ""}${h.target_zone ? ` → ${h.target_zone}` : ""}`,
    ));
  }

  if (evidence.lithology?.length) {
    h2(s, "Marco litológico");
    bullet(s, evidence.lithology.map((l) =>
      `${l.unit_code} ${l.name}${l.rock_type ? ` (${l.rock_type})` : ""}${l.age ? ` · ${l.age}` : ""}`,
    ));
  }

  if (evidence.alteration?.length) {
    h2(s, "Zonas de alteración");
    bullet(s, evidence.alteration.map((a) =>
      `${a.zone_code} ${a.name}${a.assemblage ? ` · ${a.assemblage}` : ""}${a.intensity ? ` · intensidad ${a.intensity}` : ""}`,
    ));
  }

  if (evidence.expiring_permits?.length) {
    h2(s, "Permisos críticos");
    calloutBox(
      s,
      "Atención",
      evidence.expiring_permits.map((p) => `${p.title} (${p.permit_type}) vence ${p.expires_at}`).join(" · "),
    );
  }

  if (evidence.concessions?.length) {
    h2(s, "Concesiones del proyecto");
    bullet(s, evidence.concessions.map((c) =>
      `${c.code} ${c.name} [${c.status}]${c.area_ha ? ` · ${c.area_ha} ha` : ""}${c.holder ? ` · ${c.holder}` : ""}`,
    ));
  }

  // Footer disclaimer
  s.cursorY += 4;
  setRGB(doc, "text", COLORS.hint);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text(
    "Documento generado por GeoCopilot. Las recomendaciones requieren validación de un Geólogo Competente (NI 43-101 / JORC).",
    PAGE.margin, s.cursorY + 4,
  );

  return doc;
}

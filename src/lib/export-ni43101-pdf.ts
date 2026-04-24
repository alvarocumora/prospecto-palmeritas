import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import type { GeologyData } from "@/hooks/useGeologyData";
import type { GeophysicsData } from "@/hooks/useGeophysicsData";
import { captureElement } from "./pdf/captureMap";
import {
  createState,
  drawFooter,
  drawHeader,
} from "./pdf/primitives";
import {
  PROJECT,
  fillToc,
  renderAnnexA,
  renderAnnexB,
  renderAnnexC_Compliance,
  renderCover,
  renderExecSummary,
  renderSection10_QAQC,
  renderSection11_DataVerification,
  renderSection12_Budget,
  renderSection13_Conclusions,
  renderSection14_References,
  renderSection1_Intro,
  renderSection2_Reliance,
  renderSection3_Property,
  renderSection3bis_Zoning,
  renderSection4_Climate,
  renderSection5_History,
  renderSection6_Geology,
  renderSection7_DepositType,
  renderSection8_Exploration,
  renderSection9_Drilling,
  renderTocPlaceholder,
  type ComplianceAnnexData,
  type Ni43101Validations,
} from "./pdf/sections";

export type { Ni43101Validations };

async function fetchAssayCount(projectId: string | null | undefined): Promise<number> {
  if (!projectId) return 0;
  try {
    const { count, error } = await supabase
      .from("drill_core_logs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .not("au_gpt", "is", null);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/* ============================================================
   DATA FETCHERS
   ============================================================ */

async function fetchGeology(): Promise<GeologyData | null> {
  try {
    const [litho, alteration, minerals, features, references] = await Promise.all([
      supabase.from("lithology_units").select("*").order("display_order"),
      supabase.from("alteration_zones").select("*").order("display_order"),
      supabase.from("mineralogy").select("*").order("display_order"),
      supabase.from("geological_features").select("*").order("feature_code"),
      supabase.from("geo_references").select("*").order("year", { ascending: false }),
    ]);
    return {
      litho: (litho.data ?? []) as GeologyData["litho"],
      alteration: (alteration.data ?? []) as GeologyData["alteration"],
      minerals: (minerals.data ?? []) as GeologyData["minerals"],
      features: (features.data ?? []) as GeologyData["features"],
      references: (references.data ?? []) as GeologyData["references"],
    };
  } catch (err) {
    console.warn("[pdf] fetchGeology failed:", err);
    return null;
  }
}

async function fetchGeophysics(): Promise<GeophysicsData | null> {
  try {
    const [surveys, lines, stations] = await Promise.all([
      supabase.from("geophysics_surveys").select("*").order("display_order"),
      supabase.from("geophysics_lines").select("*").order("line_id"),
      supabase.from("geophysics_stations").select("*").order("station_id"),
    ]);
    return {
      surveys: (surveys.data ?? []) as GeophysicsData["surveys"],
      lines: (lines.data ?? []) as unknown as GeophysicsData["lines"],
      stations: (stations.data ?? []) as GeophysicsData["stations"],
    };
  } catch (err) {
    console.warn("[pdf] fetchGeophysics failed:", err);
    return null;
  }
}

type CatastroRow = {
  tipo: string;
  rol: string;
  nombre: string;
  titular: string;
  ha: string;
  venc: string;
  intersects: boolean;
};

async function fetchCatastro(): Promise<CatastroRow[]> {
  try {
    const [{ loadCatastro }, { loadAoiPolygon }, leafletMod, turfBI] = await Promise.all([
      import("@/components/map/catastroLayer"),
      import("@/components/map/aoiPolygon"),
      import("leaflet"),
      import("@turf/boolean-intersects"),
    ]);
    const L = (leafletMod as unknown as { default: typeof import("leaflet") }).default;
    const halfKm = 8;
    const halfDeg = halfKm / 111;
    const [lat, lng] = [PROJECT.coords.lat, PROJECT.coords.lng];
    const bbox = {
      minLng: lng - halfDeg,
      minLat: lat - halfDeg,
      maxLng: lng + halfDeg,
      maxLat: lat + halfDeg,
    };
    const result = await loadCatastro(L, bbox);
    const aoi = await loadAoiPolygon();
    const booleanIntersects = (turfBI as { default: typeof import("@turf/boolean-intersects").default }).default;

    const tipoLabels: Record<string, string> = {
      EXPLOTA_1983: "Explot. 1983",
      EXPLOTA_1932: "Explot. 1932",
      EXPLORA_1983: "Explor. 1983",
      ESTACAMENTO: "Estacamento",
    };

    const rows: CatastroRow[] = [];
    for (const [origen, feats] of Object.entries(result.featuresByOrigen)) {
      for (const f of feats) {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        let intersects = false;
        if (aoi && (f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon")) {
          try {
            intersects = booleanIntersects(aoi, f);
          } catch {
            // ignore
          }
        }
        const venc = p.FECHA_VENCIMIENTO != null && Number.isFinite(Number(p.FECHA_VENCIMIENTO))
          ? new Date(Number(p.FECHA_VENCIMIENTO)).toLocaleDateString("es-CL")
          : "—";
        rows.push({
          tipo: tipoLabels[origen] ?? origen,
          rol: `${p.NUMERO_ROL ?? "—"}${p.DV_ROL ? `-${p.DV_ROL}` : ""}`,
          nombre: (p.NOMBRE as string) ?? "—",
          titular: (p.TITULAR_DIVISION as string) ?? "—",
          ha: p.HECTAREAS != null ? Number(p.HECTAREAS).toFixed(1) : "—",
          venc,
          intersects,
        });
      }
    }
    return rows;
  } catch (err) {
    console.warn("[pdf] fetchCatastro failed:", err);
    return [];
  }
}

/* ============================================================
   ENTRY POINT
   ============================================================ */

type InternalConcessionRow = {
  code: string;
  name: string;
  holder: string;
  type: string;
  status: string;
  area_ha: string;
  expires: string;
};

async function fetchInternalConcessions(projectId: string | null | undefined): Promise<InternalConcessionRow[]> {
  if (!projectId) return [];
  try {
    const { data, error } = await supabase
      .from("mining_concessions")
      .select("code,name,holder,concession_type,status,area_ha,expires_at")
      .eq("project_id", projectId);
    if (error || !data) return [];
    return (data as Array<{
      code: string;
      name: string;
      holder: string | null;
      concession_type: string;
      status: string;
      area_ha: number | null;
      expires_at: string | null;
    }>).map((r) => ({
      code: r.code,
      name: r.name,
      holder: r.holder ?? "—",
      type: r.concession_type,
      status: r.status,
      area_ha: r.area_ha != null ? Number(r.area_ha).toFixed(1) : "—",
      expires: r.expires_at ? new Date(r.expires_at).toLocaleDateString("es-CL") : "—",
    }));
  } catch (err) {
    console.warn("[pdf] fetchInternalConcessions failed:", err);
    return [];
  }
}

export type Ni43101TocEntry = { label: string; level: number; page: number };
export type Ni43101Result = {
  blob: Blob;
  url: string;
  toc: Ni43101TocEntry[];
  totalPages: number;
  filename: string;
  validations: Ni43101Validations;
};

export type Ni43101SectionId =
  | "execSummary"
  | "intro"
  | "reliance"
  | "property"
  | "zoning"
  | "climate"
  | "history"
  | "geology"
  | "depositType"
  | "exploration"
  | "drilling"
  | "qaqc"
  | "dataVerification"
  | "budget"
  | "conclusions"
  | "references"
  | "annexA"
  | "annexB"
  | "annexC";

export const ALL_SECTIONS: Ni43101SectionId[] = [
  "execSummary","intro","reliance","property","zoning","climate","history","geology",
  "depositType","exploration","drilling","qaqc","dataVerification","budget",
  "conclusions","references","annexA","annexB","annexC",
];

async function fetchComplianceAnnex(reportId: string | null | undefined): Promise<ComplianceAnnexData | null> {
  if (!reportId) return null;
  try {
    const { data: report } = await supabase
      .from("technical_reports")
      .select("id, active_standards, compliance_threshold, compliance_score_cached, compliance_evaluated_at")
      .eq("id", reportId)
      .maybeSingle();
    if (!report) return null;
    const stds = (report.active_standards as string[] | null) ?? ["ni43101"];
    const [{ data: rules }, { data: evals }, { data: links }] = await Promise.all([
      supabase.from("compliance_rules").select("id, standard, rule_code, title, severity").in("standard", stds as any).order("display_order"),
      supabase.from("compliance_evaluations").select("rule_id, status, auto_evaluated").eq("report_id", reportId),
      supabase.from("report_evidence_links").select("rule_id").eq("report_id", reportId),
    ]);
    const evCount = new Map<string, number>();
    for (const l of links ?? []) {
      if (!l.rule_id) continue;
      evCount.set(l.rule_id, (evCount.get(l.rule_id) ?? 0) + 1);
    }
    const evalMap = new Map((evals ?? []).map((e: any) => [e.rule_id, e]));
    const byStd: ComplianceAnnexData["byStandard"] = {};
    const threshold = report.compliance_threshold ?? 95;
    const detailRules: ComplianceAnnexData["rules"] = [];
    for (const std of stds) {
      const stdRules = (rules ?? []).filter((r: any) => r.standard === std);
      let weighted = 0, weight = 0, mPass = 0, mTotal = 0;
      for (const r of stdRules as any[]) {
        const w = r.severity === "mandatory" ? 1.0 : r.severity === "recommended" ? 0.3 : 0.1;
        weight += w;
        const ev: any = evalMap.get(r.id);
        if (ev?.status === "pass") weighted += w;
        else if (ev?.status === "warn") weighted += w * 0.5;
        if (r.severity === "mandatory") {
          mTotal += 1;
          if (ev?.status === "pass") mPass += 1;
        }
        detailRules.push({
          rule_code: r.rule_code,
          standard: r.standard,
          title: r.title,
          severity: r.severity,
          status: (ev?.status ?? "pending"),
          auto: !!ev?.auto_evaluated,
          evidence_count: evCount.get(r.id) ?? 0,
        });
      }
      const score = weight > 0 ? Math.round((weighted / weight) * 100) : 0;
      byStd[std] = {
        score,
        status: score >= threshold ? "compliant" : score >= 70 ? "partial" : "non_compliant",
        mandatory_pass: mPass,
        mandatory_total: mTotal,
        rules_total: stdRules.length,
      };
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return {
      reportId,
      globalScore: report.compliance_score_cached ?? 0,
      threshold,
      evaluatedAt: report.compliance_evaluated_at,
      byStandard: byStd,
      rules: detailRules,
      verifyUrl: `${origin}/api/public/verify-compliance/${reportId}`,
    };
  } catch {
    return null;
  }
}

export async function exportNI43101(opts: {
  setActive?: (id: string) => void;
  getCurrent?: () => string;
  mapSelector?: string;
  basemap?: "satellite" | "topo";
  includeInternalConcessions?: boolean;
  includeZoning?: boolean;
  projectId?: string | null;
  /** Optional report id to include Annex C compliance certificate. */
  reportId?: string | null;
  onProgress?: (step: string | { label: string; current: number; total: number; phase?: string }) => void;
  /** When true, returns blob/url/toc instead of triggering a download. */
  preview?: boolean;
  /** Subset of sections to render. If omitted, all sections are included. */
  sections?: Ni43101SectionId[];
  /**
   * Switch the live map's basemap before snapshot capture.
   * Used to capture both topo and satellite views with active overlays.
   */
  setBasemap?: (b: "satellite" | "topo") => void | Promise<void>;
} = {}): Promise<Ni43101Result | void> {
  const {
    setActive,
    getCurrent,
    mapSelector = "[data-export-map]",
    basemap = "topo",
    includeInternalConcessions = true,
    includeZoning = true,
    projectId = null,
    reportId = null,
    onProgress,
    sections,
    setBasemap,
  } = opts;
  const enabled = new Set<Ni43101SectionId>(sections ?? ALL_SECTIONS);
  const has = (id: Ni43101SectionId) => enabled.has(id);
  const original = getCurrent?.();

  // Switch to overview/geology to ensure map is mounted before capture.
  setActive?.("overview");
  await new Promise((r) => setTimeout(r, 300));

  // ---- Primary map snapshot (topo basemap with active overlays) ----
  onProgress?.("Capturando mapa principal (topo + capas activas)…");
  if (setBasemap) {
    await setBasemap("topo");
    // Allow tile layer swap + overlay re-render
    await new Promise((r) => setTimeout(r, 900));
  }
  let mapFig = await captureElement(mapSelector, { scale: 2 });
  if (!mapFig) {
    setActive?.("geology");
    await new Promise((r) => setTimeout(r, 800));
    mapFig = await captureElement(mapSelector, { scale: 2 });
  }

  // ---- Satellite snapshot (only if zoning section enabled OR explicit basemap) ----
  let satelliteFig: string | null = null;
  const wantSatellite = (includeZoning && has("zoning")) || basemap === "satellite";
  if (wantSatellite) {
    onProgress?.("Conmutando basemap a satélite y capturando capas activas…");
    if (setBasemap) {
      await setBasemap("satellite");
      // Wait for satellite tiles + overlays to redraw
      await new Promise((r) => setTimeout(r, 1200));
    } else {
      // No basemap controller wired — fallback small delay
      await new Promise((r) => setTimeout(r, 500));
    }
    satelliteFig = await captureElement(mapSelector, { scale: 2 });
    // Restore topo basemap for the user
    if (setBasemap) {
      await setBasemap("topo");
    }
  }

  // Parallel data fetch
  onProgress?.("Cargando catastro y datos geológicos…");
  const [geo, geophys, catastroRows, internalConcessions, assayCount] = await Promise.all([
    fetchGeology(),
    fetchGeophysics(),
    fetchCatastro(),
    includeInternalConcessions ? fetchInternalConcessions(projectId) : Promise.resolve<InternalConcessionRow[]>([]),
    fetchAssayCount(projectId),
  ]);

  // Compute validation context
  const validations: Ni43101Validations = {
    assaysStatus: assayCount === 0 ? "pending" : assayCount < 20 ? "partial" : "available",
    assaysCount: assayCount,
    catastroAvailable: catastroRows.length > 0,
    catastroCount: catastroRows.length,
    satelliteAvailable: !!satelliteFig,
    mapAvailable: !!mapFig,
    geologyAvailable: !!(geo && geo.litho.length > 0),
  };

  // Restore original tab
  if (original && setActive) setActive(original);

  // Build PDF — granular progress per section, yielding to the event loop
  // so the UI can paint between renders.
  const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

  // Build the ordered render plan from the enabled set.
  type RenderStep = { id: Ni43101SectionId | "cover" | "toc"; label: string; run: () => void };
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const s = createState(doc);

  const plan: RenderStep[] = [
    { id: "cover", label: "Portada", run: () => renderCover(s, mapFig) },
    { id: "toc", label: "Índice (placeholder)", run: () => renderTocPlaceholder(s) },
  ];
  if (has("execSummary")) plan.push({ id: "execSummary", label: "Resumen ejecutivo", run: () => renderExecSummary(s) });
  if (has("intro")) plan.push({ id: "intro", label: "§1 Introducción", run: () => renderSection1_Intro(s) });
  if (has("reliance")) plan.push({ id: "reliance", label: "§2 Confianza en otros expertos", run: () => renderSection2_Reliance(s) });
  if (has("property")) plan.push({ id: "property", label: "§3 Descripción y ubicación (mapa + catastro)", run: () => renderSection3_Property(s, mapFig, catastroRows, validations) });
  if (includeZoning && has("zoning")) plan.push({ id: "zoning", label: "§3.bis Zonificación geológica (satélite)", run: () => renderSection3bis_Zoning(s, satelliteFig, geo, internalConcessions.length) });
  if (has("climate")) plan.push({ id: "climate", label: "§4 Clima e infraestructura", run: () => renderSection4_Climate(s) });
  if (has("history")) plan.push({ id: "history", label: "§5 Historia", run: () => renderSection5_History(s) });
  if (has("geology")) plan.push({ id: "geology", label: "§6 Geología local y regional", run: () => renderSection6_Geology(s, geo) });
  if (has("depositType")) plan.push({ id: "depositType", label: "§7 Tipo de depósito", run: () => renderSection7_DepositType(s, geo) });
  if (has("exploration")) plan.push({ id: "exploration", label: "§8 Exploración (geofísica/geoquímica)", run: () => renderSection8_Exploration(s, geophys) });
  if (has("drilling")) plan.push({ id: "drilling", label: "§9 Sondajes", run: () => renderSection9_Drilling(s) });
  if (has("qaqc")) plan.push({ id: "qaqc", label: "§10 QA/QC", run: () => renderSection10_QAQC(s, validations) });
  if (has("dataVerification")) plan.push({ id: "dataVerification", label: "§11 Verificación de datos", run: () => renderSection11_DataVerification(s, validations) });
  if (has("budget")) plan.push({ id: "budget", label: "§12 Presupuesto", run: () => renderSection12_Budget(s) });
  if (has("conclusions")) plan.push({ id: "conclusions", label: "§13 Conclusiones", run: () => renderSection13_Conclusions(s) });
  if (has("references")) plan.push({ id: "references", label: "§14 Referencias", run: () => renderSection14_References(s, geo?.references ?? []) });
  if (has("annexA")) plan.push({ id: "annexA", label: "Anexo A · Catastro", run: () => renderAnnexA(s, catastroRows, internalConcessions, validations) });
  if (has("annexB")) plan.push({ id: "annexB", label: "Anexo B · Geofísica", run: () => renderAnnexB(s, geophys) });

  // Add finalization steps to total so bar reflects real work.
  const finalizationSteps = 2; // header/footer pass + TOC fill
  const total = plan.length + finalizationSteps;
  let tocPageNum = 0;

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    onProgress?.({ label: `Renderizando ${step.label}…`, current: i + 1, total, phase: "render" });
    step.run();
    if (step.id === "toc") tocPageNum = s.pageNum;
    // Yield every 2 steps to let the UI repaint without slowing things down too much.
    if (i % 2 === 1) await yieldToUi();
  }

  // Re-stamp header/footer on every non-cover page (cover is page 1)
  onProgress?.({ label: "Aplicando encabezado y pie de página…", current: plan.length + 1, total, phase: "finalize" });
  await yieldToUi();
  const totalPages = s.doc.getNumberOfPages();
  for (let pg = 2; pg <= totalPages; pg++) {
    s.doc.setPage(pg);
    drawHeader({ ...s, pageNum: pg });
    drawFooter({ ...s, pageNum: pg }, totalPages);
  }

  // Fill TOC entries on the reserved page
  onProgress?.({ label: "Generando índice (TOC)…", current: plan.length + 2, total, phase: "finalize" });
  await yieldToUi();
  fillToc(s, tocPageNum, totalPages);

  const filename = `${PROJECT.ref}_Informe_NI43-101_${new Date().toISOString().slice(0, 10)}.pdf`;

  if (opts.preview) {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    return {
      blob,
      url,
      toc: s.toc.map((e) => ({ label: e.label, level: e.level, page: e.page })),
      totalPages,
      filename,
      validations,
    };
  }

  doc.save(filename);
}

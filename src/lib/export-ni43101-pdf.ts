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
  type Ni43101Validations,
} from "./pdf/sections";

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

export async function exportNI43101(opts: {
  setActive?: (id: string) => void;
  getCurrent?: () => string;
  mapSelector?: string;
  basemap?: "satellite" | "topo";
  includeInternalConcessions?: boolean;
  includeZoning?: boolean;
  projectId?: string | null;
  onProgress?: (step: string) => void;
  /** When true, returns blob/url/toc instead of triggering a download. */
  preview?: boolean;
} = {}): Promise<Ni43101Result | void> {
  const {
    setActive,
    getCurrent,
    mapSelector = "[data-export-map]",
    basemap = "topo",
    includeInternalConcessions = true,
    includeZoning = true,
    projectId = null,
    onProgress,
  } = opts;
  const original = getCurrent?.();

  // Switch to overview/geology to ensure map is mounted before capture.
  setActive?.("overview");
  await new Promise((r) => setTimeout(r, 300));

  // Primary map snapshot (topo by default).
  onProgress?.("Capturando mapa principal…");
  let mapFig = await captureElement(mapSelector, { scale: 2 });
  if (!mapFig) {
    setActive?.("geology");
    await new Promise((r) => setTimeout(r, 800));
    mapFig = await captureElement(mapSelector, { scale: 2 });
  }

  // Optional second snapshot for satellite/zoning section.
  let satelliteFig: string | null = null;
  if (includeZoning || basemap === "satellite") {
    onProgress?.("Capturando vista satelital…");
    // small delay to allow user-facing basemap toggle (handled by caller via setActive callbacks if wired)
    await new Promise((r) => setTimeout(r, 400));
    satelliteFig = await captureElement(mapSelector, { scale: 2 });
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

  // Build PDF
  onProgress?.("Compilando PDF…");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const s = createState(doc);

  // Cover (page 1)
  renderCover(s, mapFig);

  // TOC placeholder (page 2)
  renderTocPlaceholder(s);
  const tocPageNum = s.pageNum;

  // Executive summary (page 3+)
  renderExecSummary(s);

  // Sections
  renderSection1_Intro(s);
  renderSection2_Reliance(s);
  renderSection3_Property(s, mapFig, catastroRows, validations);
  if (includeZoning) {
    renderSection3bis_Zoning(s, satelliteFig, geo, internalConcessions.length);
  }
  renderSection4_Climate(s);
  renderSection5_History(s);
  renderSection6_Geology(s, geo);
  renderSection7_DepositType(s, geo);
  renderSection8_Exploration(s, geophys);
  renderSection9_Drilling(s);
  renderSection10_QAQC(s, validations);
  renderSection11_DataVerification(s, validations);
  renderSection12_Budget(s);
  renderSection13_Conclusions(s);
  renderSection14_References(s, geo?.references ?? []);

  // Annexes (catastro SERNAGEOMIN + concesiones internas)
  renderAnnexA(s, catastroRows, internalConcessions, validations);
  renderAnnexB(s, geophys);

  // Re-stamp header/footer on every non-cover page (cover is page 1)
  const totalPages = s.doc.getNumberOfPages();
  for (let pg = 2; pg <= totalPages; pg++) {
    s.doc.setPage(pg);
    drawHeader({ ...s, pageNum: pg });
    drawFooter({ ...s, pageNum: pg }, totalPages);
  }

  // Fill TOC entries on the reserved page
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

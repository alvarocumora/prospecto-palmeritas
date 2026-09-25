import { CHOLQUI, CHOLQUI_POINTS, CHOLQUI_ASSAYS } from "@/features/franco/data/cholqui";
import { bboxFromPoints, type ProjectSpatialContext, type ProjectSpatialPoint } from "@/lib/spatial/projectSpatialContext";

const CRS = "EPSG:24879";
export function buildCholquiSpatialContext(): ProjectSpatialContext {
  const assays = new Map(CHOLQUI_ASSAYS.map((a)=>[a.sample.replace("-", ""), a]));
  const points: ProjectSpatialPoint[] = CHOLQUI_POINTS.map((p) => {
    const assay = assays.get(p.code.replace("-", ""));
    return { id:p.code, projectId:CHOLQUI.ref, label:p.name,
      original:{ easting:p.utmE, northing:p.utmN, crs:CRS }, wgs84:{ lat:p.lat, lng:p.lng },
      provenance: assay ? "CERTIFIED" : "DOCUMENTARY", qc:{ status:"verified", notes:["WGS84 coordinate already stored with source point"] },
      properties:{ commodity:CHOLQUI.commodity, assayReportId:assay?.reportId ?? null, cuTotalPct:assay?.cuTotalPct ?? null, cuSolublePct:assay?.cuSolublePct ?? null, auGpt:assay?.auGpt ?? null, agPpm:assay?.agPpm ?? null } };
  });
  return { projectId:CHOLQUI.ref, countryCode:"CL", authority:"SERNAGEOMIN", bboxWgs84:bboxFromPoints(points,0.015), points, generatedAt:new Date().toISOString() };
}
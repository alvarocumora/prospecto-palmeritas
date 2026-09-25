import type { CanonicalConcession } from "@/lib/cadastre/types";
import type { ProjectSpatialContext } from "@/lib/spatial/projectSpatialContext";
import { canonicalAssetKey } from "./graph";
import type { MiningAssetNode } from "./types";

export function concessionNode(projectId:string, concession:CanonicalConcession, authority:string):MiningAssetNode {
  return {
    id: `cadastre:${concession.country}:${authority}:${concession.code}`,
    projectId,
    nodeType:"concession",
    canonicalKey:canonicalAssetKey("concession",[concession.country,authority,concession.code]),
    entityId:null,
    label:concession.name ?? concession.code,
    commodity:concession.commodity,
    provenance:"OFFICIAL", confidence:1, status:concession.statusNormalized,
    sourceRef:concession.sourceUrl ?? concession.source,
    metadata:{officialCode:concession.code,authority,country:concession.country,holder:concession.holder,holderTaxId:concession.holderTaxId,areaHa:concession.areaHa,type:concession.type,rawStatus:concession.status},
  };
}

export function spatialEvidenceNodes(context:ProjectSpatialContext):MiningAssetNode[] {
  return context.points.map((p)=>({
    id:`spatial:${context.projectId}:${p.id}`, projectId:context.projectId,
    nodeType:p.properties.assayReportId?"assay":"sample",
    canonicalKey:canonicalAssetKey(p.properties.assayReportId?"assay":"sample",[p.id]), entityId:null,
    label:p.label, commodity:String(p.properties.commodity??"")||null, provenance:p.provenance,
    confidence:p.qc.status==="verified"?1:p.qc.status==="review"?0.5:0, status:p.qc.status,
    sourceRef:String(p.properties.assayReportId??"")||null,
    metadata:{original:p.original,wgs84:p.wgs84,qc:p.qc,properties:p.properties},
  }));
}

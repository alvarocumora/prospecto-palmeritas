import type { AnomalyCandidate, EvidenceLink, TechnicalFinding } from "@/lib/mining-intelligence/types";
import type { ProjectSpatialContext } from "@/lib/spatial/projectSpatialContext";

const R=6371000;
function distanceM(a:{lat:number;lng:number},b:{lat:number;lng:number}){const d=Math.PI/180,dp=(b.lat-a.lat)*d,dl=(b.lng-a.lng)*d;const x=Math.sin(dp/2)**2+Math.cos(a.lat*d)*Math.cos(b.lat*d)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function centroid(g:GeoJSON.Geometry):{lat:number;lng:number}|null {
 if(g.type==="Point"){const c=g.coordinates;return {lng:c[0],lat:c[1]};}
 return null;
}
export function convergeProjectEvidence(anomaly:AnomalyCandidate,context:ProjectSpatialContext,maxDistanceM=1000):TechnicalFinding {
 const c=centroid(anomaly.geometry); const evidence:EvidenceLink[]=[];
 if(c) for(const p of context.points){if(!p.wgs84)continue;const d=distanceM(c,p.wgs84);if(d<=maxDistanceM)evidence.push({anomalyId:anomaly.id,evidenceId:p.id,evidenceType:p.properties.assayReportId?"assay":"sample",distanceM:Math.round(d),provenance:p.provenance});}
 evidence.sort((a,b)=>(a.distanceM??Infinity)-(b.distanceM??Infinity));
 return {anomaly,evidence,conclusion:evidence.length?"Spectral candidate spatially converges with project evidence; geological validation is still required.":"Spectral candidate has no nearby project evidence within the configured radius.",limitations:["Spectral response is derived evidence, not proof of mineralization.","Distance-based convergence does not establish geological continuity.","Thresholds require calibration by geology, season and sensor conditions."]};
}
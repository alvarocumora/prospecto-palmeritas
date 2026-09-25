import type { SpectralObservation, AnomalyCandidate } from "@/lib/mining-intelligence/types";

export type SpectralMetrics = { ndvi:number|null; ndmi:number|null; ironOxideRatio:number|null; swirContrast:number|null };
export type BandSample = { b02:number; b04:number; b08:number; b11:number; b12:number };
const ratio=(a:number,b:number)=>Math.abs(b)<1e-12?null:a/b;
const nd=(a:number,b:number)=>Math.abs(a+b)<1e-12?null:(a-b)/(a+b);
export function computeSpectralMetrics(b:BandSample):SpectralMetrics {
  return { ndvi:nd(b.b08,b.b04), ndmi:nd(b.b08,b.b11), ironOxideRatio:ratio(b.b04,b.b02), swirContrast:ratio(b.b11,b.b12) };
}
export type AnomalyThresholds={ironOxideRatioMin:number;swirContrastMin:number;maxNdvi:number};
export const DEFAULT_THRESHOLDS:AnomalyThresholds={ironOxideRatioMin:1.5,swirContrastMin:1.1,maxNdvi:0.35};
export function classifySpectralCandidate(obs:SpectralObservation[], t=DEFAULT_THRESHOLDS):AnomalyCandidate|null {
  const values=Object.fromEntries(obs.map(o=>[o.metric,o.value]));
  const signals=obs.filter(o=>o.metric==="ironOxideRatio"||o.metric==="swirContrast");
  const vegetation=values.ndvi;
  const hits=(values.ironOxideRatio>=t.ironOxideRatioMin?1:0)+(values.swirContrast>=t.swirContrastMin?1:0);
  if(hits===0 || (typeof vegetation==="number"&&vegetation>t.maxNdvi)) return null;
  const first=obs[0]; if(!first) return null;
  return { id:`ANOM-${first.id}`,projectId:"",geometry:first.geometry,signals:signals.map(s=>({metric:s.metric,value:s.value,sceneId:s.sceneId})),confidence:hits>=2?"high":"medium",provenance:"DERIVED",interpretation:null };
}
import { Link } from "@tanstack/react-router";
import { AlertTriangle, MapPin } from "lucide-react";
import { PIPELINE_LABEL, type PipelineDeal } from "@/lib/dealPipeline.functions";

export function PipelineDealCard({ deal }: { deal: PipelineDeal }) {
  const high = deal.alerts.filter((a) => !a.resolved && a.priority === "ALTA").length;
  const mid = deal.alerts.filter((a) => !a.resolved && a.priority === "MEDIA").length;
  const ha = deal.profile.aoi_ha;
  const cmp = deal.profile.comparable;
  return (
    <Link
      to="/dashboard/pipeline/$code"
      params={{ code: deal.code }}
      className="block rounded-md border border-hairline bg-surface-3 p-3 hover:border-accent-brand transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-content-subtle">{deal.code}</span>
        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-accent-brand/40 text-accent-brand">
          {PIPELINE_LABEL[deal.pipeline_stage] ?? deal.pipeline_stage}
        </span>
      </div>
      <div className="mt-1 font-display text-base text-content leading-tight">{deal.name}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-content-subtle">
        {deal.commodity && (
          <span className="px-1.5 py-0.5 rounded bg-accent-brand/10 text-accent-brand font-semibold">
            {deal.commodity}
          </span>
        )}
        {ha != null && <span>{ha.toLocaleString("es-CL")} ha</span>}
      </div>
      {deal.region && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-content-subtle">
          <MapPin className="w-3 h-3" /> {deal.region}
        </div>
      )}
      {(high > 0 || mid > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Array.from({ length: high }).map((_, i) => (
            <span
              key={`h${i}`}
              className="inline-flex items-center gap-1 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-destructive/10 text-destructive"
            >
              <AlertTriangle className="w-2.5 h-2.5" /> Alta
            </span>
          ))}
          {mid > 0 && (
            <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700">
              <AlertTriangle className="w-2.5 h-2.5" /> {mid} media
            </span>
          )}
        </div>
      )}
      {cmp?.name && (
        <div className="mt-2 inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-hairline text-content-subtle">
          Ref. {cmp.name}
          {cmp.ticker ? ` · ${cmp.ticker}` : ""}
        </div>
      )}
    </Link>
  );
}

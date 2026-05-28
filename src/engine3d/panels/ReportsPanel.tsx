// ReportsPanel — Sprint 5
// Genera y exporta reportes JSON/HTML del estado actual del motor.
import { useMemo, useState } from "react";
import { FileText, X, Download, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildReport,
  renderReportHtml,
  downloadString,
  campaignCost as computeCampaignCost,
  type ReportInput,
  type ReportJson,
} from "@/engine3d/reports/reportGenerator";
import { auditTrail } from "@/engine3d/qaqc/auditTrail";

type Props = {
  input: Omit<ReportInput, "generatedAt" | "campaignCost"> & { campaignCost?: number };
  onClose: () => void;
};

export function ReportsPanel({ input, onClose }: Props) {
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString());

  const report: ReportJson = useMemo(() => {
    const campaignCost = input.campaignCost ?? computeCampaignCost(input.scenarioTargets);
    return buildReport({ ...input, generatedAt, campaignCost });
  }, [input, generatedAt]);

  const handleExport = (format: "json" | "html") => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "json") {
      downloadString(`mining-report-${ts}.json`, JSON.stringify(report, null, 2), "application/json");
    } else {
      downloadString(`mining-report-${ts}.html`, renderReportHtml(report), "text/html");
    }
    auditTrail.log("section.export", { kind: `report.${format}`, projectId: input.projectId });
  };

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-[min(820px,94%)] max-h-[90%] overflow-hidden bg-black/90 backdrop-blur rounded-lg border border-amber-500/40 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-amber-500/10">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-300" />
          <span className="text-xs font-mono uppercase tracking-wider text-amber-200">
            Reports · {report.sections.length} secciones
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setGeneratedAt(new Date().toISOString())}>
            Refresh
          </Button>
          <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-[11px] font-mono">
        <div className="text-[9px] text-muted-foreground">
          Generado {new Date(report.generatedAt).toLocaleString()} · Proyecto {report.projectId}
        </div>
        {report.sections.map((s) => (
          <section key={s.id}>
            <div className="text-[11px] uppercase tracking-wider text-amber-200 mb-1">{s.title}</div>
            <ul className="list-disc list-inside space-y-0.5 text-foreground/85 pl-1">
              {s.body.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </section>
        ))}
      </div>

      <div className="border-t border-border p-3 bg-black/40 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px]" onClick={() => handleExport("json")}>
          <Code2 className="w-3 h-3 mr-1" /> Export JSON
        </Button>
        <Button size="sm" className="flex-1 h-7 text-[10px]" onClick={() => handleExport("html")}>
          <Download className="w-3 h-3 mr-1" /> Export HTML
        </Button>
      </div>
    </div>
  );
}

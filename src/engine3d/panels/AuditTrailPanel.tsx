// Audit Trail Panel — Sprint 4
// Visualiza eventos del audit log, permite exportar y limpiar.
import { useEffect, useState } from "react";
import { X, Download, Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auditTrail, type AuditEvent } from "@/engine3d/qaqc/auditTrail";

type Props = { onClose: () => void };

export function AuditTrailPanel({ onClose }: Props) {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => auditTrail.subscribe(setEvents), []);

  function downloadJson() {
    const blob = new Blob([auditTrail.export()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="absolute inset-2 z-30 bg-black/95 backdrop-blur rounded-lg border border-border flex flex-col font-mono text-[11px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 uppercase tracking-wider text-[10px] text-violet-300">
          <History className="w-3.5 h-3.5" /> Audit trail · {events.length} eventos
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            onClick={downloadJson}
            disabled={!events.length}
          >
            <Download className="w-3 h-3 mr-1" /> Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] text-red-400"
            onClick={() => auditTrail.clear()}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Clear
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {events.length === 0 && (
          <div className="text-muted-foreground">No hay eventos registrados todavía.</div>
        )}
        {[...events].reverse().map((e) => (
          <div key={e.id} className="border border-border/60 rounded px-2 py-1.5 bg-black/40">
            <div className="flex items-center justify-between">
              <span className="text-violet-300 uppercase text-[10px]">{e.type}</span>
              <span className="text-muted-foreground text-[9px]">
                {new Date(e.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="text-[9px] text-emerald-300">scenario: {e.scenarioId}</div>
            <pre className="text-[9px] text-muted-foreground mt-1 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
              {JSON.stringify(e.payload, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

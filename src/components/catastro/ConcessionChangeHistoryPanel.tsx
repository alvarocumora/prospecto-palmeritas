import { useState } from "react";
import { ChevronDown, ChevronRight, Building2, Ruler, Activity, History } from "lucide-react";
import {
  useConcessionChangeSummary,
  useConcessionChangeHistory,
  type ConcessionFieldChange,
} from "@/hooks/useConcessionFieldChanges";

interface Props {
  projectId: string | null;
}

const FIELD_META: Record<ConcessionFieldChange["field"], { label: string; icon: typeof Building2; color: string }> = {
  holder:  { label: "Titular", icon: Building2, color: "text-blue-500" },
  area_ha: { label: "Área (ha)", icon: Ruler, color: "text-amber-500" },
  status:  { label: "Estado", icon: Activity, color: "text-emerald-500" },
};

export function ConcessionChangeHistoryPanel({ projectId }: Props) {
  const { data: summary, loading } = useConcessionChangeSummary(projectId);
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading) {
    return <div className="text-xs font-mono text-muted-foreground p-3">Cargando historial…</div>;
  }

  if (!summary.length) {
    return (
      <div className="text-xs font-mono text-muted-foreground p-3 border border-border rounded">
        Aún no hay cambios registrados. Cuando una concesión sincronice y cambie su titular, área o estado, aparecerá aquí.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wide">
        <History className="w-3.5 h-3.5" />
        Historial de cambios · {summary.length} concesiones con actividad
      </div>

      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead className="bg-bg-secondary text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 w-6"></th>
              <th className="text-left px-3 py-2">Concesión</th>
              <th className="text-right px-3 py-2">Cambios</th>
              <th className="text-right px-3 py-2">Titular</th>
              <th className="text-right px-3 py-2">Área</th>
              <th className="text-right px-3 py-2">Estado</th>
              <th className="text-left px-3 py-2">Último cambio</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row) => {
              const isOpen = openId === row.concession_id;
              const hasChanges = row.total_changes > 0;
              return (
                <>
                  <tr
                    key={row.concession_id}
                    className={`border-t border-border ${hasChanges ? "cursor-pointer hover:bg-accent/50" : "opacity-60"}`}
                    onClick={() => hasChanges && setOpenId(isOpen ? null : row.concession_id)}
                  >
                    <td className="px-3 py-2">
                      {hasChanges && (isOpen
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-foreground font-semibold">{row.code ?? "—"}</div>
                      <div className="text-muted-foreground text-[10px]">{row.name ?? ""}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-foreground font-semibold">
                      {row.total_changes}
                    </td>
                    <td className="px-3 py-2 text-right">{row.holder_changes || "—"}</td>
                    <td className="px-3 py-2 text-right">{row.area_changes || "—"}</td>
                    <td className="px-3 py-2 text-right">{row.status_changes || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.last_changed_at
                        ? new Date(row.last_changed_at).toLocaleString("es-CL")
                        : "—"}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${row.concession_id}-detail`} className="bg-bg-secondary/40">
                      <td colSpan={7} className="px-3 py-3">
                        <ConcessionChangeTimeline concessionId={row.concession_id} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConcessionChangeTimeline({ concessionId }: { concessionId: string }) {
  const { data, loading } = useConcessionChangeHistory(concessionId);
  if (loading) return <div className="text-muted-foreground text-[11px]">Cargando…</div>;
  if (!data.length) return <div className="text-muted-foreground text-[11px]">Sin cambios.</div>;

  return (
    <ol className="space-y-1.5">
      {data.map((c) => {
        const meta = FIELD_META[c.field];
        const Icon = meta.icon;
        return (
          <li key={c.id} className="flex items-start gap-2 text-[11px]">
            <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.color}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-foreground font-semibold">{meta.label}</span>
                <span className="text-muted-foreground">
                  {c.old_value ?? "—"} <span className="text-muted-foreground/50">→</span>{" "}
                  <span className="text-foreground">{c.new_value ?? "—"}</span>
                </span>
              </div>
              <div className="text-muted-foreground/70 text-[10px]">
                {new Date(c.changed_at).toLocaleString("es-CL")} · fuente: {c.source}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

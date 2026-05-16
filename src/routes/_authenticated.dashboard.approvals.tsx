import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "@/hooks/useProjects";
import { useProjectRole, canAccess } from "@/hooks/useProjectRole";
import { useRecordApproval, type ApprovableTable } from "@/hooks/useRecordApproval";
import {
  RecordStatusBadge,
  RECORD_STATUSES,
  type RecordStatus,
} from "@/components/RecordStatusBadge";
import { ClipboardCheck, CheckCircle2, Eye, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/approvals")({
  head: () => ({ meta: [{ title: "Aprobaciones — Trackmin GeoIntel" }] }),
  component: ApprovalsPage,
});

type Row = {
  id: string;
  record_status: string;
  created_by: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  label: string;
  detail: string;
};

function ApprovalsPage() {
  const { active } = useProjects();
  const role = useProjectRole();
  const { setStatus, bulkSetStatus } = useRecordApproval();

  const [tab, setTab] = useState<ApprovableTable>("drill_core_logs");
  const [filter, setFilter] = useState<RecordStatus>("review");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canApprove = canAccess(role, "audit"); // owner/admin/PM/chief_geologist

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    setSelected(new Set());
    (async () => {
      if (tab === "drill_core_logs") {
        const { data } = await supabase
          .from("drill_core_logs")
          .select(
            "id, record_status, created_by, created_at, approved_by, approved_at, depth_from, depth_to, lithology, au_gpt, hole_id",
          )
          .eq("project_id", active.id)
          .eq("record_status", filter)
          .order("created_at", { ascending: false })
          .limit(500);
        setRows(
          (data ?? []).map((r) => ({
            id: r.id,
            record_status: r.record_status,
            created_by: r.created_by,
            created_at: r.created_at,
            approved_by: r.approved_by,
            approved_at: r.approved_at,
            label: `${r.depth_from}–${r.depth_to} m`,
            detail: `${r.lithology ?? "—"} · Au ${r.au_gpt ?? "—"} g/t`,
          })),
        );
      } else {
        const { data } = await supabase
          .from("sampling_results")
          .select(
            "id, record_status, created_by, created_at, approved_by, approved_at, sample_code, sample_type, au_gpt, ag_gpt, cu_pct",
          )
          .eq("project_id", active.id)
          .eq("record_status", filter)
          .order("created_at", { ascending: false })
          .limit(500);
        setRows(
          (data ?? []).map((r) => ({
            id: r.id,
            record_status: r.record_status,
            created_by: r.created_by,
            created_at: r.created_at,
            approved_by: r.approved_by,
            approved_at: r.approved_at,
            label: r.sample_code,
            detail: `${r.sample_type} · Au ${r.au_gpt ?? "—"} · Ag ${r.ag_gpt ?? "—"} · Cu ${r.cu_pct ?? "—"}%`,
          })),
        );
      }
      setLoading(false);
    })();
  }, [active, tab, filter]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      selected: selected.size,
    }),
    [rows, selected],
  );

  if (!active)
    return <div className="p-8 text-sm text-muted-foreground">Selecciona un proyecto.</div>;

  async function reload() {
    setFilter((f) => f); // trigger effect
    const ev = new Event("storage");
    window.dispatchEvent(ev);
    // simple refetch via state toggle
    setLoading(true);
    setTimeout(() => setLoading(false), 50);
  }

  async function changeStatus(id: string, next: RecordStatus) {
    const { error } = await setStatus(tab, id, next);
    if (error) toast.error(error);
    else {
      toast.success(`Estado → ${next}`);
      setRows((rs) => rs.filter((r) => r.id !== id));
    }
  }

  async function bulkChange(next: RecordStatus) {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await bulkSetStatus(tab, ids, next);
    if (error) toast.error(error);
    else {
      toast.success(`${ids.length} registros → ${next}`);
      setRows((rs) => rs.filter((r) => !selected.has(r.id)));
      setSelected(new Set());
    }
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) => (s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-20 md:pb-8">
      <header className="mb-6">
        <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          Proyecto · {active.code}
        </div>
        <h1 className="text-xl md:text-2xl font-bold mt-1 inline-flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-gold" /> Aprobaciones
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Workflow <span className="font-mono">draft → review → approved → archived</span>. Solo
          registros aprobados aparecen en reportes oficiales y mapa público.
        </p>
        {!canApprove && (
          <div className="mt-2 text-[11px] font-mono text-gold border border-gold/30 bg-gold/5 rounded px-2 py-1 inline-block">
            Tu rol no puede aprobar. Puedes ver y filtrar.
          </div>
        )}
      </header>

      {/* Tabs entidad */}
      <div className="flex gap-1 border-b border-border mb-3">
        <TabBtn
          active={tab === "drill_core_logs"}
          onClick={() => setTab("drill_core_logs")}
          label="Logs de sondaje"
        />
        <TabBtn
          active={tab === "sampling_results"}
          onClick={() => setTab("sampling_results")}
          label="Resultados de muestreo"
        />
      </div>

      {/* Filtro estado */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {RECORD_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-2 py-1 text-[10px] font-mono uppercase rounded border transition-colors ${
              filter === s
                ? "bg-gold/15 text-gold border-gold/40"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {s}
          </button>
        ))}
        <div className="ml-auto text-[11px] font-mono text-muted-foreground">
          {stats.total} registros · {stats.selected} seleccionados
        </div>
      </div>

      {/* Bulk actions */}
      {canApprove && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <BulkBtn
            onClick={() => bulkChange("review")}
            Icon={Eye}
            label="Marcar Revisión"
            tone="gold"
          />
          <BulkBtn
            onClick={() => bulkChange("approved")}
            Icon={CheckCircle2}
            label="Aprobar"
            tone="teal"
          />
          <BulkBtn onClick={() => bulkChange("draft")} Icon={RotateCcw} label="Volver a borrador" />
          <BulkBtn onClick={() => bulkChange("archived")} Icon={Archive} label="Archivar" />
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-border bg-bg-secondary p-8 text-center text-xs font-mono text-muted-foreground">
          Sin registros en estado <b>{filter}</b>.
        </div>
      ) : (
        <div className="rounded border border-border bg-bg-secondary overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground font-mono uppercase text-[10px]">
              <tr>
                {canApprove && (
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === rows.length && rows.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-left px-3 py-2">Registro</th>
                <th className="text-left px-3 py-2">Detalle</th>
                <th className="text-left px-3 py-2">Creado</th>
                <th className="text-right px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                  {canApprove && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <RecordStatusBadge status={r.record_status} />
                  </td>
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.detail}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canApprove ? (
                      <div className="inline-flex gap-1">
                        {r.record_status !== "review" && (
                          <RowBtn
                            onClick={() => changeStatus(r.id, "review")}
                            title="Marcar para revisión"
                            Icon={Eye}
                          />
                        )}
                        {r.record_status !== "approved" && (
                          <RowBtn
                            onClick={() => changeStatus(r.id, "approved")}
                            title="Aprobar"
                            Icon={CheckCircle2}
                            tone="teal"
                          />
                        )}
                        {r.record_status !== "draft" && (
                          <RowBtn
                            onClick={() => changeStatus(r.id, "draft")}
                            title="Volver a borrador"
                            Icon={RotateCcw}
                          />
                        )}
                        {r.record_status !== "archived" && (
                          <RowBtn
                            onClick={() => changeStatus(r.id, "archived")}
                            title="Archivar"
                            Icon={Archive}
                          />
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-mono border-b-2 -mb-px transition-colors ${
        active
          ? "border-gold text-gold"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function BulkBtn({
  onClick,
  Icon,
  label,
  tone,
}: {
  onClick: () => void;
  Icon: typeof Eye;
  label: string;
  tone?: "teal" | "gold";
}) {
  const toneCls =
    tone === "teal"
      ? "border-teal/40 text-teal hover:bg-teal/10"
      : tone === "gold"
        ? "border-gold/40 text-gold hover:bg-gold/10"
        : "border-border text-muted-foreground hover:bg-accent";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-[11px] font-mono rounded border inline-flex items-center gap-1.5 ${toneCls}`}
    >
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}

function RowBtn({
  onClick,
  Icon,
  title,
  tone,
}: {
  onClick: () => void;
  Icon: typeof Eye;
  title: string;
  tone?: "teal";
}) {
  const toneCls =
    tone === "teal"
      ? "border-teal/40 text-teal hover:bg-teal/10"
      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1 rounded border ${toneCls}`}
    >
      <Icon className="w-3 h-3" />
    </button>
  );
}

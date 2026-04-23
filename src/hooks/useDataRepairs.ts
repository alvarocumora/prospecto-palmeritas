// Repair engine for data validation issues. Each repair runs a SELECT-based dry-run
// preview, then optionally applies an UPDATE. All operations are scoped to the active project.
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RepairId =
  | "drill-status-normalize"
  | "core-record-status-normalize"
  | "target-stage-normalize"
  | "target-priority-normalize"
  | "patent-status-normalize"
  | "core-orphan-flag"
  | "geo-station-orphan-flag"
  | "campaign-default-phase";

export interface RepairPreviewRow {
  id: string;
  label: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface RepairDefinition {
  id: RepairId;
  title: string;
  description: string;
  table: string;
  category: "enum" | "orphan" | "default";
  /** Builds the dry-run preview without writing anything. */
  preview: (projectId: string) => Promise<RepairPreviewRow[]>;
  /** Applies the repair and returns count of affected rows. */
  apply: (projectId: string, rows: RepairPreviewRow[]) => Promise<number>;
}

const DRILL_STATUS_MAP: Record<string, string> = {
  "in-progress": "in_progress",
  "in progress": "in_progress",
  active: "in_progress",
  done: "completed",
  finished: "completed",
  closed: "completed",
  pending: "planned",
  draft: "proposed",
  canceled: "cancelled",
};
const VALID_DRILL_STATUS = new Set(["proposed", "planned", "in_progress", "completed", "abandoned", "cancelled"]);

const RECORD_STATUS_MAP: Record<string, string> = {
  pending: "draft",
  open: "draft",
  reviewed: "approved",
  validated: "approved",
  closed: "archived",
  done: "approved",
};
const VALID_RECORD_STATUS = new Set(["draft", "review", "approved", "archived"]);

const STAGE_MAP: Record<string, string> = {
  new: "generated",
  initial: "generated",
  open: "generated",
  validating: "validated",
  ranking: "ranked",
  drilling: "drilled",
  done: "closed",
  archived: "closed",
};
const VALID_STAGE = new Set(["generated", "validated", "ranked", "drilled", "closed"]);

const PRIORITY_MAP: Record<string, string> = {
  hi: "high",
  med: "medium",
  lo: "low",
  urgent: "critical",
  normal: "medium",
  none: "low",
};
const VALID_PRIORITY = new Set(["low", "medium", "high", "critical"]);

const PATENT_STATUS_MAP: Record<string, string> = {
  open: "pending",
  due: "pending",
  unpaid: "pending",
  paying: "pending",
  late: "overdue",
  expired: "overdue",
  exempt: "waived",
  cancelled: "waived",
};
const VALID_PATENT_STATUS = new Set(["pending", "paid", "overdue", "waived"]);

function normalizeEnum(raw: unknown, valid: Set<string>, map: Record<string, string>): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (valid.has(s)) return null;
  const mapped = map[s];
  if (mapped && valid.has(mapped)) return mapped;
  return null;
}

export const REPAIRS: RepairDefinition[] = [
  {
    id: "drill-status-normalize",
    title: "Normalizar status de sondajes",
    description: "Reemplaza valores fuera de enum (in-progress→in_progress, done→completed, etc.)",
    table: "drill_holes",
    category: "enum",
    preview: async (projectId) => {
      const { data } = await supabase.from("drill_holes").select("id,hole_id,status").eq("project_id", projectId);
      return (data ?? []).flatMap((r) => {
        const next = normalizeEnum(r.status, VALID_DRILL_STATUS, DRILL_STATUS_MAP);
        if (!next) return [];
        return [{ id: r.id, label: r.hole_id ?? r.id.slice(0, 8), before: { status: r.status }, after: { status: next } }];
      });
    },
    apply: async (_projectId, rows) => {
      let count = 0;
      for (const row of rows) {
        const { error } = await supabase.from("drill_holes").update({ status: row.after.status as string }).eq("id", row.id);
        if (!error) count++;
      }
      return count;
    },
  },
  {
    id: "core-record-status-normalize",
    title: "Normalizar record_status de core logs",
    description: "Mapea reviewed/validated→approved, pending→draft, closed→archived.",
    table: "drill_core_logs",
    category: "enum",
    preview: async (projectId) => {
      const { data } = await supabase.from("drill_core_logs").select("id,depth_from,depth_to,record_status").eq("project_id", projectId);
      return (data ?? []).flatMap((r) => {
        const next = normalizeEnum(r.record_status, VALID_RECORD_STATUS, RECORD_STATUS_MAP);
        if (!next) return [];
        return [{
          id: r.id,
          label: `${Number(r.depth_from).toFixed(1)}–${Number(r.depth_to).toFixed(1)} m`,
          before: { record_status: r.record_status },
          after: { record_status: next },
        }];
      });
    },
    apply: async (_projectId, rows) => {
      let count = 0;
      for (const row of rows) {
        const { error } = await supabase.from("drill_core_logs").update({ record_status: row.after.record_status as string }).eq("id", row.id);
        if (!error) count++;
      }
      return count;
    },
  },
  {
    id: "target-stage-normalize",
    title: "Normalizar stage de targets",
    description: "Mapea new/initial→generated, drilling→drilled, archived→closed.",
    table: "exploration_targets",
    category: "enum",
    preview: async (projectId) => {
      const { data } = await supabase.from("exploration_targets").select("id,code,stage").eq("project_id", projectId);
      return (data ?? []).flatMap((r) => {
        const next = normalizeEnum(r.stage, VALID_STAGE, STAGE_MAP);
        if (!next) return [];
        return [{ id: r.id, label: r.code ?? r.id.slice(0, 8), before: { stage: r.stage }, after: { stage: next } }];
      });
    },
    apply: async (_projectId, rows) => {
      let count = 0;
      for (const row of rows) {
        const { error } = await supabase.from("exploration_targets").update({ stage: row.after.stage as string }).eq("id", row.id);
        if (!error) count++;
      }
      return count;
    },
  },
  {
    id: "target-priority-normalize",
    title: "Normalizar priority de targets",
    description: "Mapea hi→high, med→medium, urgent→critical, etc.",
    table: "exploration_targets",
    category: "enum",
    preview: async (projectId) => {
      const { data } = await supabase.from("exploration_targets").select("id,code,priority").eq("project_id", projectId);
      return (data ?? []).flatMap((r) => {
        const next = normalizeEnum(r.priority, VALID_PRIORITY, PRIORITY_MAP);
        if (!next) return [];
        return [{ id: r.id, label: r.code ?? r.id.slice(0, 8), before: { priority: r.priority }, after: { priority: next } }];
      });
    },
    apply: async (_projectId, rows) => {
      let count = 0;
      for (const row of rows) {
        const { error } = await supabase.from("exploration_targets").update({ priority: row.after.priority as string }).eq("id", row.id);
        if (!error) count++;
      }
      return count;
    },
  },
  {
    id: "patent-status-normalize",
    title: "Normalizar status de patentes",
    description: "Mapea unpaid/due→pending, late/expired→overdue, exempt→waived.",
    table: "concession_patents",
    category: "enum",
    preview: async (projectId) => {
      const { data } = await supabase.from("concession_patents").select("id,year,status").eq("project_id", projectId);
      return (data ?? []).flatMap((r) => {
        const next = normalizeEnum(r.status, VALID_PATENT_STATUS, PATENT_STATUS_MAP);
        if (!next) return [];
        return [{ id: r.id, label: `Patente ${r.year}`, before: { status: r.status }, after: { status: next } }];
      });
    },
    apply: async (_projectId, rows) => {
      let count = 0;
      for (const row of rows) {
        const { error } = await supabase.from("concession_patents").update({ status: row.after.status as string }).eq("id", row.id);
        if (!error) count++;
      }
      return count;
    },
  },
  {
    id: "core-orphan-flag",
    title: "Marcar core logs huérfanos",
    description: "Cambia a record_status='review' los logs cuyo hole_id no existe (referencia rota).",
    table: "drill_core_logs",
    category: "orphan",
    preview: async (projectId) => {
      const [{ data: logs }, { data: holes }] = await Promise.all([
        supabase.from("drill_core_logs").select("id,hole_id,depth_from,depth_to,record_status").eq("project_id", projectId),
        supabase.from("drill_holes").select("id").eq("project_id", projectId),
      ]);
      const holeIds = new Set((holes ?? []).map((h) => h.id));
      return (logs ?? []).flatMap((r) => {
        if (!r.hole_id || holeIds.has(r.hole_id)) return [];
        if (r.record_status === "review") return [];
        return [{
          id: r.id,
          label: `${Number(r.depth_from).toFixed(1)}–${Number(r.depth_to).toFixed(1)} m`,
          before: { record_status: r.record_status, hole_id: r.hole_id },
          after: { record_status: "review", hole_id: r.hole_id },
        }];
      });
    },
    apply: async (_projectId, rows) => {
      let count = 0;
      for (const row of rows) {
        const { error } = await supabase.from("drill_core_logs").update({ record_status: "review" }).eq("id", row.id);
        if (!error) count++;
      }
      return count;
    },
  },
  {
    id: "geo-station-orphan-flag",
    title: "Marcar estaciones geofísicas huérfanas",
    description: "Añade nota '[ORPHAN]' a estaciones sin survey_id válido.",
    table: "geophysics_stations",
    category: "orphan",
    preview: async (projectId) => {
      const [{ data: stations }, { data: surveys }] = await Promise.all([
        supabase.from("geophysics_stations").select("id,station_id,survey_id,notes").eq("project_id", projectId),
        supabase.from("geophysics_surveys").select("id").eq("project_id", projectId),
      ]);
      const surveyIds = new Set((surveys ?? []).map((s) => s.id));
      return (stations ?? []).flatMap((r) => {
        const orphan = !r.survey_id || !surveyIds.has(r.survey_id);
        if (!orphan) return [];
        const currentNotes = r.notes ?? "";
        if (currentNotes.includes("[ORPHAN]")) return [];
        return [{
          id: r.id,
          label: r.station_id ?? r.id.slice(0, 8),
          before: { notes: currentNotes || "—" },
          after: { notes: `[ORPHAN] ${currentNotes}`.trim() },
        }];
      });
    },
    apply: async (_projectId, rows) => {
      let count = 0;
      for (const row of rows) {
        const { error } = await supabase.from("geophysics_stations").update({ notes: row.after.notes as string }).eq("id", row.id);
        if (!error) count++;
      }
      return count;
    },
  },
  {
    id: "campaign-default-phase",
    title: "Asignar phase por defecto a campañas",
    description: "Pone phase='recon' a campañas sin fase definida.",
    table: "exploration_campaigns",
    category: "default",
    preview: async (projectId) => {
      const { data } = await supabase.from("exploration_campaigns").select("id,name,phase").eq("project_id", projectId);
      return (data ?? []).flatMap((r) => {
        if (r.phase) return [];
        return [{ id: r.id, label: r.name, before: { phase: "—" }, after: { phase: "recon" } }];
      });
    },
    apply: async (_projectId, rows) => {
      let count = 0;
      for (const row of rows) {
        const { error } = await supabase.from("exploration_campaigns").update({ phase: "recon" }).eq("id", row.id);
        if (!error) count++;
      }
      return count;
    },
  },
];

export interface RepairRunState {
  preview: RepairPreviewRow[] | null;
  loading: boolean;
  applying: boolean;
  appliedCount: number | null;
  error: string | null;
}

export function useDataRepairs(projectId: string | null) {
  const [states, setStates] = useState<Record<RepairId, RepairRunState>>({} as Record<RepairId, RepairRunState>);

  const update = (id: RepairId, patch: Partial<RepairRunState>) => {
    setStates((prev) => {
      const base: RepairRunState = prev[id] ?? { preview: null, loading: false, applying: false, appliedCount: null, error: null };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  };

  const runPreview = useCallback(
    async (repair: RepairDefinition) => {
      if (!projectId) return;
      update(repair.id, { loading: true, error: null, appliedCount: null });
      try {
        const rows = await repair.preview(projectId);
        update(repair.id, { preview: rows, loading: false });
      } catch (e) {
        update(repair.id, { loading: false, error: e instanceof Error ? e.message : "preview failed" });
      }
    },
    [projectId],
  );

  const applyRepair = useCallback(
    async (repair: RepairDefinition) => {
      if (!projectId) return 0;
      const current = states[repair.id]?.preview;
      if (!current || current.length === 0) return 0;
      update(repair.id, { applying: true, error: null });
      try {
        const count = await repair.apply(projectId, current);
        update(repair.id, { applying: false, appliedCount: count, preview: [] });
        return count;
      } catch (e) {
        update(repair.id, { applying: false, error: e instanceof Error ? e.message : "apply failed" });
        return 0;
      }
    },
    [projectId, states],
  );

  const clear = useCallback((id: RepairId) => {
    setStates((prev) => ({ ...prev, [id]: { preview: null, loading: false, applying: false, appliedCount: null, error: null } }));
  }, []);

  return { states, runPreview, applyRepair, clear, repairs: REPAIRS };
}

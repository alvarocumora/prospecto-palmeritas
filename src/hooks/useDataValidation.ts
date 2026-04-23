import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TableAudit = {
  table: string;
  label: string;
  group: string;
  count: number;
  expectedMin?: number;
  status: "ok" | "warn" | "empty" | "error";
  error?: string;
};

export type Inconsistency = {
  id: string;
  severity: "error" | "warn" | "info";
  table: string;
  rule: string;
  detail: string;
  count: number;
};

export type ValidationReport = {
  tables: TableAudit[];
  inconsistencies: Inconsistency[];
  totals: { ok: number; warn: number; empty: number; error: number; rows: number };
  generatedAt: string;
};

const SEED_TABLES: { table: string; label: string; group: string; expectedMin?: number }[] = [
  { table: "projects", label: "Proyectos", group: "CORE", expectedMin: 1 },
  { table: "exploration_campaigns", label: "Campañas", group: "CORE", expectedMin: 1 },
  { table: "mining_concessions", label: "Concesiones", group: "CADASTRE", expectedMin: 1 },
  { table: "concession_holders", label: "Titulares", group: "CADASTRE" },
  { table: "concession_patents", label: "Patentes", group: "CADASTRE" },
  { table: "concession_overlaps", label: "Overlaps", group: "CADASTRE" },
  { table: "concession_history", label: "Historial sync", group: "CADASTRE" },
  { table: "drill_holes", label: "Sondajes", group: "FIELD" },
  { table: "drill_core_logs", label: "Core logs", group: "FIELD" },
  { table: "core_boxes", label: "Cajas core", group: "FIELD" },
  { table: "geophysics_surveys", label: "Geofísica · surveys", group: "FIELD" },
  { table: "geophysics_stations", label: "Geofísica · estaciones", group: "FIELD" },
  { table: "geophysics_lines", label: "Geofísica · líneas", group: "FIELD" },
  { table: "drone_flights", label: "Vuelos drone", group: "FIELD" },
  { table: "drone_rasters", label: "Rasters drone", group: "FIELD" },
  { table: "exploration_targets", label: "Targets", group: "ANALYSIS" },
  { table: "lithology_units", label: "Litología", group: "GEOLOGY" },
  { table: "alteration_zones", label: "Alteración", group: "GEOLOGY" },
  { table: "geological_features", label: "Estructuras", group: "GEOLOGY" },
  { table: "geo_references", label: "Referencias", group: "GEOLOGY" },
  { table: "campaign_budgets", label: "Presupuestos", group: "FINANCE" },
  { table: "campaign_expenses", label: "Gastos", group: "FINANCE" },
  { table: "qualified_persons", label: "QPs", group: "GOVERNANCE" },
  { table: "technical_reports", label: "Reportes técnicos", group: "GOVERNANCE" },
  { table: "community_events", label: "Comunidad", group: "GOVERNANCE" },
  { table: "bulletin_watches", label: "Watches boletín", group: "GOVERNANCE" },
  { table: "audit_log", label: "Audit log", group: "GOVERNANCE" },
];

const VALID_DRILL_STATUS = new Set(["proposed", "planned", "in_progress", "completed", "abandoned", "cancelled"]);
const VALID_TARGET_STAGE = new Set(["generated", "validated", "ranked", "drilled", "closed"]);
const VALID_TARGET_PRIORITY = new Set(["low", "medium", "high", "critical"]);
const VALID_PATENT_STATUS = new Set(["pending", "paid", "overdue", "waived"]);
const VALID_RECORD_STATUS = new Set(["draft", "review", "approved", "archived"]);

export function useDataValidation(projectId: string | null) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    setLoading(true);
    const tables: TableAudit[] = [];
    for (const def of SEED_TABLES) {
      try {
        let q = supabase.from(def.table as never).select("*", { count: "exact", head: true });
        if (projectId && def.table !== "projects") {
          q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq("project_id", projectId);
        }
        const { count, error } = await q;
        if (error) {
          tables.push({ ...def, count: 0, status: "error", error: error.message });
        } else {
          const c = count ?? 0;
          const status: TableAudit["status"] =
            c === 0 ? "empty" : def.expectedMin && c < def.expectedMin ? "warn" : "ok";
          tables.push({ ...def, count: c, status });
        }
      } catch (e) {
        tables.push({ ...def, count: 0, status: "error", error: e instanceof Error ? e.message : "fail" });
      }
    }

    const inconsistencies: Inconsistency[] = [];

    if (projectId) {
      // 1. Drill holes with invalid status
      const dh = await supabase.from("drill_holes").select("id,status,depth_to:actual_depth,planned_depth").eq("project_id", projectId);
      if (dh.data) {
        const bad = dh.data.filter((r) => r.status && !VALID_DRILL_STATUS.has(String(r.status)));
        if (bad.length) inconsistencies.push({
          id: "dh-status", severity: "error", table: "drill_holes",
          rule: "Status fuera de enum", detail: `Valores no válidos: ${[...new Set(bad.map((b) => b.status))].join(", ")}`, count: bad.length,
        });
      }

      // 2. Core logs depth_from >= depth_to
      const cl = await supabase.from("drill_core_logs").select("id,depth_from,depth_to,record_status").eq("project_id", projectId);
      if (cl.data) {
        const inv = cl.data.filter((r) => Number(r.depth_from) >= Number(r.depth_to));
        if (inv.length) inconsistencies.push({
          id: "cl-depth", severity: "error", table: "drill_core_logs",
          rule: "depth_from ≥ depth_to", detail: "Intervalos inválidos detectados", count: inv.length,
        });
        const badStatus = cl.data.filter((r) => r.record_status && !VALID_RECORD_STATUS.has(String(r.record_status)));
        if (badStatus.length) inconsistencies.push({
          id: "cl-rs", severity: "warn", table: "drill_core_logs",
          rule: "record_status fuera de enum", detail: [...new Set(badStatus.map((b) => b.record_status))].join(", "), count: badStatus.length,
        });
      }

      // 3. Targets enums
      const tg = await supabase.from("exploration_targets").select("id,code,stage,priority").eq("project_id", projectId);
      if (tg.data) {
        const badStage = tg.data.filter((r) => r.stage && !VALID_TARGET_STAGE.has(String(r.stage)));
        if (badStage.length) inconsistencies.push({
          id: "tg-stage", severity: "warn", table: "exploration_targets",
          rule: "stage fuera de enum", detail: [...new Set(badStage.map((b) => b.stage))].join(", "), count: badStage.length,
        });
        const badPri = tg.data.filter((r) => r.priority && !VALID_TARGET_PRIORITY.has(String(r.priority)));
        if (badPri.length) inconsistencies.push({
          id: "tg-pri", severity: "warn", table: "exploration_targets",
          rule: "priority fuera de enum", detail: [...new Set(badPri.map((b) => b.priority))].join(", "), count: badPri.length,
        });
        // Duplicate codes
        const codes = tg.data.map((r) => r.code).filter(Boolean) as string[];
        const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
        if (dupes.length) inconsistencies.push({
          id: "tg-dup", severity: "error", table: "exploration_targets",
          rule: "code duplicado", detail: `Códigos: ${[...new Set(dupes)].slice(0, 5).join(", ")}`, count: dupes.length,
        });
      }

      // 4. Drill holes duplicate hole_id
      if (dh.data) {
        const ids = (await supabase.from("drill_holes").select("hole_id").eq("project_id", projectId)).data?.map((r) => r.hole_id) ?? [];
        const dupes = ids.filter((c, i) => c && ids.indexOf(c) !== i);
        if (dupes.length) inconsistencies.push({
          id: "dh-dup", severity: "error", table: "drill_holes",
          rule: "hole_id duplicado", detail: `IDs: ${[...new Set(dupes)].slice(0, 5).join(", ")}`, count: dupes.length,
        });
      }

      // 5. Patents enum + paid without paid_at
      const pt = await supabase.from("concession_patents").select("id,status,paid_at,year").eq("project_id", projectId);
      if (pt.data) {
        const badSt = pt.data.filter((r) => r.status && !VALID_PATENT_STATUS.has(String(r.status)));
        if (badSt.length) inconsistencies.push({
          id: "pt-st", severity: "warn", table: "concession_patents",
          rule: "status fuera de enum", detail: [...new Set(badSt.map((b) => b.status))].join(", "), count: badSt.length,
        });
        const paidNoDate = pt.data.filter((r) => r.status === "paid" && !r.paid_at);
        if (paidNoDate.length) inconsistencies.push({
          id: "pt-pd", severity: "warn", table: "concession_patents",
          rule: "paid sin paid_at", detail: "Patentes marcadas como pagadas sin fecha", count: paidNoDate.length,
        });
      }

      // 6. Concessions without holder linked
      const conc = await supabase.from("mining_concessions").select("id,code,name").eq("project_id", projectId);
      if (conc.data) {
        const codes = conc.data.map((r) => r.code).filter(Boolean) as string[];
        const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
        if (dupes.length) inconsistencies.push({
          id: "mc-dup", severity: "error", table: "mining_concessions",
          rule: "code duplicado", detail: `Códigos: ${[...new Set(dupes)].slice(0, 5).join(", ")}`, count: dupes.length,
        });
      }

      // 7. Campaigns without phase
      const camp = await supabase.from("exploration_campaigns").select("id,name,phase,status").eq("project_id", projectId);
      if (camp.data) {
        const noPhase = camp.data.filter((r) => !r.phase);
        if (noPhase.length) inconsistencies.push({
          id: "camp-ph", severity: "info", table: "exploration_campaigns",
          rule: "campaña sin phase", detail: "Definir fase (recon, generative, etc.)", count: noPhase.length,
        });
      }

      // 8. Geophysics stations without survey
      const gs = await supabase.from("geophysics_stations").select("id,survey_id").eq("project_id", projectId);
      if (gs.data) {
        const orphan = gs.data.filter((r) => !r.survey_id);
        if (orphan.length) inconsistencies.push({
          id: "gs-orph", severity: "warn", table: "geophysics_stations",
          rule: "estación sin survey_id", detail: "Estaciones huérfanas sin survey vinculado", count: orphan.length,
        });
      }
    }

    const totals = tables.reduce(
      (acc, t) => {
        acc[t.status] += 1;
        acc.rows += t.count;
        return acc;
      },
      { ok: 0, warn: 0, empty: 0, error: 0, rows: 0 },
    );

    setReport({ tables, inconsistencies, totals, generatedAt: new Date().toISOString() });
    setLoading(false);
  }, [projectId]);

  useEffect(() => { run(); }, [run]);

  return { report, loading, refresh: run };
}

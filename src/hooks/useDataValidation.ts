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

export type AffectedRecord = {
  /** Primary key (uuid) of the offending row. */
  id: string;
  /** Human-readable label (code/hole_id/name). */
  label?: string;
  /** Key/value pairs of the relevant fields for triage. */
  fields: Record<string, string | number | null | undefined>;
};

export type Inconsistency = {
  id: string;
  severity: "error" | "warn" | "info";
  table: string;
  rule: string;
  detail: string;
  count: number;
  /** Optional tag to distinguish broken cross-references from enum/uniqueness checks. */
  category?: "enum" | "unique" | "xref" | "missing";
  /** Up to ~50 affected rows for in-UI triage (full count is in `count`). */
  affected?: AffectedRecord[];
};

export type ValidationReport = {
  tables: TableAudit[];
  inconsistencies: Inconsistency[];
  totals: { ok: number; warn: number; empty: number; error: number; rows: number };
  generatedAt: string;
  /** Map of table -> previous snapshot info (last sync timestamp + row count delta). */
  lastSync: Record<string, { at: string; prevCount: number; delta: number } | null>;
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

const VALID_DRILL_STATUS = new Set([
  "proposed",
  "planned",
  "in_progress",
  "completed",
  "abandoned",
  "cancelled",
]);
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
          q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq(
            "project_id",
            projectId,
          );
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
        tables.push({
          ...def,
          count: 0,
          status: "error",
          error: e instanceof Error ? e.message : "fail",
        });
      }
    }

    const inconsistencies: Inconsistency[] = [];

    if (projectId) {
      const cap = <T>(arr: T[]): T[] => arr.slice(0, 50);

      // 1. Drill holes with invalid status
      const dh = await supabase
        .from("drill_holes")
        .select("id,hole_id,status,actual_depth,planned_depth,campaign_id")
        .eq("project_id", projectId);
      if (dh.data) {
        const bad = dh.data.filter((r) => r.status && !VALID_DRILL_STATUS.has(String(r.status)));
        if (bad.length)
          inconsistencies.push({
            id: "dh-status",
            severity: "error",
            table: "drill_holes",
            rule: "Status fuera de enum",
            detail: `Valores no válidos: ${[...new Set(bad.map((b) => b.status))].join(", ")}`,
            count: bad.length,
            category: "enum",
            affected: cap(bad).map((r) => ({
              id: r.id,
              label: r.hole_id,
              fields: {
                hole_id: r.hole_id,
                status: r.status,
                planned_depth: r.planned_depth,
                actual_depth: r.actual_depth,
              },
            })),
          });
      }

      // 2. Core logs depth_from >= depth_to
      const cl = await supabase
        .from("drill_core_logs")
        .select("id,depth_from,depth_to,record_status,hole_id,lithology")
        .eq("project_id", projectId);
      if (cl.data) {
        const inv = cl.data.filter((r) => Number(r.depth_from) >= Number(r.depth_to));
        if (inv.length)
          inconsistencies.push({
            id: "cl-depth",
            severity: "error",
            table: "drill_core_logs",
            rule: "depth_from ≥ depth_to",
            detail: "Intervalos inválidos detectados",
            count: inv.length,
            affected: cap(inv).map((r) => ({
              id: r.id,
              label: `${r.depth_from}–${r.depth_to} m`,
              fields: {
                hole_id: r.hole_id,
                depth_from: r.depth_from,
                depth_to: r.depth_to,
                lithology: r.lithology,
              },
            })),
          });
        const badStatus = cl.data.filter(
          (r) => r.record_status && !VALID_RECORD_STATUS.has(String(r.record_status)),
        );
        if (badStatus.length)
          inconsistencies.push({
            id: "cl-rs",
            severity: "warn",
            table: "drill_core_logs",
            rule: "record_status fuera de enum",
            detail: [...new Set(badStatus.map((b) => b.record_status))].join(", "),
            count: badStatus.length,
            category: "enum",
            affected: cap(badStatus).map((r) => ({
              id: r.id,
              fields: {
                hole_id: r.hole_id,
                depth_from: r.depth_from,
                depth_to: r.depth_to,
                record_status: r.record_status,
              },
            })),
          });
      }

      // 3. Targets enums + duplicate codes
      const tg = await supabase
        .from("exploration_targets")
        .select("id,code,name,stage,priority,target_type,campaign_id")
        .eq("project_id", projectId);
      if (tg.data) {
        const badStage = tg.data.filter((r) => r.stage && !VALID_TARGET_STAGE.has(String(r.stage)));
        if (badStage.length)
          inconsistencies.push({
            id: "tg-stage",
            severity: "warn",
            table: "exploration_targets",
            rule: "stage fuera de enum",
            detail: [...new Set(badStage.map((b) => b.stage))].join(", "),
            count: badStage.length,
            category: "enum",
            affected: cap(badStage).map((r) => ({
              id: r.id,
              label: r.code,
              fields: { code: r.code, name: r.name, stage: r.stage },
            })),
          });
        const badPri = tg.data.filter(
          (r) => r.priority && !VALID_TARGET_PRIORITY.has(String(r.priority)),
        );
        if (badPri.length)
          inconsistencies.push({
            id: "tg-pri",
            severity: "warn",
            table: "exploration_targets",
            rule: "priority fuera de enum",
            detail: [...new Set(badPri.map((b) => b.priority))].join(", "),
            count: badPri.length,
            category: "enum",
            affected: cap(badPri).map((r) => ({
              id: r.id,
              label: r.code,
              fields: { code: r.code, name: r.name, priority: r.priority },
            })),
          });
        const codeMap = new Map<string, typeof tg.data>();
        for (const r of tg.data) {
          if (!r.code) continue;
          (codeMap.get(r.code) ?? codeMap.set(r.code, []).get(r.code)!).push(r);
        }
        const dupRows = [...codeMap.values()].filter((arr) => arr.length > 1).flat();
        if (dupRows.length)
          inconsistencies.push({
            id: "tg-dup",
            severity: "error",
            table: "exploration_targets",
            rule: "code duplicado",
            detail: `Códigos: ${[...new Set(dupRows.map((r) => r.code))].slice(0, 5).join(", ")}`,
            count: dupRows.length,
            category: "unique",
            affected: cap(dupRows).map((r) => ({
              id: r.id,
              label: r.code,
              fields: { code: r.code, name: r.name, stage: r.stage },
            })),
          });
      }

      // 4. Drill holes duplicate hole_id
      if (dh.data) {
        const map = new Map<string, typeof dh.data>();
        for (const r of dh.data) {
          if (!r.hole_id) continue;
          (map.get(r.hole_id) ?? map.set(r.hole_id, []).get(r.hole_id)!).push(r);
        }
        const dupRows = [...map.values()].filter((arr) => arr.length > 1).flat();
        if (dupRows.length)
          inconsistencies.push({
            id: "dh-dup",
            severity: "error",
            table: "drill_holes",
            rule: "hole_id duplicado",
            detail: `IDs: ${[...new Set(dupRows.map((r) => r.hole_id))].slice(0, 5).join(", ")}`,
            count: dupRows.length,
            category: "unique",
            affected: cap(dupRows).map((r) => ({
              id: r.id,
              label: r.hole_id,
              fields: { hole_id: r.hole_id, status: r.status, planned_depth: r.planned_depth },
            })),
          });
      }

      // 5. Patents enum + paid without paid_at
      const pt = await supabase
        .from("concession_patents")
        .select("id,status,paid_at,year,amount_utm,concession_id")
        .eq("project_id", projectId);
      if (pt.data) {
        const badSt = pt.data.filter((r) => r.status && !VALID_PATENT_STATUS.has(String(r.status)));
        if (badSt.length)
          inconsistencies.push({
            id: "pt-st",
            severity: "warn",
            table: "concession_patents",
            rule: "status fuera de enum",
            detail: [...new Set(badSt.map((b) => b.status))].join(", "),
            count: badSt.length,
            category: "enum",
            affected: cap(badSt).map((r) => ({
              id: r.id,
              label: `${r.year}`,
              fields: {
                year: r.year,
                status: r.status,
                amount_utm: r.amount_utm,
                concession_id: r.concession_id,
              },
            })),
          });
        const paidNoDate = pt.data.filter((r) => r.status === "paid" && !r.paid_at);
        if (paidNoDate.length)
          inconsistencies.push({
            id: "pt-pd",
            severity: "warn",
            table: "concession_patents",
            rule: "paid sin paid_at",
            detail: "Patentes marcadas como pagadas sin fecha",
            count: paidNoDate.length,
            affected: cap(paidNoDate).map((r) => ({
              id: r.id,
              label: `${r.year}`,
              fields: {
                year: r.year,
                status: r.status,
                paid_at: r.paid_at,
                concession_id: r.concession_id,
              },
            })),
          });
      }

      // 6. Concessions duplicate code
      const conc = await supabase
        .from("mining_concessions")
        .select("id,code,name")
        .eq("project_id", projectId);
      if (conc.data) {
        const map = new Map<string, typeof conc.data>();
        for (const r of conc.data) {
          if (!r.code) continue;
          (map.get(r.code) ?? map.set(r.code, []).get(r.code)!).push(r);
        }
        const dupRows = [...map.values()].filter((arr) => arr.length > 1).flat();
        if (dupRows.length)
          inconsistencies.push({
            id: "mc-dup",
            severity: "error",
            table: "mining_concessions",
            rule: "code duplicado",
            detail: `Códigos: ${[...new Set(dupRows.map((r) => r.code))].slice(0, 5).join(", ")}`,
            count: dupRows.length,
            category: "unique",
            affected: cap(dupRows).map((r) => ({
              id: r.id,
              label: r.code,
              fields: { code: r.code, name: r.name },
            })),
          });
      }

      // 7. Campaigns without phase
      const camp = await supabase
        .from("exploration_campaigns")
        .select("id,name,phase,status")
        .eq("project_id", projectId);
      if (camp.data) {
        const noPhase = camp.data.filter((r) => !r.phase);
        if (noPhase.length)
          inconsistencies.push({
            id: "camp-ph",
            severity: "info",
            table: "exploration_campaigns",
            rule: "campaña sin phase",
            detail: "Definir fase (recon, generative, etc.)",
            count: noPhase.length,
            category: "missing",
            affected: cap(noPhase).map((r) => ({
              id: r.id,
              label: r.name,
              fields: { name: r.name, status: r.status, phase: r.phase },
            })),
          });
      }

      // 8. Geophysics stations without survey
      const gs = await supabase
        .from("geophysics_stations")
        .select("id,survey_id,station_id,lat,lng")
        .eq("project_id", projectId);
      if (gs.data) {
        const orphan = gs.data.filter((r) => !r.survey_id);
        if (orphan.length)
          inconsistencies.push({
            id: "gs-orph",
            severity: "warn",
            table: "geophysics_stations",
            rule: "estación sin survey_id",
            detail: "Estaciones huérfanas sin survey vinculado",
            count: orphan.length,
            category: "missing",
            affected: cap(orphan).map((r) => ({
              id: r.id,
              label: r.station_id,
              fields: { station_id: r.station_id, lat: r.lat, lng: r.lng, survey_id: r.survey_id },
            })),
          });
      }

      // ============ CROSS-REFERENCE INTEGRITY (broken FKs) ============
      // Helper: load id sets for parent tables once
      const [campaignsRes, holesRes, concessionsRes, surveysRes, flightsRes, rastersRes] =
        await Promise.all([
          supabase.from("exploration_campaigns").select("id").eq("project_id", projectId),
          supabase.from("drill_holes").select("id").eq("project_id", projectId),
          supabase.from("mining_concessions").select("id").eq("project_id", projectId),
          supabase.from("geophysics_surveys").select("id").eq("project_id", projectId),
          supabase.from("drone_flights").select("id").eq("project_id", projectId),
          supabase.from("drone_rasters").select("id").eq("project_id", projectId),
        ]);
      const campaignIds = new Set((campaignsRes.data ?? []).map((r) => r.id));
      const holeIds = new Set((holesRes.data ?? []).map((r) => r.id));
      const concessionIds = new Set((concessionsRes.data ?? []).map((r) => r.id));
      const surveyIds = new Set((surveysRes.data ?? []).map((r) => r.id));
      const flightIds = new Set((flightsRes.data ?? []).map((r) => r.id));
      const rasterIds = new Set((rastersRes.data ?? []).map((r) => r.id));

      const checks: Array<{
        id: string;
        severity: Inconsistency["severity"];
        table: string;
        rule: string;
        rows: { id: string; ref: string | null }[];
        parentLabel: string;
      }> = [];

      // 9. Targets → campaign
      if (tg.data) {
        const broken = tg.data.filter(
          (r) =>
            r["campaign_id" as keyof typeof r] &&
            !campaignIds.has(r["campaign_id" as keyof typeof r] as string),
        );
        if (broken.length)
          checks.push({
            id: "xref-tg-camp",
            severity: "error",
            table: "exploration_targets",
            rule: "target → campaña inexistente",
            parentLabel: "campaign_id",
            rows: broken.map((r) => ({
              id: r.id,
              ref: (r["campaign_id" as keyof typeof r] as string) ?? null,
            })),
          });
      }

      // 10. Drill holes → campaign
      const dh2 = await supabase
        .from("drill_holes")
        .select("id,hole_id,campaign_id")
        .eq("project_id", projectId);
      if (dh2.data) {
        const broken = dh2.data.filter((r) => r.campaign_id && !campaignIds.has(r.campaign_id));
        if (broken.length)
          checks.push({
            id: "xref-dh-camp",
            severity: "error",
            table: "drill_holes",
            rule: "sondaje → campaña inexistente",
            parentLabel: "campaign_id",
            rows: broken.map((r) => ({ id: r.id, ref: r.campaign_id })),
          });
      }

      // 11. Drill core logs → drill hole
      if (cl.data) {
        const broken = cl.data.filter(
          (r) =>
            !r["hole_id" as keyof typeof r] ||
            !holeIds.has(r["hole_id" as keyof typeof r] as string),
        );
        if (broken.length)
          checks.push({
            id: "xref-cl-hole",
            severity: "error",
            table: "drill_core_logs",
            rule: "core log → sondaje inexistente",
            parentLabel: "hole_id",
            rows: broken.map((r) => ({
              id: r.id,
              ref: (r["hole_id" as keyof typeof r] as string) ?? null,
            })),
          });
      }

      // 12. Patents → concession
      if (pt.data) {
        const ptFull = await supabase
          .from("concession_patents")
          .select("id,concession_id")
          .eq("project_id", projectId);
        if (ptFull.data) {
          const broken = ptFull.data.filter(
            (r) => !r.concession_id || !concessionIds.has(r.concession_id),
          );
          if (broken.length)
            checks.push({
              id: "xref-pt-conc",
              severity: "error",
              table: "concession_patents",
              rule: "patente → concesión inexistente",
              parentLabel: "concession_id",
              rows: broken.map((r) => ({ id: r.id, ref: r.concession_id })),
            });
        }
      }

      // 13. Geophysics stations → survey (broken, not just null)
      if (gs.data) {
        const broken = gs.data.filter((r) => r.survey_id && !surveyIds.has(r.survey_id));
        if (broken.length)
          checks.push({
            id: "xref-gs-survey",
            severity: "error",
            table: "geophysics_stations",
            rule: "estación → survey inexistente",
            parentLabel: "survey_id",
            rows: broken.map((r) => ({ id: r.id, ref: r.survey_id })),
          });
      }

      // 14. Geophysics lines → survey
      const gl = await supabase
        .from("geophysics_lines")
        .select("id,survey_id")
        .eq("project_id", projectId);
      if (gl.data) {
        const broken = gl.data.filter((r) => r.survey_id && !surveyIds.has(r.survey_id));
        if (broken.length)
          checks.push({
            id: "xref-gl-survey",
            severity: "error",
            table: "geophysics_lines",
            rule: "línea geofísica → survey inexistente",
            parentLabel: "survey_id",
            rows: broken.map((r) => ({ id: r.id, ref: r.survey_id })),
          });
      }

      // 15. Concession patents → already covered; concession_overlaps → concession
      const co = await supabase
        .from("concession_overlaps")
        .select("id,concession_id")
        .eq("project_id", projectId);
      if (co.data) {
        const broken = co.data.filter((r) => !concessionIds.has(r.concession_id));
        if (broken.length)
          checks.push({
            id: "xref-co-conc",
            severity: "error",
            table: "concession_overlaps",
            rule: "overlap → concesión inexistente",
            parentLabel: "concession_id",
            rows: broken.map((r) => ({ id: r.id, ref: r.concession_id })),
          });
      }

      // 16. Drone rasters → flight (warn, flight is optional)
      const dr = await supabase
        .from("drone_rasters")
        .select("id,flight_id,campaign_id")
        .eq("project_id", projectId);
      if (dr.data) {
        const brokenFlight = dr.data.filter((r) => r.flight_id && !flightIds.has(r.flight_id));
        if (brokenFlight.length)
          checks.push({
            id: "xref-dr-flight",
            severity: "warn",
            table: "drone_rasters",
            rule: "raster → vuelo inexistente",
            parentLabel: "flight_id",
            rows: brokenFlight.map((r) => ({ id: r.id, ref: r.flight_id })),
          });
        const brokenCamp = dr.data.filter((r) => r.campaign_id && !campaignIds.has(r.campaign_id));
        if (brokenCamp.length)
          checks.push({
            id: "xref-dr-camp",
            severity: "warn",
            table: "drone_rasters",
            rule: "raster → campaña inexistente",
            parentLabel: "campaign_id",
            rows: brokenCamp.map((r) => ({ id: r.id, ref: r.campaign_id })),
          });
      }

      // 17. Drone flights → campaign (warn)
      const df = await supabase
        .from("drone_flights")
        .select("id,campaign_id")
        .eq("project_id", projectId);
      if (df.data) {
        const broken = df.data.filter((r) => r.campaign_id && !campaignIds.has(r.campaign_id));
        if (broken.length)
          checks.push({
            id: "xref-df-camp",
            severity: "warn",
            table: "drone_flights",
            rule: "vuelo → campaña inexistente",
            parentLabel: "campaign_id",
            rows: broken.map((r) => ({ id: r.id, ref: r.campaign_id })),
          });
      }

      // 18. dem_diffs → rasters (error; both required)
      const dd = await supabase
        .from("dem_diffs")
        .select("id,raster_before_id,raster_after_id")
        .eq("project_id", projectId);
      if (dd.data) {
        const broken = dd.data.filter(
          (r) => !rasterIds.has(r.raster_before_id) || !rasterIds.has(r.raster_after_id),
        );
        if (broken.length)
          checks.push({
            id: "xref-dd-raster",
            severity: "error",
            table: "dem_diffs",
            rule: "DEM diff → raster inexistente",
            parentLabel: "raster_before/after",
            rows: broken.map((r) => ({
              id: r.id,
              ref: `${r.raster_before_id}/${r.raster_after_id}`,
            })),
          });
      }

      // 19. campaign_expenses → campaign / hole
      const ce = await supabase
        .from("campaign_expenses")
        .select("id,campaign_id,hole_id")
        .eq("project_id", projectId);
      if (ce.data) {
        const broken = ce.data.filter((r) => !campaignIds.has(r.campaign_id));
        if (broken.length)
          checks.push({
            id: "xref-ce-camp",
            severity: "error",
            table: "campaign_expenses",
            rule: "gasto → campaña inexistente",
            parentLabel: "campaign_id",
            rows: broken.map((r) => ({ id: r.id, ref: r.campaign_id })),
          });
        const brokenHole = ce.data.filter((r) => r.hole_id && !holeIds.has(r.hole_id));
        if (brokenHole.length)
          checks.push({
            id: "xref-ce-hole",
            severity: "warn",
            table: "campaign_expenses",
            rule: "gasto → sondaje inexistente",
            parentLabel: "hole_id",
            rows: brokenHole.map((r) => ({ id: r.id, ref: r.hole_id })),
          });
      }

      // 20. campaign_budgets → campaign
      const cb = await supabase
        .from("campaign_budgets")
        .select("id,campaign_id")
        .eq("project_id", projectId);
      if (cb.data) {
        const broken = cb.data.filter((r) => !campaignIds.has(r.campaign_id));
        if (broken.length)
          checks.push({
            id: "xref-cb-camp",
            severity: "error",
            table: "campaign_budgets",
            rule: "presupuesto → campaña inexistente",
            parentLabel: "campaign_id",
            rows: broken.map((r) => ({ id: r.id, ref: r.campaign_id })),
          });
      }

      // 21. core_boxes → drill hole (warn, hole_id is optional)
      const cbox = await supabase
        .from("core_boxes")
        .select("id,hole_id")
        .eq("project_id", projectId);
      if (cbox.data) {
        const broken = cbox.data.filter((r) => r.hole_id && !holeIds.has(r.hole_id));
        if (broken.length)
          checks.push({
            id: "xref-cbox-hole",
            severity: "warn",
            table: "core_boxes",
            rule: "caja core → sondaje inexistente",
            parentLabel: "hole_id",
            rows: broken.map((r) => ({ id: r.id, ref: r.hole_id })),
          });
      }

      // Push all xref findings as inconsistencies, tagged as cross-reference.
      const cap50 = <T>(arr: T[]): T[] => arr.slice(0, 50);
      for (const c of checks) {
        const sample = c.rows
          .slice(0, 3)
          .map((r) => r.ref ?? "∅")
          .filter(Boolean);
        inconsistencies.push({
          id: c.id,
          severity: c.severity,
          table: c.table,
          rule: c.rule,
          detail: `FK rota en ${c.parentLabel}${sample.length ? ` · refs: ${sample.join(", ")}${c.rows.length > 3 ? "…" : ""}` : ""}`,
          count: c.rows.length,
          category: "xref",
          affected: cap50(c.rows).map((r) => ({
            id: r.id,
            label: r.ref ?? "∅",
            fields: { [c.parentLabel]: r.ref ?? "(null)" },
          })),
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

    // Fetch the latest previous snapshot per table for delta computation.
    const lastSync: ValidationReport["lastSync"] = {};
    if (projectId) {
      const tableNames = tables.map((t) => t.table);
      const { data: snapshots } = await supabase
        .from("validation_snapshots")
        .select("table_name,row_count,created_at")
        .eq("project_id", projectId)
        .in("table_name", tableNames)
        .order("created_at", { ascending: false })
        .limit(500);
      const seen = new Set<string>();
      for (const s of snapshots ?? []) {
        if (seen.has(s.table_name)) continue;
        seen.add(s.table_name);
        const audit = tables.find((t) => t.table === s.table_name);
        if (!audit) continue;
        lastSync[s.table_name] = {
          at: s.created_at,
          prevCount: s.row_count,
          delta: audit.count - s.row_count,
        };
      }
      for (const t of tables) {
        if (!(t.table in lastSync)) lastSync[t.table] = null;
      }

      // Persist new snapshot rows for this run (best-effort, ignore errors).
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const payload = tables.map((t) => ({
          project_id: projectId,
          table_name: t.table,
          row_count: t.count,
          status: t.status,
          created_by: user.id,
        }));
        await supabase.from("validation_snapshots").insert(payload);
      }
    }

    setReport({ tables, inconsistencies, totals, generatedAt: new Date().toISOString(), lastSync });
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    run();
  }, [run]);

  return { report, loading, refresh: run };
}

// engineCloud — Sprint 6
// Helpers de persistencia sobre Supabase: versions, QA/QC, AI, targets, reports, audit, comments.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const toJson = (v: unknown): Json => (v ?? null) as Json;

// ---------- Block Model Versions ----------
export type BlockModelVersionRow = {
  id: string;
  project_id: string;
  version_label: string;
  input_hash: string | null;
  settings_hash: string | null;
  settings: Record<string, unknown>;
  resource_summary: Record<string, unknown>;
  block_count: number | null;
  binary_path: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function listBlockModelVersions(projectId: string) {
  const { data, error } = await supabase
    .from("engine_block_model_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlockModelVersionRow[];
}

export async function saveBlockModelVersion(input: {
  projectId: string;
  versionLabel: string;
  inputHash?: string;
  settingsHash?: string;
  settings?: Record<string, unknown>;
  resourceSummary?: Record<string, unknown>;
  blockCount?: number;
  binaryPath?: string;
  notes?: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("engine_block_model_versions")
    .insert({
      project_id: input.projectId,
      version_label: input.versionLabel,
      input_hash: input.inputHash ?? null,
      settings_hash: input.settingsHash ?? null,
      settings: (input.settings ?? {}) as unknown as Json,
      resource_summary: (input.resourceSummary ?? {}) as unknown as Json,
      block_count: input.blockCount ?? null,
      binary_path: input.binaryPath ?? null,
      notes: input.notes ?? null,
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BlockModelVersionRow;
}

// ---------- QA/QC Reports ----------
export async function saveQAQCReport(input: {
  projectId: string;
  label?: string;
  summary: Record<string, unknown>;
  issues: unknown[];
  criticalCount: number;
  warningCount: number;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("engine_qaqc_reports").insert({
    project_id: input.projectId,
    label: input.label ?? null,
    summary: toJson(input.summary),
    issues: input.issues as unknown as Json,
    critical_count: input.criticalCount,
    warning_count: input.warningCount,
    created_by: user?.id ?? null,
  });
  if (error) throw error;
}

// ---------- AI Interpretations ----------
export async function saveAIInterpretation(input: {
  projectId: string;
  blockModelVersionId?: string;
  summary: string;
  uncertainty: number;
  upside: number;
  payload: Record<string, unknown>;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("engine_ai_interpretations").insert({
    project_id: input.projectId,
    block_model_version_id: input.blockModelVersionId ?? null,
    summary: input.summary,
    uncertainty: input.uncertainty,
    upside: input.upside,
    payload: input.payload as unknown as Json,
    created_by: user?.id ?? null,
  });
  if (error) throw error;
}

// ---------- Drill Targets ----------
export type DrillTargetRow = {
  id: string;
  project_id: string;
  target_code: string | null;
  priority: "A" | "B" | "C";
  collar_x: number;
  collar_y: number;
  collar_z: number | null;
  azimuth: number | null;
  dip: number | null;
  depth: number | null;
  confidence: number | null;
  estimated_cost: number | null;
  scenario: string | null;
  status: "proposed" | "approved" | "rejected" | "drilled";
  payload: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function listDrillTargets(projectId: string) {
  const { data, error } = await supabase
    .from("engine_drill_targets")
    .select("*")
    .eq("project_id", projectId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DrillTargetRow[];
}

export async function saveDrillTargetsBatch(
  projectId: string,
  targets: Array<{
    target_code?: string;
    priority: "A" | "B" | "C";
    collar_x: number;
    collar_y: number;
    collar_z?: number;
    azimuth?: number;
    dip?: number;
    depth?: number;
    confidence?: number;
    estimated_cost?: number;
    scenario?: string;
    payload?: Record<string, unknown>;
  }>,
) {
  if (targets.length === 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const rows = targets.map((t) => ({
    project_id: projectId,
    target_code: t.target_code ?? null,
    priority: t.priority,
    collar_x: t.collar_x,
    collar_y: t.collar_y,
    collar_z: t.collar_z ?? null,
    azimuth: t.azimuth ?? null,
    dip: t.dip ?? null,
    depth: t.depth ?? null,
    confidence: t.confidence ?? null,
    estimated_cost: t.estimated_cost ?? null,
    scenario: t.scenario ?? null,
    payload: (t.payload ?? {}) as unknown as Json,
    created_by: user?.id ?? null,
  }));
  const { error } = await supabase.from("engine_drill_targets").insert(rows);
  if (error) throw error;
}

// ---------- Reports ----------
export async function saveGeneratedReport(input: {
  projectId: string;
  kind: string;
  title?: string;
  format?: string;
  payload?: Record<string, unknown>;
  storagePath?: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("engine_reports_generated").insert({
    project_id: input.projectId,
    kind: input.kind,
    title: input.title ?? null,
    format: input.format ?? "json",
    payload: (input.payload ?? null) as unknown as Json,
    storage_path: input.storagePath ?? null,
    created_by: user?.id ?? null,
  });
  if (error) throw error;
}

// ---------- Audit ----------
export async function logEngineAudit(input: {
  projectId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("engine_audit_events").insert({
    project_id: input.projectId,
    actor_id: user.id,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    payload: (input.payload ?? {}) as unknown as Json,
  });
}

// ---------- Comments ----------
export type EngineCommentRow = {
  id: string;
  project_id: string;
  entity_type:
    "section" | "target" | "block_model_version" | "qaqc_issue" | "ai_interpretation" | "report";
  entity_id: string;
  body: string;
  mentions: string[];
  status: "draft" | "review" | "approved";
  resolved_at: string | null;
  author_id: string;
  created_at: string;
  updated_at: string;
};

export async function listComments(
  projectId: string,
  entityType: EngineCommentRow["entity_type"],
  entityId: string,
) {
  const { data, error } = await supabase
    .from("engine_comments")
    .select("*")
    .eq("project_id", projectId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EngineCommentRow[];
}

export async function addComment(input: {
  projectId: string;
  entityType: EngineCommentRow["entity_type"];
  entityId: string;
  body: string;
  mentions?: string[];
  status?: EngineCommentRow["status"];
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("engine_comments").insert({
    project_id: input.projectId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    body: input.body,
    mentions: input.mentions ?? [],
    status: input.status ?? "draft",
    author_id: user.id,
  });
  if (error) throw error;
}

export async function updateCommentStatus(commentId: string, status: EngineCommentRow["status"]) {
  const { error } = await supabase
    .from("engine_comments")
    .update({
      status,
      resolved_at: status === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", commentId);
  if (error) throw error;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from("engine_comments").delete().eq("id", commentId);
  if (error) throw error;
}
